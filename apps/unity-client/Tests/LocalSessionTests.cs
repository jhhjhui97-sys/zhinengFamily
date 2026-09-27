using System;
using System.IO;
using System.Linq;
using LocalScenes;
using SmartHome.SceneConsumer;
using Newtonsoft.Json.Linq;
public static class LocalSessionTests {
 static int passed;
 static void Check(bool v,string msg) { if(!v) throw new Exception(msg); }
 static void Test(string name,Action<LocalSceneStore,LocalSceneSession,string> body,string schema,string sample,string dir) {
  string path=Path.Combine(dir,"session-"+Guid.NewGuid()+".sqlite");
  var validator=new OfflineSceneValidator(File.ReadAllText(schema)); var identity=LocalIdentity.Open(path);
  using(var store=new LocalSceneStore(path,identity.WorkspaceId,identity.ActorId,validator))
   body(store,new LocalSceneSession(store,validator,File.ReadAllText(sample)),path);
  passed++; Console.WriteLine("PASS "+name);
 }
 public static void Run(string schema,string sample,string dir) {
  Test("scene session saves v1 edits v2 restores v3 and survives restart",(store,s,path)=>{
   Check(s.New("龙湖小区120㎡")&&s.BaseRevision==0&&s.Draft=="","empty new");
   Check(s.LoadSample()&&s.Dirty,"sample missing"); Check(s.Preview().Copy()["rooms"].Count()==3,"not two bedroom");
   Check(s.Save()&&s.BaseRevision==1&&!s.Dirty&&s.SavedAt!=null,"v1");
   Guid id=s.DocumentId,room=Guid.Parse((string)JObject.Parse(s.Draft)["rooms"][0]["id"]);
   Check(s.ChangeRoomName(room,"明亮客厅")&&s.Save()&&s.BaseRevision==2,"v2");
   string draft=s.Draft;
   Check(s.ViewHistory(1)&&s.HistoryRevision==1&&s.HistoryJson.Contains("客厅"),"history");
   Check(s.Draft==draft&&s.BaseRevision==2,"history overwrote draft");
   Check(s.Restore(1)&&s.BaseRevision==3,"restore v3");
   Check((string)JObject.Parse(s.Draft)["rooms"][0]["name"]=="客厅","wrong restored content");
   var identity=LocalIdentity.Open(path);
   using(var reopened=new LocalSceneStore(path,identity.WorkspaceId,identity.ActorId,new OfflineSceneValidator(File.ReadAllText(schema)))) {
    var again=new LocalSceneSession(reopened,new OfflineSceneValidator(File.ReadAllText(schema)),File.ReadAllText(sample));
    Check(again.Open(id)&&again.BaseRevision==3&&reopened.Versions(id).Count==3,"restart");
   }
  },schema,sample,dir);
  Test("dirty draft refuses switching reload sample and restore until explicit discard",(store,s,path)=>{
   Check(s.New("甲")&&s.LoadSample()&&s.Save(),"setup"); Guid first=s.DocumentId,other=store.Create("乙");
   s.SetDraft(s.Draft+" ");
   string draft=s.Draft;
   Check(!s.Open(other)&&!s.New("丙")&&!s.LoadSample()&&!s.Restore(1)&&!s.Open(first),"silent discard");
   Check(s.Draft==draft&&s.DocumentId==first&&store.Documents().Total==2&&store.Versions(first).Count==1,"failure changed data");
   Check(s.Open(other,true)&&s.DocumentId==other&&!s.Dirty,"explicit discard");
  },schema,sample,dir);
  Test("invalid input never commits and preserves draft and baseline",(store,s,path)=>{
   s.New("校验"); s.SetDraft("{\"x\":1e400}");
   Check(!s.Save()&&s.BaseRevision==0&&s.Dirty&&s.Draft=="{\"x\":1e400}"&&store.Current(s.DocumentId)==null,"invalid saved");
   Check(s.Preview()==null&&s.Message.Contains("格式"),"unsafe feedback");
   s.SetDraft("{}"); Check(!s.Save()&&store.Versions(s.DocumentId).Count==0,"empty object saved");
  },schema,sample,dir);
  Test("conflict keeps unsaved content and stale baseline",(store,s,path)=>{
   s.New("冲突"); s.LoadSample(); s.Save();
   s.SetDraft(s.Draft+" "); string draft=s.Draft;
   store.Put(s.DocumentId,1,s.CurrentJson);
   Check(!s.Save()&&s.BaseRevision==1&&s.Draft==draft&&s.Dirty&&s.Message.Contains("其他操作"),"conflict rebase");
   Check(store.Current(s.DocumentId).Revision==2&&store.Versions(s.DocumentId).Count==2,"conflict overwrote");
   Check(!s.Open(s.DocumentId)&&s.Open(s.DocumentId,true)&&s.BaseRevision==2,"explicit reload");
  },schema,sample,dir);
  Test("failed SQL transaction retains draft without phantom revision",(store,s,path)=>{
   s.New("磁盘"); s.LoadSample(); string draft=s.Draft;
   using(var db=new SqliteConnection(path)) db.Execute("CREATE TRIGGER fail_ui_save BEFORE INSERT ON scene_versions BEGIN SELECT RAISE(ABORT,'secret-internal-error'); END");
   Check(!s.Save()&&s.Draft==draft&&s.Dirty&&s.BaseRevision==0&&store.Current(s.DocumentId)==null,"failed save damaged state");
   Check(!s.Message.Contains("secret")&&!s.Message.Contains(path),"internal details leaked");
  },schema,sample,dir);
  Test("clean draft duplicate submission cannot append history",(store,s,path)=>{
   s.New("重复"); s.LoadSample(); Check(s.Save(),"first save"); Check(!s.Save(),"duplicate accepted");
   Check(store.Versions(s.DocumentId).Count==1,"duplicate version");
  },schema,sample,dir);
  Test("room edit preserves full scene metadata and rejects invalid room names",(store,s,path)=>{
   s.New("房名"); s.LoadSample(); string before=s.Draft;
   Check(!s.ChangeRoomName(Guid.NewGuid(),"错误")&&s.Draft==before,"unknown room mutation");
   Guid room=Guid.Parse((string)JObject.Parse(before)["rooms"][0]["id"]);
   Check(!s.ChangeRoomName(room,"")&&s.Draft==before,"blank room accepted");
   Check(s.ChangeRoomName(room,"温馨客厅"),"valid room edit");
   Check(JObject.Parse(s.Draft)["furniture_instances"].Count()==1&&
    (bool)JObject.Parse(s.Draft)["metadata"]["offline_catalog_only"],"unrelated data lost");
  },schema,sample,dir);
  Test("history selection errors do not corrupt current or previous history view",(store,s,path)=>{
   s.New("历史"); s.LoadSample(); s.Save(); s.ViewHistory(1);
   string json=s.HistoryJson,draft=s.Draft;
   Check(!s.ViewHistory(999)&&s.HistoryJson==json&&s.Draft==draft&&s.BaseRevision==1,"failed history corrupted state");
  },schema,sample,dir);
  Test("open missing document preserves active draft",(store,s,path)=>{
   s.New("当前"); s.LoadSample(); s.Save(); Guid id=s.DocumentId; string draft=s.Draft;
   Check(!s.Open(Guid.NewGuid())&&s.DocumentId==id&&s.Draft==draft,"failed open damaged current");
  },schema,sample,dir);
  Test("sample loading is scoped and gives each document its own scene id",(store,s,path)=>{
   s.New("一"); s.LoadSample(); s.Save(); string first=(string)JObject.Parse(s.Draft)["scene_id"];
   s.New("二"); s.LoadSample(); s.Save(); string second=(string)JObject.Parse(s.Draft)["scene_id"];
   Check(first!=second&&store.Documents().Total==2,"sample document identity shared");
  },schema,sample,dir);
  Console.WriteLine("Local session: "+passed+" passed");
 }
 public static int Main(string[] args) {
  string dir=Path.Combine(Path.GetTempPath(),"session-tests-"+Guid.NewGuid()); Directory.CreateDirectory(dir);
  try { Run(args[0],args[1],dir); return 0; } catch(Exception e) { Console.Error.WriteLine(e); return 1; } finally { Directory.Delete(dir,true); }
 }
}
