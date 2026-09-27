using System;
using System.IO;
using LocalScenes;

public static class SqliteTests
{
    public static int Passed;
    public static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
    public static void Error(Action action, LocalErrorCode code)
    {
        try { action(); } catch (LocalStoreError e) {
            Check(e.Code == code, "wrong safe error: " + e.Code);
            Check(!e.Message.Contains("SELECT") && !e.Message.Contains("secret"), "internal details leaked"); return;
        }
        throw new Exception("expected " + code);
    }
    public static void Test(string name, Action action) { action(); Passed++; Console.WriteLine("PASS " + name); }
    public static int Main()
    {
        string dir = Path.Combine(Path.GetTempPath(), "offline-tests-" + Guid.NewGuid());
        Directory.CreateDirectory(dir);
        try { Run(dir); Console.WriteLine("SQLite: " + Passed + " passed"); return 0; }
        catch (Exception e) { Console.Error.WriteLine(e); return 1; }
        finally { Directory.Delete(dir, true); }
    }
    public static void Run(string dir)
    {
        string path = Path.Combine(dir, "资料.sqlite");
        using (var db = new SqliteConnection(path)) {
            db.Execute("CREATE TABLE sample (name TEXT, n INTEGER, optional TEXT)");
            Test("UTF8 NUL and exact int64 bindings", () => {
                db.Execute("INSERT INTO sample VALUES (?,?,?)", "沙发\0浅灰'\n", 9007199254740993L, null);
                var row = db.Query("SELECT * FROM sample")[0];
                Check((string)row["name"] == "沙发\0浅灰'\n", "text changed");
                Check((long)row["n"] == 9007199254740993L && row["optional"] == null, "value changed");
            });
            Test("rollback discards partial changes", () => {
                try { db.Transaction(() => { db.Execute("INSERT INTO sample VALUES ('bad',1,NULL)"); throw new InvalidOperationException(); }); }
                catch (InvalidOperationException) {}
                Check(db.Query("SELECT * FROM sample").Count == 1, "partial write");
            });
            Test("independent connections contend safely", () => {
                using (var second = new SqliteConnection(path, 50)) {
                    db.Transaction(() => Error(() => second.Transaction(() => second.Execute("INSERT INTO sample VALUES ('blocked',2,NULL)")), LocalErrorCode.Busy));
                    second.Transaction(() => second.Execute("INSERT INTO sample VALUES ('after',2,NULL)"));
                }
                Check(db.Query("SELECT * FROM sample").Count == 2, "lock recovery");
            });
            Test("constraint failure returns safe error and rolls back", () => {
                db.Execute("CREATE UNIQUE INDEX sample_unique ON sample(n)");
                Error(() => db.Transaction(() => {
                    db.Execute("INSERT INTO sample VALUES ('partial',3,NULL)");
                    db.Execute("INSERT INTO sample VALUES ('secret duplicate',2,NULL)");
                }), LocalErrorCode.Conflict);
                Check(db.Query("SELECT * FROM sample").Count == 2, "constraint partial write");
            });
            Test("online backup includes committed content", () => {
                string backup = Path.Combine(dir, "backup.sqlite");
                db.BackupTo(backup);
                using (var copy = new SqliteConnection(backup)) Check(copy.Query("SELECT * FROM sample").Count == 2, "incomplete backup");
                Error(() => db.BackupTo(backup), LocalErrorCode.InvalidInput);
                using (var copy = new SqliteConnection(backup)) Check(copy.Query("SELECT * FROM sample").Count == 2, "backup overwritten");
            });
            Test("bad SQL and unsupported parameter are safe", () => {
                Error(() => db.Query("SELECT secret FROM missing"), LocalErrorCode.Unavailable);
                Error(() => db.Execute("INSERT INTO sample VALUES (?,?,?)", new object(), 4, null), LocalErrorCode.InvalidInput);
                Error(() => db.Execute("INSERT INTO sample VALUES (?,?,?)", "finite", double.PositiveInfinity, null), LocalErrorCode.InvalidInput);
            });
        }
        Test("close reopen persists Unicode", () => { using (var db = new SqliteConnection(path)) Check((string)db.Query("SELECT * FROM sample ORDER BY n DESC")[0]["name"] == "沙发\0浅灰'\n", "reopen lost data"); });
    }
}
