using System;
using System.IO;
using System.Security.Cryptography;
using System.Threading;
using Newtonsoft.Json.Linq;
using LocalScenes;
using SmartHome.SceneConsumer;

public static class LocalModelAssetTests {
 static int passed;
 static void Check(bool condition,string message) { if(!condition) throw new Exception(message); }
 static void Test(string label,Action body) { body();passed++;Console.WriteLine("PASS "+label); }
 static void Reject(Action action,LocalErrorCode code) { SqliteTests.Error(action,code); }
 static string AddFile(string database,string source) {
  byte[] bytes=File.ReadAllBytes(source);string hash;
  using(var sha=SHA256.Create()) hash=BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();
  string directory=Path.Combine(Path.GetDirectoryName(database),"models");Directory.CreateDirectory(directory);
  File.WriteAllBytes(Path.Combine(directory,hash+".glb"),bytes);return hash;
 }
 public static void Run(string schema,string sample,string directory) {
  var validator=new OfflineSceneValidator(File.ReadAllText(schema));
  string sofa="apps/windows-local/public/assets/sofa.glb",chair="apps/windows-local/public/assets/chair.glb";
  Test("fresh v4 database does not create a recovery backup",()=>{
   string path=Path.Combine(directory,"model-fresh.sqlite");Guid ws=Guid.NewGuid();
   using(var store=new LocalSceneStore(path,ws,Guid.NewGuid(),validator)) Check(store.LocalProducts().Total==0,"fresh catalog not empty");
   using(var db=new SqliteConnection(path)) Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==4,"fresh model format wrong");
   Check(Directory.GetFiles(directory,"model-fresh.sqlite.pre-v*.bak").Length==0,"fresh DB made recovery backup");
  });
  Test("v3 model migration preserves products and creates restorable pre-v4 backup",()=>{
   string path=Path.Combine(directory,"model-v3.sqlite");Guid ws=Guid.NewGuid(),actor=Guid.NewGuid(),product;
   using(var store=new LocalSceneStore(path,ws,actor,validator)) product=store.CreateLocalProduct("sofa","品牌","三人沙发","S1","6800.50",2400,950,850).Id;
   using(var db=new SqliteConnection(path)) { db.Execute("DROP TABLE IF EXISTS local_product_active_model");db.Execute("DROP TABLE IF EXISTS local_model_assets");db.Execute("PRAGMA user_version=3"); }
   using(var upgraded=new LocalSceneStore(path,ws,actor,validator)) Check(upgraded.LocalProduct(product).Sku=="S1"&&upgraded.LocalProduct(product).ActiveAssetId==null,"v3 product lost");
   string[] backups=Directory.GetFiles(directory,"model-v3.sqlite.pre-v4-*.bak");Check(backups.Length==1,"pre-v4 backup absent");
   string copy=Path.Combine(directory,"model-v3-restored.sqlite");File.Copy(backups[0],copy);
   using(var restored=new LocalSceneStore(copy,ws,actor,validator)) Check(restored.LocalProduct(product).Sku=="S1","pre-v4 backup cannot be restored");
  });
  Test("failed v4 migration rolls back and preserves the v3 product",()=>{
   string path=Path.Combine(directory,"model-failed-v4.sqlite");Guid ws=Guid.NewGuid(),actor=Guid.NewGuid(),product;
   using(var store=new LocalSceneStore(path,ws,actor,validator)) product=store.CreateLocalProduct("sofa","品牌","沙发","S1","100.00",2400,950,850).Id;
   using(var db=new SqliteConnection(path)) {
    db.Execute("DROP TABLE local_product_active_model");db.Execute("DROP TABLE local_model_assets");
    db.Execute("PRAGMA user_version=3");db.Execute("CREATE TABLE local_model_assets(broken INTEGER)");
   }
   bool failed=false;try { using(var ignored=new LocalSceneStore(path,ws,actor,validator)) {} } catch { failed=true; }
   Check(failed,"invalid v4 migration was accepted");
   using(var db=new SqliteConnection(path)) {
    Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==3,"failed v4 migration advanced format");
    Check((long)db.Query("SELECT COUNT(*) n FROM local_products WHERE id=?",product.ToString("D"))[0]["n"]==1,"failed v4 migration lost product");
    Check(db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name='local_product_active_model'").Count==0,"failed v4 migration left pointer table");
   }
   Check(Directory.GetFiles(directory,"model-failed-v4.sqlite.pre-v4-*.bak").Length==1,"failed v4 migration lacked backup");
  });
  Test("asset attachment pins scene history and enforces product and workspace ownership",()=>{
   string path=Path.Combine(directory,"model-assets.sqlite");Guid ws=Guid.NewGuid(),actor=Guid.NewGuid(),product,other,scene;
   string hash=AddFile(path,sofa),replacement=AddFile(path,chair);
   using(var store=new LocalSceneStore(path,ws,actor,validator)) {
    product=store.CreateLocalProduct("sofa","品牌","三人沙发","S1","6800.50",2400,950,850).Id;
    other=store.CreateLocalProduct("chair","品牌","单人椅","C1","800.00",800,800,900).Id;
    var first=store.AttachLocalModel(product,1,hash,new FileInfo(Path.Combine(directory,"models",hash+".glb")).Length);
    Check(store.LocalProduct(product).ActiveAssetId==first.Id&&store.LocalProduct(product).Revision==2,"first attach did not update product");
    Reject(()=>store.AttachLocalModel(product,1,replacement,new FileInfo(Path.Combine(directory,"models",replacement+".glb")).Length),LocalErrorCode.Conflict);
    var original=JObject.Parse(File.ReadAllText(sample));
    original["furniture_instances"][0]["product_id"]=product.ToString("D");
    original["furniture_instances"][0]["asset_id"]=first.Id.ToString("D");
    scene=store.Create("带真实 SKU 的方案");store.Put(scene,0,original.ToString());
    var forged=(JObject)original.DeepClone();forged["furniture_instances"][0]["product_id"]=other.ToString("D");
    Reject(()=>store.Put(scene,1,forged.ToString()),LocalErrorCode.InvalidInput);
    var second=store.AttachLocalModel(product,2,replacement,new FileInfo(Path.Combine(directory,"models",replacement+".glb")).Length);
    var current=JObject.Parse(store.ExportVersion(scene,1));current["furniture_instances"][0]["asset_id"]=second.Id.ToString("D");
    store.Put(scene,1,current.ToString());
    Check((string)JObject.Parse(store.ExportVersion(scene,1))["furniture_instances"][0]["asset_id"]==first.Id.ToString("D"),"v1 asset changed");
    Check((string)JObject.Parse(store.ExportVersion(scene,2))["furniture_instances"][0]["asset_id"]==second.Id.ToString("D"),"v2 asset not pinned");
   }
   using(var different=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
    Reject(()=>different.LocalProduct(product),LocalErrorCode.NotFound);
    Reject(()=>different.AttachLocalModel(product,3,hash,1),LocalErrorCode.NotFound);
   }
  });
  Test("missing or tampered model bytes cannot link and failed transaction leaves product unchanged",()=>{
   string path=Path.Combine(directory,"model-invalid.sqlite");Guid ws=Guid.NewGuid();
   string hash=AddFile(path,sofa);long bytes=new FileInfo(Path.Combine(directory,"models",hash+".glb")).Length;
   using(var store=new LocalSceneStore(path,ws,Guid.NewGuid(),validator)) {
    Guid product=store.CreateLocalProduct("sofa","品牌","沙发","S1","100.00",2400,950,850).Id;
    Reject(()=>store.AttachLocalModel(product,1,new string('0',64),bytes),LocalErrorCode.InvalidInput);
    Reject(()=>store.AttachLocalModel(product,1,hash,bytes+1),LocalErrorCode.InvalidInput);
    using(var db=new SqliteConnection(path)) db.Execute("CREATE TRIGGER fail_attach BEFORE INSERT ON local_product_active_model BEGIN SELECT RAISE(ABORT,'test fault'); END");
    bool failed=false;try { store.AttachLocalModel(product,1,hash,bytes); } catch { failed=true; }
    Check(failed&&store.LocalProduct(product).Revision==1&&store.LocalProduct(product).ActiveAssetId==null,"partial model attachment");
    using(var db=new SqliteConnection(path)) {Check((long)db.Query("SELECT COUNT(*) n FROM local_model_assets")[0]["n"]==0,"failed attach left asset");db.Execute("DROP TRIGGER fail_attach");}
    var asset=store.AttachLocalModel(product,1,hash,bytes);
    File.WriteAllBytes(Path.Combine(directory,"models",hash+".glb"),new byte[]{1,2,3});
    Reject(()=>store.VerifiedModelPath(asset.Id),LocalErrorCode.NotFound);
   }
  });
  Test("independent transactions race to attach at one product revision",()=>{
   string path=Path.Combine(directory,"model-race.sqlite");Guid ws=Guid.NewGuid(),product;
   string first=AddFile(path,sofa),second=AddFile(path,chair);
   long firstBytes=new FileInfo(Path.Combine(directory,"models",first+".glb")).Length,secondBytes=new FileInfo(Path.Combine(directory,"models",second+".glb")).Length;
   using(var setup=new LocalSceneStore(path,ws,Guid.NewGuid(),validator)) product=setup.CreateLocalProduct("sofa","品牌","沙发","S1","100.00",2400,950,850).Id;
   using(var left=new LocalSceneStore(path,ws,Guid.NewGuid(),validator))using(var right=new LocalSceneStore(path,ws,Guid.NewGuid(),validator))using(var ready=new CountdownEvent(2))using(var start=new ManualResetEvent(false)) {
    Exception[] errors=new Exception[2];Guid[] winners=new Guid[2];
    Thread a=new Thread(()=>{ready.Signal();start.WaitOne();try{winners[0]=left.AttachLocalModel(product,1,first,firstBytes).Id;}catch(Exception e){errors[0]=e;}});
    Thread b=new Thread(()=>{ready.Signal();start.WaitOne();try{winners[1]=right.AttachLocalModel(product,1,second,secondBytes).Id;}catch(Exception e){errors[1]=e;}});
    a.Start();b.Start();Check(ready.Wait(5000),"attach race not ready");start.Set();Check(a.Join(10000)&&b.Join(10000),"attach race stuck");
    Check((winners[0]!=Guid.Empty)^(winners[1]!=Guid.Empty),"attach race had zero or two winners");
    int loser=winners[0]==Guid.Empty?0:1;Check(errors[loser] is LocalStoreError&&((LocalStoreError)errors[loser]).Code==LocalErrorCode.Conflict,"attach race loser not conflict");
    Check(left.LocalProduct(product).Revision==2&&left.LocalProduct(product).ActiveAssetId==winners[1-loser],"attach race pointer wrong");
    using(var db=new SqliteConnection(path)) Check((long)db.Query("SELECT COUNT(*) n FROM local_model_assets")[0]["n"]==1,"attach race left extra asset");
   }
  });
  Console.WriteLine("Local model assets: "+passed+" passed");
 }
}
