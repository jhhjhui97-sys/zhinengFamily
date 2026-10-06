using System;
using System.IO;
using System.Threading;
using Newtonsoft.Json.Linq;
using LocalScenes;
using SmartHome.SceneConsumer;
public static class LocalStoreTests {
 static OfflineSceneValidator validator;
 static string source,rootDir;
 static readonly Guid Workspace=Guid.Parse("60000000-0000-4000-8000-000000000001");
 static readonly Guid Actor=Guid.Parse("60000000-0000-4000-8000-000000000002");
 static readonly Guid Product=Guid.Parse("40000000-0000-4000-8000-000000000002");
 static int count;
 static void Check(bool condition,string message) { SqliteTests.Check(condition,message); }
 static void Test(string name,Action action) { action(); count++; Console.WriteLine("PASS "+name); }
 static LocalSceneStore Store(string path,Guid? workspace=null,Guid? actor=null) { return new LocalSceneStore(path,workspace??Workspace,actor??Actor,validator); }
 static string Changed(string value) { var json=JObject.Parse(source); json["metadata"]["title"]=value; return json.ToString(); }
 static Guid Document(LocalSceneStore store) { store.Catalog(Product,"三人沙发",2400,950,850); return store.Create("两室一厅"); }
 static void Invalid(Action action) { try { action(); } catch(SceneValidationError) { return; } throw new Exception("invalid scene accepted"); }
 public static int Main(string[] args) {
  rootDir=Path.Combine(Path.GetTempPath(),"scene-store-tests-"+Guid.NewGuid()); Directory.CreateDirectory(rootDir);
  try { Run(args[0],args[1],rootDir); return 0; } catch(Exception e) { Console.Error.WriteLine(e); return 1; } finally { Directory.Delete(rootDir,true); }
 }
 public static void Run(string schema,string sample,string directory) {
  rootDir=directory; validator=new OfflineSceneValidator(File.ReadAllText(schema)); source=File.ReadAllText(sample);
  Test("create empty document, save v1/v2 and immutable snapshots",()=>{
   string path=Path.Combine(rootDir,"versions.sqlite");
   Guid id;
   using(var store=Store(path)) {
    id=Document(store); Check(store.Current(id)==null,"new state");
    var one=store.Put(id,0,source); Check(one.Revision==1&&one.CreatedBy==Actor&&one.WorkspaceId==Workspace,"v1/provenance");
    var two=store.Put(id,1,Changed("新的设计")); Check(two.Revision==2&&store.Current(id).Revision==2,"v2/pointer");
    Check(!store.ExportVersion(id,1).Contains("新的设计"),"old history overwritten");
    var rows=store.Versions(id,1,0); Check(rows.Count==1&&rows[0].Revision==2,"descending page");
    Check(store.Versions(id,1,1)[0].Revision==1&&store.Versions(id,1,2).Count==0,"offset");
    SqliteTests.Error(()=>store.Versions(id,0,0),LocalErrorCode.InvalidInput);
    SqliteTests.Error(()=>store.Put(id,0,source),LocalErrorCode.Conflict);
    SqliteTests.Error(()=>store.Restore(id,1,1),LocalErrorCode.Conflict);
    Check(store.Current(id).Revision==2&&store.Versions(id).Count==2,"conflict mutated state");
    var three=store.Restore(id,2,1);
    Check(three.Revision==3&&three.SceneJson==one.SceneJson,"restore did not append original snapshot");
    Check(store.Versions(id).Count==3,"history removed");
    var metadata=JObject.Parse(source); metadata["metadata"]["created_by"]="pretend-owner";
    Check(store.Put(id,3,metadata.ToString()).CreatedBy==Actor,"untrusted creator");
   }
   using(var reopened=Store(path)) Check(reopened.Current(id).Revision==4&&reopened.Versions(id).Count==4,"reopen lost state");
   using(var sql=new SqliteConnection(path)) {
    SqliteTests.Error(()=>sql.Execute("UPDATE scene_versions SET scene_data='{}' WHERE revision=1"),LocalErrorCode.Conflict);
    SqliteTests.Error(()=>sql.Execute("DELETE FROM scene_versions WHERE revision=1"),LocalErrorCode.Conflict);
   }
  });
  Test("full validation before save prevents any mutation",()=>{
   using(var store=Store(Path.Combine(rootDir,"invalid.sqlite"))) {
    Guid id=Document(store);
    Invalid(()=>store.Put(id,0,"{}"));
    var invalid=JObject.Parse(source); invalid["walls"][0]["height_mm"]=0;
    Invalid(()=>store.Put(id,0,invalid.ToString()));
    Check(store.Current(id)==null&&store.Versions(id).Count==0,"invalid save wrote data");
   }
  });
  Test("workspace and document isolation includes catalog references",()=>{
   string path=Path.Combine(rootDir,"scope.sqlite");
   using(var a=Store(path)) using(var b=Store(path,Guid.NewGuid())) {
    Guid aId=a.Create("A"),bId=Document(b);
    SqliteTests.Error(()=>a.Put(aId,0,source),LocalErrorCode.InvalidInput); // catalog belongs to B
    SqliteTests.Error(()=>a.Current(bId),LocalErrorCode.NotFound);
    SqliteTests.Error(()=>a.Versions(bId),LocalErrorCode.NotFound);
    SqliteTests.Error(()=>a.Put(bId,0,source),LocalErrorCode.NotFound);
    SqliteTests.Error(()=>a.Restore(bId,0,1),LocalErrorCode.NotFound);
    b.Put(bId,0,source); a.Catalog(Product,"本地商品",2400,950,850); a.Put(aId,0,Changed("A"));
    Guid empty=a.Create("empty");
    SqliteTests.Error(()=>a.Restore(empty,0,1),LocalErrorCode.NotFound);
    Check(a.Current(empty)==null,"restored other document history");
    SqliteTests.Error(()=>a.ExportVersion(aId,2),LocalErrorCode.NotFound);
   }
  });
  Test("history insert rolls back if current pointer update fails",()=>{
   string path=Path.Combine(rootDir,"rollback.sqlite");
   using(var store=Store(path)) using(var sql=new SqliteConnection(path)) {
    Guid id=Document(store); store.Put(id,0,source);
    sql.Execute("CREATE TRIGGER injected_fault BEFORE UPDATE OF current_revision ON scene_documents BEGIN SELECT RAISE(ABORT,'test fault'); END");
    SqliteTests.Error(()=>store.Put(id,1,Changed("should roll back")),LocalErrorCode.Conflict);
    Check(store.Current(id).Revision==1&&store.Versions(id).Count==1,"partial transaction");
   }
  });
  Test("restore revalidates damaged historical scene",()=>{
   string path=Path.Combine(rootDir,"corrupt-history.sqlite");
   using(var store=Store(path)) using(var sql=new SqliteConnection(path)) {
    Guid id=Document(store); store.Put(id,0,source); store.Put(id,1,Changed("valid latest"));
    sql.Execute("DROP TRIGGER scene_versions_no_update");
    sql.Execute("UPDATE scene_versions SET scene_data='{}' WHERE revision=1");
    Invalid(()=>store.Restore(id,2,1));
    Check(store.Current(id).Revision==2&&store.Versions(id).Count==2,"invalid restore advanced");
   }
  });
  Test("consistent backup reopens with every historical version",()=>{
   string path=Path.Combine(rootDir,"source.sqlite"),backup=Path.Combine(rootDir,"saved.sqlite");
   Guid id;
   using(var store=Store(path)) { id=Document(store); store.Put(id,0,source); store.Put(id,1,Changed("second")); store.Restore(id,2,1); store.BackupTo(backup); }
   using(var copy=Store(backup)) Check(copy.Current(id).Revision==3&&copy.Versions(id).Count==3&&copy.ExportVersion(id,1)==copy.ExportVersion(id,3),"backup incomplete");
  });
  Test("unsupported database format fails without modifying existing database",()=>{
   string path=Path.Combine(rootDir,"future.sqlite");
   using(var sql=new SqliteConnection(path)) { sql.Execute("PRAGMA user_version=99"); sql.Execute("CREATE TABLE preserved(n INTEGER)"); sql.Execute("INSERT INTO preserved VALUES(17)"); }
   SqliteTests.Error(()=>{using(var ignored=Store(path)) {}},LocalErrorCode.Corrupt);
   using(var sql=new SqliteConnection(path)) Check((long)sql.Query("SELECT n FROM preserved")[0]["n"]==17,"future DB changed");
  });
  Test("customer removal hides linked work and restore preserves it",()=>{
   string path=Path.Combine(rootDir,"customer-removal.sqlite");Guid customer,project,scene;
   using(var store=Store(path)) {
    var created=store.CreateCustomer("待清理客户","13800000000");customer=created.Id;
    project=store.CreateProject(customer,"客厅项目").Id;
    scene=store.CreateForProject(project,"客厅方案");
    store.DeleteCustomer(customer,created.Revision);
    Check(store.Customers().Total==0&&store.DeletedCustomers().Total==1,"removed customer still visible");
    SqliteTests.Error(()=>store.Customer(customer),LocalErrorCode.NotFound);
    SqliteTests.Error(()=>store.Projects(customer),LocalErrorCode.NotFound);
    SqliteTests.Error(()=>store.ProjectScenes(project),LocalErrorCode.NotFound);
    SqliteTests.Error(()=>store.DeleteCustomer(customer,created.Revision),LocalErrorCode.Conflict);
   }
   using(var store=Store(path)) {
    var removed=store.DeletedCustomers().Items[0];
    var restored=store.RestoreCustomer(customer,removed.Revision);
    Check(restored.Id==customer&&store.Customers().Total==1,"restore lost customer");
    Check(store.Projects(customer).Items[0].Id==project&&store.ProjectScenes(project).Items[0].Id==scene,"restore lost linked work");
    SqliteTests.Error(()=>store.RestoreCustomer(customer,removed.Revision),LocalErrorCode.Conflict);
   }
  });
  Test("removed customer phone may be reused but restore reports conflict",()=>{
   using(var store=Store(Path.Combine(rootDir,"customer-phone-reuse.sqlite"))) {
    var former=store.CreateCustomer("甲","13900000000");
    store.DeleteCustomer(former.Id,former.Revision);
    store.CreateCustomer("乙","13900000000");
    var removed=store.DeletedCustomers().Items[0];
    SqliteTests.Error(()=>store.RestoreCustomer(former.Id,removed.Revision),LocalErrorCode.Conflict);
    Check(store.Customers().Total==1&&store.DeletedCustomers().Total==1,"conflict changed customer state");
   }
  });
  Test("independent-connection first save race has exactly one winner",()=>Race("first",0,false,false));
  Test("independent-connection update race has exactly one winner",()=>Race("update",1,false,false));
  Test("independent-connection restore/update race has exactly one winner",()=>Race("mixed",2,true,false));
  Test("independent-connection restore race has exactly one winner",()=>Race("restore",2,true,true));
  Console.WriteLine("Local scene store: "+count+" passed");
 }
 static void Race(string name,long baseline,bool leftRestore,bool rightRestore) {
  for(int attempt=0;attempt<6;attempt++) {
   string path=Path.Combine(rootDir,name+attempt+".sqlite");
   Guid id;
   using(var init=Store(path)) { id=Document(init); if(baseline>0) init.Put(id,0,source); if(baseline>1) init.Put(id,1,Changed("before")); }
   using(var left=Store(path)) using(var right=Store(path,null,Guid.NewGuid())) using(var ready=new CountdownEvent(2)) using(var start=new ManualResetEvent(false)) {
    Exception[] failures=new Exception[2]; long[] results=new long[2];
    ThreadStart task0=()=>{ ready.Signal(); start.WaitOne(); try { results[0]=(leftRestore?left.Restore(id,baseline,1):left.Put(id,baseline,Changed("left"))).Revision; } catch(Exception e) { failures[0]=e; } };
    ThreadStart task1=()=>{ ready.Signal(); start.WaitOne(); try { results[1]=(rightRestore?right.Restore(id,baseline,1):right.Put(id,baseline,Changed("right"))).Revision; } catch(Exception e) { failures[1]=e; } };
    var a=new Thread(task0); var b=new Thread(task1); a.Start(); b.Start();
    Check(ready.Wait(5000),"race workers not ready"); start.Set(); Check(a.Join(10000)&&b.Join(10000),"race did not finish");
    int winner=results[0]>0?0:1,loser=1-winner;
    Check(results[winner]==baseline+1&&results[loser]==0,"duplicate winners");
    var error=failures[loser] as LocalStoreError; Check(error!=null&&error.Code==LocalErrorCode.Conflict,"race should return conflict, not 500 or partial data");
    Check(left.Current(id).Revision==baseline+1&&left.Versions(id).Count==baseline+1,"race lost history");
   }
  }
 }
}
