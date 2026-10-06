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
   foreach(string table in new[]{"local_order_events","local_order_state","local_order_exclusions","local_order_lines","local_orders"})db.Execute("DROP TABLE IF EXISTS "+table);
   db.Execute("DROP TABLE IF EXISTS local_quotation_exclusions");
   db.Execute("DROP TABLE IF EXISTS local_quotation_lines");
   db.Execute("DROP TABLE IF EXISTS local_quotations");
   db.Execute("DROP TABLE IF EXISTS local_product_active_model");
   db.Execute("DROP TABLE IF EXISTS local_model_assets");
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
    Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==8,"migration did not advance format");
    Check(db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name='local_projects'").Count==1,"project table missing");
    db.Query("SELECT deleted_at FROM local_customers LIMIT 1");
   }
   Check(Backups(path).Length==1,"pre-v2 backup missing");
   Check(Directory.GetFiles(directory,"migration-legacy.sqlite.pre-v3-*.bak").Length==1,"direct v1 to v3 upgrade lacked intermediate backup");
   Check(Directory.GetFiles(directory,"migration-legacy.sqlite.pre-v5-*.bak").Length==1,"v1 to v5 upgrade lacked original backup");
   Check(Directory.GetFiles(directory,"migration-legacy.sqlite.pre-v7-*.bak").Length==1,"v1 to v7 upgrade lacked original backup");
   Check(Directory.GetFiles(directory,"migration-legacy.sqlite.pre-v8-*.bak").Length==1,"v1 to v8 upgrade lacked original backup");
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
  Test("v1 to v4 failure rolls back every stage and preserves an original backup",()=>{
   string path=Path.Combine(directory,"migration-v1-v4-failure.sqlite");Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid(),document;
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) document=store.Create("原有方案");
   Legacy(path);
   using(var db=new SqliteConnection(path)) db.Execute("CREATE TABLE local_model_assets(broken INTEGER)");
   bool rejected=false;try { using(var ignored=new LocalSceneStore(path,workspace,actor,validator)) {} } catch { rejected=true; }
   Check(rejected,"broken final migration was accepted");
   using(var db=new SqliteConnection(path)) {
    Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==1,"final migration failure advanced original format");
    Check(db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name='local_customers'").Count==0,"failed final stage left customer table");
    Check(db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name='local_products'").Count==0,"failed final stage left product table");
    Check((long)db.Query("SELECT COUNT(*) n FROM scene_documents WHERE id=?",document.ToString("D"))[0]["n"]==1,"original scene lost");
   }
   string[] backups=Directory.GetFiles(directory,"migration-v1-v4-failure.sqlite.pre-v4-*.bak");Check(backups.Length==1,"original pre-v4 backup missing");
   using(var db=new SqliteConnection(backups[0])) Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==1,"pre-v4 backup was not original v1");
  });
  Test("v7 products migrate with a restorable backup and tolerate an existing tombstone column",()=>{
   string path=Path.Combine(directory,"migration-v7-products.sqlite");Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid(),product;
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) product=store.CreateLocalProduct("sofa","品牌","原有沙发","S1","100.00",2400,950,850).Id;
   using(var db=new SqliteConnection(path)) {
    bool column=false;foreach(var item in db.Query("PRAGMA table_info(local_products)")) if((string)item["name"]=="deleted_at")column=true;
    db.Execute("DROP INDEX IF EXISTS local_products_active");
    if(column)db.Execute("ALTER TABLE local_products DROP COLUMN deleted_at");
    db.Execute("PRAGMA user_version=7");
   }
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) Check(store.LocalProduct(product).Sku=="S1"&&store.LocalProducts().Total==1,"v7 product lost");
   string[] backups=Directory.GetFiles(directory,"migration-v7-products.sqlite.pre-v8-*.bak");Check(backups.Length==1,"v7 recovery backup missing");
   using(var db=new SqliteConnection(backups[0])) {
    Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==7,"v7 backup upgraded in place");
    Check((long)db.Query("SELECT COUNT(*) n FROM local_products WHERE id=?",product.ToString("D"))[0]["n"]==1,"v7 backup lost product");
   }
   string restored=Path.Combine(directory,"migration-v7-restored.sqlite");File.Copy(backups[0],restored);
   using(var store=new LocalSceneStore(restored,workspace,actor,validator)) Check(store.LocalProduct(product).Sku=="S1","v7 backup failed to restore");
   Check(LocalIdentity.Open(path).WorkspaceId==workspace,"v8 identity refused the workspace");
   using(var db=new SqliteConnection(path)) db.Execute("PRAGMA user_version=7");
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) Check(store.LocalProducts().Total==1,"existing tombstone column broke a simulated downgrade");
  });
  Test("failed v8 migration rolls back the tombstone column and retains its original backup",()=>{
   string path=Path.Combine(directory,"migration-v8-failure.sqlite");
   using(var db=new SqliteConnection(path)) {
    db.Execute("CREATE TABLE local_products(broken INTEGER)");db.Execute("INSERT INTO local_products VALUES(42)");
    db.Execute("PRAGMA user_version=7");
   }
   bool failed=false;try {using(var ignored=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {}}catch {failed=true;}
   Check(failed,"broken v8 migration accepted");
   using(var db=new SqliteConnection(path)) {
    Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==7,"failed v8 migration advanced format");
    Check((long)db.Query("SELECT broken FROM local_products")[0]["broken"]==42,"failed migration lost original data");
    foreach(var item in db.Query("PRAGMA table_info(local_products)")) Check((string)item["name"]!="deleted_at","failed v8 migration left a partial tombstone column");
   }
   Check(Directory.GetFiles(directory,"migration-v8-failure.sqlite.pre-v8-*.bak").Length==1,"failed v8 migration lacked backup");
  });
  Test("fresh database starts at v8 without a recovery backup",()=>{
   string path=Path.Combine(directory,"migration-fresh.sqlite"); Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid();
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) Check(store.Documents().Total==0,"fresh library not empty");
   using(var db=new SqliteConnection(path)) Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==8,"fresh schema not v8");
   Check(Backups(path).Length==0,"fresh database has unnecessary backup");
  });
  Console.WriteLine("Local migration: "+passed+" passed");
 }
}
