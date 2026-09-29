using System;
using System.IO;
using LocalScenes;
using SmartHome.SceneConsumer;

public static class LocalMigrationTests {
 static int passed;
 static void Check(bool value,string message) { if(!value) throw new Exception(message); }
 static void Test(string name,Action body) { body(); passed++; Console.WriteLine("PASS "+name); }
 static void Legacy(string path) {
  using(var db=new SqliteConnection(path)) {
   db.Execute("DROP TABLE IF EXISTS local_products");
   db.Execute("DROP TABLE IF EXISTS project_scenes");
   db.Execute("DROP TABLE IF EXISTS local_projects");
   db.Execute("DROP TABLE IF EXISTS local_customers");
   db.Execute("PRAGMA user_version=1");
  }
 }
 static string[] Backups(string path) {
  return Directory.GetFiles(Path.GetDirectoryName(path),Path.GetFileName(path)+".pre-v2-*.bak");
 }
 public static void Run(string schema,string sample,string directory) {
  var validator=new OfflineSceneValidator(File.ReadAllText(schema));
  var scene=File.ReadAllText(sample);
  Test("v1 scenes migrate additively with a restorable pre-v2 backup",()=>{
   string path=Path.Combine(directory,"migration-legacy.sqlite");
   var identity=LocalIdentity.Open(path); Guid document;
   using(var store=new LocalSceneStore(path,identity.WorkspaceId,identity.ActorId,validator)) {
    store.Catalog(Guid.Parse("40000000-0000-4000-8000-000000000002"),"沙发",2400,950,850);
    document=store.Create("已有客户方案"); store.Put(document,0,scene); store.Put(document,1,scene);
   }
   Legacy(path);
   using(var store=new LocalSceneStore(path,identity.WorkspaceId,identity.ActorId,validator))
    Check(store.Current(document).Revision==2&&store.Versions(document).Count==2,"scene history changed during migration");
   using(var db=new SqliteConnection(path)) {
    Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==3,"migration did not advance format");
    Check(db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name='local_projects'").Count==1,"project table missing");
   }
   Check(Backups(path).Length==1,"pre-v2 backup missing");
   Check(Directory.GetFiles(directory,"migration-legacy.sqlite.pre-v3-*.bak").Length==1,"direct v1 to v3 upgrade lacked intermediate backup");
   using(var old=new SqliteConnection(Backups(path)[0])) {
    Check((long)old.Query("PRAGMA user_version")[0]["user_version"]==1,"backup was upgraded in place");
    Check((long)old.Query("SELECT COUNT(*) n FROM scene_versions WHERE document_id=?",document.ToString("D"))[0]["n"]==2,"backup lost scene history");
   }
   string restored=Path.Combine(directory,"migration-restored-v1.sqlite");
   File.Copy(Backups(path)[0],restored);
   using(var copy=new LocalSceneStore(restored,identity.WorkspaceId,identity.ActorId,validator))
    Check(copy.Current(document).Revision==2&&copy.Versions(document).Count==2,"restored v1 backup could not reopen with full history");
   Check(LocalIdentity.Open(path).WorkspaceId==identity.WorkspaceId,"v2 identity refused existing workspace");
   using(var reopened=new LocalSceneStore(path,identity.WorkspaceId,identity.ActorId,validator)) Check(reopened.Current(document).Revision==2,"v3 reopen lost scene");
   Check(Backups(path).Length==1,"v3 reopen created redundant pre-v2 backup");
  });
  Test("failed migration rolls back new tables and preserves v1 scene data",()=>{
   string path=Path.Combine(directory,"migration-failure.sqlite");
   Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid(),document;
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) document=store.Create("不要删除");
   Legacy(path);
   using(var db=new SqliteConnection(path)) db.Execute("CREATE TABLE local_customers(bad INTEGER)");
   bool rejected=false;
   try { using(var ignored=new LocalSceneStore(path,workspace,actor,validator)) {} } catch { rejected=true; }
   Check(rejected,"broken migration was accepted");
   using(var db=new SqliteConnection(path)) {
    Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==1,"failed migration advanced format");
    Check((long)db.Query("SELECT COUNT(*) n FROM scene_documents WHERE id=?",document.ToString("D"))[0]["n"]==1,"failed migration removed scene");
    Check(db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name='local_projects'").Count==0,"failed migration left partial tables");
   }
   Check(Backups(path).Length==1,"migration failure did not leave recovery backup");
  });
  Test("fresh database starts at v3 without a recovery backup",()=>{
   string path=Path.Combine(directory,"migration-fresh.sqlite"); Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid();
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) Check(store.Documents().Total==0,"fresh library not empty");
   using(var db=new SqliteConnection(path)) Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==3,"fresh schema not v3");
   Check(Backups(path).Length==0,"fresh database has unnecessary backup");
  });
  Console.WriteLine("Local migration: "+passed+" passed");
 }
}
