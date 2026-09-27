using System;
using System.IO;
using LocalScenes;
public static class LocalWorkspaceTests {
 static int passed;
 static void Check(bool value,string message) { if(!value) throw new Exception(message); }
 static void Test(string name,Action body) { body(); passed++; Console.WriteLine("PASS "+name); }
 static void Reject(Action body,LocalErrorCode code) { try { body(); } catch(LocalStoreError e) { Check(e.Code==code,"wrong error"); return; } throw new Exception("accepted invalid operation"); }
 public static void Run(string schema,string directory) {
  var validator=new SmartHome.SceneConsumer.OfflineSceneValidator(File.ReadAllText(schema));
  Test("local identity survives restart and separate openings",()=>{
   string path=Path.Combine(directory,"identity.sqlite");
   var first=LocalIdentity.Open(path); var second=LocalIdentity.Open(path);
   Check(first.WorkspaceId!=Guid.Empty&&first.ActorId!=Guid.Empty,"empty identity");
   Check(first.WorkspaceId==second.WorkspaceId&&first.ActorId==second.ActorId,"restart lost identity");
  });
  Test("existing single workspace is adopted without hiding documents",()=>{
   string path=Path.Combine(directory,"adopt.sqlite"); Guid workspace=Guid.NewGuid(),id;
   using(var store=new LocalSceneStore(path,workspace,Guid.NewGuid(),validator)) id=store.Create("已有方案");
   var identity=LocalIdentity.Open(path);
   Check(identity.WorkspaceId==workspace,"existing workspace hidden");
   using(var store=new LocalSceneStore(path,identity.WorkspaceId,identity.ActorId,validator))
    Check(store.Documents().Items[0].Id==id,"existing data lost");
  });
  Test("ambiguous identity fails safely without altering user data",()=>{
   string path=Path.Combine(directory,"ambiguous.sqlite");
   using(var store=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) store.Create("甲");
   using(var store=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) store.Create("乙");
   Reject(()=>LocalIdentity.Open(path),LocalErrorCode.Corrupt);
   using(var db=new SqliteConnection(path)) Check((long)db.Query("SELECT COUNT(*) n FROM scene_documents")[0]["n"]==2,"data changed");
  });
  Test("catalog-only existing workspace also survives identity adoption",()=>{
   string path=Path.Combine(directory,"catalog-only.sqlite"); Guid workspace=Guid.NewGuid();
   using(var store=new LocalSceneStore(path,workspace,Guid.NewGuid(),validator)) store.Catalog(Guid.NewGuid(),"沙发",1,2,3);
   Check(LocalIdentity.Open(path).WorkspaceId==workspace,"catalog workspace ignored");
  });
  Test("unsupported format identity refuses write",()=>{
   string path=Path.Combine(directory,"future-identity.sqlite");
   using(var db=new SqliteConnection(path)) db.Execute("PRAGMA user_version=99");
   Reject(()=>LocalIdentity.Open(path),LocalErrorCode.Corrupt);
   using(var db=new SqliteConnection(path)) Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==99,"format changed");
  });
  Test("library pagination total and deterministic ordering are scoped",()=>{
   string path=Path.Combine(directory,"library.sqlite"); Guid workspace=Guid.NewGuid(); Guid[] ids=new Guid[25];
   using(var store=new LocalSceneStore(path,workspace,Guid.NewGuid(),validator)) {
    for(int i=0;i<25;i++) ids[i]=store.Create("方案"+i);
    using(var other=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) other.Create("不能看到");
    var first=store.Documents(); var second=store.Documents(20,20);
    Check(first.Total==25&&first.Items.Count==20&&second.Total==25&&second.Items.Count==5,"pagination");
    Guid previous=Guid.Empty; var seen=new System.Collections.Generic.HashSet<Guid>();
    foreach(var page in new[]{first,second}) foreach(var row in page.Items) {
     Check(seen.Add(row.Id),"duplicate page"); Check(row.Revision==0&&row.UpdatedAt==null,"empty state");
     Check(previous==Guid.Empty||String.CompareOrdinal(previous.ToString("D"),row.Id.ToString("D"))<0,"unstable sort"); previous=row.Id;
    }
    Check(store.Documents(20,40).Items.Count==0,"out of range");
    Reject(()=>store.Documents(0),LocalErrorCode.InvalidInput); Reject(()=>store.Documents(101),LocalErrorCode.InvalidInput);
    Reject(()=>store.Documents(20,-1),LocalErrorCode.InvalidInput);
   }
  });
  Test("damaged identity is never silently reset",()=>{
   string path=Path.Combine(directory,"damaged-identity.sqlite"); LocalIdentity.Open(path);
   using(var db=new SqliteConnection(path)) db.Execute("UPDATE local_identity SET actor_id='not-an-id'");
   Reject(()=>LocalIdentity.Open(path),LocalErrorCode.Corrupt);
  });
  Console.WriteLine("Local workspace: "+passed+" passed");
 }
 public static int Main(string[] args) {
  string dir=Path.Combine(Path.GetTempPath(),"workspace-tests-"+Guid.NewGuid()); Directory.CreateDirectory(dir);
  try { Run(args[0],dir); return 0; } catch(Exception e) { Console.Error.WriteLine(e); return 1; } finally { Directory.Delete(dir,true); }
 }
}
