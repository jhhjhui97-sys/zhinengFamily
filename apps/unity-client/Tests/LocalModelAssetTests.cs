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
  Test("fresh current database does not create a recovery backup",()=>{
   string path=Path.Combine(directory,"model-fresh.sqlite");Guid ws=Guid.NewGuid();
   using(var store=new LocalSceneStore(path,ws,Guid.NewGuid(),validator)) Check(store.LocalProducts().Total==0,"fresh catalog not empty");
   using(var db=new SqliteConnection(path)) Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==8,"fresh model format wrong");
   Check(Directory.GetFiles(directory,"model-fresh.sqlite.pre-v*.bak").Length==0,"fresh DB made recovery backup");
  });
  Test("v3 model migration preserves products and creates restorable pre-v4 backup",()=>{
   string path=Path.Combine(directory,"model-v3.sqlite");Guid ws=Guid.NewGuid(),actor=Guid.NewGuid(),product;
   using(var store=new LocalSceneStore(path,ws,actor,validator)) product=store.CreateLocalProduct("sofa","品牌","三人沙发","S1","6800.50",2400,950,850).Id;
   using(var db=new SqliteConnection(path)) { foreach(string table in new[]{"local_order_events","local_order_state","local_order_exclusions","local_order_lines","local_orders"})db.Execute("DROP TABLE IF EXISTS "+table);db.Execute("DROP TABLE IF EXISTS local_quotation_exclusions");db.Execute("DROP TABLE IF EXISTS local_quotation_lines");db.Execute("DROP TABLE IF EXISTS local_quotations");db.Execute("DROP TABLE IF EXISTS local_product_active_model");db.Execute("DROP TABLE IF EXISTS local_model_assets");db.Execute("PRAGMA user_version=3"); }
   using(var upgraded=new LocalSceneStore(path,ws,actor,validator)) Check(upgraded.LocalProduct(product).Sku=="S1"&&upgraded.LocalProduct(product).ActiveAssetId==null,"v3 product lost");
   string[] backups=Directory.GetFiles(directory,"model-v3.sqlite.pre-v4-*.bak");Check(backups.Length==1,"pre-v4 backup absent");
   string copy=Path.Combine(directory,"model-v3-restored.sqlite");File.Copy(backups[0],copy);
   using(var restored=new LocalSceneStore(copy,ws,actor,validator)) Check(restored.LocalProduct(product).Sku=="S1","pre-v4 backup cannot be restored");
  });
  Test("failed v4 migration rolls back and preserves the v3 product",()=>{
   string path=Path.Combine(directory,"model-failed-v4.sqlite");Guid ws=Guid.NewGuid(),actor=Guid.NewGuid(),product;
   using(var store=new LocalSceneStore(path,ws,actor,validator)) product=store.CreateLocalProduct("sofa","品牌","沙发","S1","100.00",2400,950,850).Id;
   using(var db=new SqliteConnection(path)) {
    foreach(string table in new[]{"local_order_events","local_order_state","local_order_exclusions","local_order_lines","local_orders"})db.Execute("DROP TABLE IF EXISTS "+table);db.Execute("DROP TABLE IF EXISTS local_quotation_exclusions");db.Execute("DROP TABLE IF EXISTS local_quotation_lines");db.Execute("DROP TABLE IF EXISTS local_quotations");
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
    Check(store.LocalModelProducts().Count==0,"damaged active model remained available for placement");
    Check(store.LocalCatalogProducts().Count==1&&store.LocalCatalogProducts()[0].Id==product,"damaged model incorrectly hid the product dimension fallback");
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
  Test("model product creation commits the product and its active asset together",()=>{
   string path=Path.Combine(directory,"model-create.sqlite");Guid ws=Guid.NewGuid(),actor=Guid.NewGuid(),id;
   string hash=AddFile(path,sofa);long bytes=new FileInfo(Path.Combine(directory,"models",hash+".glb")).Length;
   using(var store=new LocalSceneStore(path,ws,actor,validator)) {
    var product=store.CreateLocalProductWithModel("sofa","品牌","导入沙发","IMPORT-S1","6800.50",2400,950,850,"{\"color\":\"灰\"}",hash,bytes);id=product.Id;
    Check(product.Revision==2&&product.ActiveAssetId.HasValue&&product.MetadataJson.Contains("灰"),"created product was only partly attached");
    var asset=store.ModelAsset(product.ActiveAssetId.Value);Check(asset.ProductId==product.Id&&asset.Sha256==hash&&asset.ByteCount==bytes,"new product asset differs from uploaded bytes");
    Check(store.LocalModelProducts().Count==1&&store.LocalCatalogProducts().Count==1,"imported product not available immediately");
    store.VerifiedModelPath(asset.Id);
   }
   using(var store=new LocalSceneStore(path,ws,actor,validator)) Check(store.LocalProduct(id).ActiveAssetId.HasValue,"imported product missing after restart");
  });
  Test("invalid model inputs and duplicate SKU leave no partially created product",()=>{
   string path=Path.Combine(directory,"model-create-invalid.sqlite");string hash=AddFile(path,sofa);
   long bytes=new FileInfo(Path.Combine(directory,"models",hash+".glb")).Length;
   using(var store=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
    Reject(()=>store.CreateLocalProductWithModel("sofa","品牌","导入沙发","IMPORT-S1","100.00",2400,950,850,"{}",new string('0',64),bytes),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateLocalProductWithModel("sofa","品牌","导入沙发","IMPORT-S1","100.00",2400,950,850,"{}",hash,bytes+1),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateLocalProductWithModel("sofa","品牌","导入沙发","IMPORT-S1","100.00",2400,950,850,"[]",hash,bytes),LocalErrorCode.InvalidInput);
    Check(store.LocalProducts().Total==0,"invalid import left a product");
    var existing=store.CreateLocalProduct("sofa","品牌","已有沙发","IMPORT-S1","100.00",2400,950,850);
    Reject(()=>store.CreateLocalProductWithModel("sofa","品牌","重复商品","IMPORT-S1","200.00",2400,950,850,"{}",hash,bytes),LocalErrorCode.Conflict);
    Check(store.LocalProducts().Total==1&&store.LocalProduct(existing.Id).Revision==1&&store.LocalProduct(existing.Id).ActiveAssetId==null,"duplicate import changed existing product");
    using(var db=new SqliteConnection(path))Check((long)db.Query("SELECT COUNT(*) n FROM local_model_assets")[0]["n"]==0,"invalid import left an asset");
   }
  });
  Test("SQL attachment failure rolls back model product creation and permits retry",()=>{
   string path=Path.Combine(directory,"model-create-failed.sqlite");string hash=AddFile(path,sofa);
   long bytes=new FileInfo(Path.Combine(directory,"models",hash+".glb")).Length;
   using(var store=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
    using(var db=new SqliteConnection(path))db.Execute("CREATE TRIGGER fail_create_model BEFORE INSERT ON local_product_active_model BEGIN SELECT RAISE(ABORT,'test fault'); END");
    Reject(()=>store.CreateLocalProductWithModel("sofa","品牌","导入沙发","IMPORT-S1","100.00",2400,950,850,"{}",hash,bytes),LocalErrorCode.Conflict);
    Check(store.LocalProducts().Total==0&&store.LocalCatalogProducts().Count==0,"failed import left a product in active lists");
    using(var db=new SqliteConnection(path)) {
     Check((long)db.Query("SELECT COUNT(*) n FROM local_products")[0]["n"]==0,"failed import left an invisible product");
     Check((long)db.Query("SELECT COUNT(*) n FROM local_model_assets")[0]["n"]==0,"failed import left an asset");
     Check((long)db.Query("SELECT COUNT(*) n FROM local_product_active_model")[0]["n"]==0,"failed import left an active pointer");
     db.Execute("DROP TRIGGER fail_create_model");
    }
    Check(store.CreateLocalProductWithModel("sofa","品牌","导入沙发","IMPORT-S1","100.00",2400,950,850,"{}",hash,bytes).ActiveAssetId.HasValue,"rolled back SKU blocked retry");
   }
  });
  Test("deleting a model product retains immutable assets saved scenes quotations and orders",()=>{
   string path=Path.Combine(directory,"model-delete-history.sqlite");Guid ws=Guid.NewGuid();string hash=AddFile(path,sofa);
   long bytes=new FileInfo(Path.Combine(directory,"models",hash+".glb")).Length;
   using(var store=new LocalSceneStore(path,ws,Guid.NewGuid(),validator)) {
    var product=store.CreateLocalProductWithModel("sofa","品牌","历史沙发","DELETE-S1","6800.50",2400,950,850,"{}",hash,bytes);
    var customer=store.CreateCustomer("历史客户");var project=store.CreateProject(customer.Id,"历史项目");Guid scene=store.CreateForProject(project.Id,"历史方案");
    var draft=JObject.Parse(File.ReadAllText(sample));var item=(JObject)draft["furniture_instances"][0];
    item["product_id"]=product.Id.ToString("D");item["asset_id"]=product.ActiveAssetId.Value.ToString("D");draft["furniture_instances"]=new JArray(item);
    string saved=store.Put(scene,0,draft.ToString()).SceneJson;
    var quote=store.CreateQuotation(customer.Id,project.Id,scene,1);var order=store.CreateOrder(customer.Id,project.Id,quote.Id);
    store.DeleteLocalProduct(product.Id,product.Revision);
    Check(store.LocalModelProducts().Count==0&&store.LocalCatalogProducts().Count==0,"deleted model still available for placement");
    Reject(()=>store.AttachLocalModel(product.Id,3,hash,bytes),LocalErrorCode.NotFound);
    Check(store.ModelAsset(product.ActiveAssetId.Value).ProductId==product.Id&&File.Exists(store.VerifiedModelPath(product.ActiveAssetId.Value)),"delete removed immutable asset or bytes");
    Check(store.ExportVersion(scene,1)==saved&&store.Restore(scene,1,1).SceneJson==saved,"delete changed or prevented restoring saved scene");
    Check(store.Quotation(quote.Id).Total=="6800.50"&&store.Order(order.Id).Total=="6800.50","delete changed quotation or order snapshot");
   }
  });
  Console.WriteLine("Local model assets: "+passed+" passed");
 }
}
