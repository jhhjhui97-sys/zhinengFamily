using System;
using System.Runtime.InteropServices;
namespace LocalScenes {
internal static class SqliteNative {
#if UNITY_IOS && !UNITY_EDITOR
    const string Library = "__Internal";
#elif UNITY_EDITOR_WIN || UNITY_STANDALONE_WIN || SQLITE_WINDOWS
    const string Library = "winsqlite3";
#else
    const string Library = "sqlite3";
#endif
    internal const int Ok = 0, Row = 100, Done = 101;
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_open_v2(byte[] path, out IntPtr db, int flags, IntPtr vfs);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_close_v2(IntPtr db);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_busy_timeout(IntPtr db, int milliseconds);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_prepare_v2(IntPtr db, byte[] sql, int bytes, out IntPtr statement, out IntPtr tail);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_step(IntPtr statement);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_finalize(IntPtr statement);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_bind_parameter_count(IntPtr statement);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_bind_null(IntPtr statement, int index);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_bind_int64(IntPtr statement, int index, long value);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_bind_double(IntPtr statement, int index, double value);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_bind_text(IntPtr statement, int index, byte[] value, int length, IntPtr destructor);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_column_count(IntPtr statement);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern IntPtr sqlite3_column_name(IntPtr statement, int index);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_column_type(IntPtr statement, int index);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern IntPtr sqlite3_column_text(IntPtr statement, int index);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_column_bytes(IntPtr statement, int index);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern long sqlite3_column_int64(IntPtr statement, int index);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern double sqlite3_column_double(IntPtr statement, int index);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_changes(IntPtr db);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern IntPtr sqlite3_backup_init(IntPtr destination, byte[] destinationName, IntPtr source, byte[] sourceName);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_backup_step(IntPtr backup, int pages);
    [DllImport(Library, CallingConvention=CallingConvention.Cdecl)] internal static extern int sqlite3_backup_finish(IntPtr backup);
}
}
