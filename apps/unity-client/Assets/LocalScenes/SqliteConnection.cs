using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace LocalScenes {
/// <summary>One owned native connection. Instances serialize their own calls; separate instances use SQLite locking.</summary>
public sealed class SqliteConnection : IDisposable {
    readonly object gate = new object();
    IntPtr handle;
    bool transaction;
    public SqliteConnection(string path, int busyMilliseconds = 5000) {
        if (string.IsNullOrWhiteSpace(path) || path.IndexOf('\0') >= 0 || busyMilliseconds < 0 || busyMilliseconds > 30000)
            throw new LocalStoreError(LocalErrorCode.InvalidInput);
        try {
            int code = SqliteNative.sqlite3_open_v2(Bytes(path), out handle, 2 | 4 | 0x10000, IntPtr.Zero);
            if (code != 0) { Dispose(); Fail(code); }
            Verify(SqliteNative.sqlite3_busy_timeout(handle, busyMilliseconds));
            Execute("PRAGMA foreign_keys=ON");
        } catch (DllNotFoundException) { Dispose(); throw new LocalStoreError(LocalErrorCode.Unavailable); }
          catch (EntryPointNotFoundException) { Dispose(); throw new LocalStoreError(LocalErrorCode.Unavailable); }
    }
    internal static byte[] Bytes(string value) { return Encoding.UTF8.GetBytes(value + "\0"); }
    static void Fail(int code) {
        int primary = code & 255;
        throw new LocalStoreError(primary == 5 || primary == 6 ? LocalErrorCode.Busy :
            primary == 19 ? LocalErrorCode.Conflict :
            primary == 11 || primary == 26 ? LocalErrorCode.Corrupt : LocalErrorCode.Unavailable);
    }
    static void Verify(int code) { if (code != 0) Fail(code); }
    void Open() { if (handle == IntPtr.Zero) throw new LocalStoreError(LocalErrorCode.Unavailable); }
    IntPtr Prepare(string sql, object[] args) {
        Open();
        if (string.IsNullOrWhiteSpace(sql) || sql.IndexOf('\0') >= 0) throw new LocalStoreError(LocalErrorCode.InvalidInput);
        IntPtr statement, tail;
        byte[] bytes = Bytes(sql);
        int code = SqliteNative.sqlite3_prepare_v2(handle, bytes, bytes.Length, out statement, out tail);
        if (code != 0) { if (statement != IntPtr.Zero) SqliteNative.sqlite3_finalize(statement); Fail(code); }
        if (statement == IntPtr.Zero) throw new LocalStoreError(LocalErrorCode.InvalidInput);
        try {
            if (SqliteNative.sqlite3_bind_parameter_count(statement) != args.Length) throw new LocalStoreError(LocalErrorCode.InvalidInput);
            for (int i=0; i<args.Length; i++) {
                object arg = args[i];
                if (arg == null) code = SqliteNative.sqlite3_bind_null(statement, i+1);
                else if (arg is string) {
                    byte[] text = Bytes((string)arg);
                    code = SqliteNative.sqlite3_bind_text(statement, i+1, text, text.Length-1, new IntPtr(-1));
                } else if (arg is int || arg is long || arg is short || arg is byte)
                    code = SqliteNative.sqlite3_bind_int64(statement, i+1, Convert.ToInt64(arg));
                else if (arg is double && !double.IsNaN((double)arg) && !double.IsInfinity((double)arg))
                    code = SqliteNative.sqlite3_bind_double(statement, i+1, (double)arg);
                else throw new LocalStoreError(LocalErrorCode.InvalidInput);
                Verify(code);
            }
            return statement;
        } catch { SqliteNative.sqlite3_finalize(statement); throw; }
    }
    public int Execute(string sql, params object[] args) {
        lock(gate) {
            IntPtr statement = Prepare(sql, args);
            try {
                int code;
                do { code = SqliteNative.sqlite3_step(statement); } while (code == SqliteNative.Row);
                if (code != SqliteNative.Done) Fail(code);
                return SqliteNative.sqlite3_changes(handle);
            } finally { SqliteNative.sqlite3_finalize(statement); }
        }
    }
    static string Text(IntPtr pointer, int count) {
        byte[] bytes = new byte[count]; if (count > 0) Marshal.Copy(pointer, bytes, 0, count);
        return Encoding.UTF8.GetString(bytes);
    }
    static string Name(IntPtr pointer) {
        int count=0; while (Marshal.ReadByte(pointer,count) != 0) count++;
        return Text(pointer,count);
    }
    public List<Dictionary<string,object>> Query(string sql, params object[] args) {
        lock(gate) {
            IntPtr statement = Prepare(sql,args);
            try {
                var rows = new List<Dictionary<string,object>>();
                int code;
                while ((code = SqliteNative.sqlite3_step(statement)) == SqliteNative.Row) {
                    var row = new Dictionary<string,object>(StringComparer.Ordinal);
                    for (int i=0;i<SqliteNative.sqlite3_column_count(statement);i++) {
                        int type = SqliteNative.sqlite3_column_type(statement,i);
                        object value;
                        if (type == 1) value = SqliteNative.sqlite3_column_int64(statement,i);
                        else if (type == 2) value = SqliteNative.sqlite3_column_double(statement,i);
                        else if (type == 3) value = Text(SqliteNative.sqlite3_column_text(statement,i),SqliteNative.sqlite3_column_bytes(statement,i));
                        else if (type == 5) value = null;
                        else throw new LocalStoreError(LocalErrorCode.InvalidInput);
                        row[Name(SqliteNative.sqlite3_column_name(statement,i))] = value;
                    }
                    rows.Add(row);
                }
                if (code != SqliteNative.Done) Fail(code);
                return rows;
            } finally { SqliteNative.sqlite3_finalize(statement); }
        }
    }
    public void Transaction(Action action) {
        lock(gate) {
            if (transaction || action == null) throw new LocalStoreError(LocalErrorCode.InvalidInput);
            Execute("BEGIN IMMEDIATE");
            transaction = true;
            try { action(); Execute("COMMIT"); }
            catch { try { Execute("ROLLBACK"); } catch (LocalStoreError) {} throw; }
            finally { transaction = false; }
        }
    }
    public void BackupTo(string path) {
        lock(gate) {
            Open();
            if (transaction || string.IsNullOrWhiteSpace(path) || path.IndexOf('\0') >= 0) throw new LocalStoreError(LocalErrorCode.InvalidInput);
            // Reserve a fresh destination so a race never overwrites another backup.
            try { using (new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None)) {} }
            catch (IOException) { throw new LocalStoreError(LocalErrorCode.InvalidInput); }
            catch (UnauthorizedAccessException) { throw new LocalStoreError(LocalErrorCode.Unavailable); }
            try {
                using (var destination = new SqliteConnection(path)) {
                    IntPtr backup = SqliteNative.sqlite3_backup_init(destination.handle,Bytes("main"),handle,Bytes("main"));
                    if (backup == IntPtr.Zero) throw new LocalStoreError(LocalErrorCode.Unavailable);
                    int code;
                    try { code = SqliteNative.sqlite3_backup_step(backup,-1); }
                    finally { Verify(SqliteNative.sqlite3_backup_finish(backup)); }
                    if (code != SqliteNative.Done) Fail(code);
                }
            } catch {
                // Only remove the freshly reserved file belonging to this failed operation.
                try { File.Delete(path); } catch (IOException) {} catch (UnauthorizedAccessException) {}
                throw;
            }
        }
    }
    public void Dispose() {
        lock(gate) { if (handle != IntPtr.Zero) { SqliteNative.sqlite3_close_v2(handle); handle=IntPtr.Zero; } }
    }
}
}
