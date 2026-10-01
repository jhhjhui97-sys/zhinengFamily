using System;
using System.IO;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using LocalScenes;
using SmartHome.SceneConsumer;

public static class LocalOrderTests {
 static int passed;
 static void Check(bool value,string message) { if(!value) throw new Exception(message); }
 static void Test(string name,Action body) { body();passed++;Console.WriteLine("PASS "+name); }
 public static void Run(string schema,string sample,string directory) {
  var validator=new OfflineSceneValidator(File.ReadAllText(schema));
  Test("order snapshots quotation and remains stable after product price change",()=>{
   string path=Path.Combine(directory,"order-snapshot.sqlite");Guid ws=Guid.NewGuid(),actor=Guid.NewGuid();
   using(var store=new LocalSceneStore(path,ws,actor,validator)) {
    Guid customer=store.CreateCustomer("张先生").Id,project=store.CreateProject(customer,"龙湖小区").Id;
    Guid product=store.CreateLocalProduct("sofa","品牌","三人沙发","ORDER-SOFA-1","6800.50",2400,950,850).Id;
    byte[] bytes=File.ReadAllBytes("apps/windows-local/public/assets/sofa.glb");string hash;
    using(var sha=SHA256.Create())hash=BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();
    string models=Path.Combine(directory,"models");Directory.CreateDirectory(models);File.WriteAllBytes(Path.Combine(models,hash+".glb"),bytes);
    var asset=store.AttachLocalModel(product,1,hash,bytes.Length);
    Guid document=store.CreateForProject(project,"客厅方案");
    var scene=JObject.Parse(File.ReadAllText(sample));var item=(JObject)scene["furniture_instances"][0].DeepClone();
    item["id"]=Guid.NewGuid().ToString("D");item["product_id"]=product.ToString("D");item["asset_id"]=asset.Id.ToString("D");((JArray)scene["furniture_instances"]).Add(item);
    store.Catalog(Guid.Parse("40000000-0000-4000-8000-000000000002"),"演示沙发",2400,950,850);
    store.Put(document,0,scene.ToString());
    Guid quote=store.CreateQuotation(customer,project,document,1).Id;
    var order=store.CreateOrder(customer,project,quote);
    Check(order.Total=="6800.50"&&order.Lines.Count==1&&order.Lines[0].Sku=="ORDER-SOFA-1","order price or product snapshot wrong");
    Check(order.Exclusions.Count==1&&order.Exclusions[0].Name=="离线示例沙发","unpriced demo missing from order");
    Check(store.CreateOrder(customer,project,quote).Id==order.Id&&store.Orders(project).Total==1,"repeat submit created duplicate order");
    store.UpdateLocalProduct(product,2,"sofa","品牌","三人沙发","ORDER-SOFA-1","9999.99",2400,950,850,"{}");
    Check(store.Order(order.Id).Total=="6800.50","product edit changed old order");
    var confirmed=store.SetOrderStatus(order.Id,1,"confirmed");
    Check(confirmed.Status=="confirmed"&&confirmed.Revision==2&&confirmed.Events.Count==2,"confirmation history wrong");
    SqliteTests.Error(()=>store.SetOrderStatus(order.Id,1,"cancelled"),LocalErrorCode.Conflict);
    Check(store.SetOrderStatus(order.Id,2,"cancelled").Status=="cancelled","confirmed order cancellation failed");
    SqliteTests.Error(()=>store.SetOrderStatus(order.Id,3,"confirmed"),LocalErrorCode.Conflict);
    Guid anotherCustomer=store.CreateCustomer("李女士").Id,anotherProject=store.CreateProject(anotherCustomer,"其他项目").Id;
    SqliteTests.Error(()=>store.CreateOrder(anotherCustomer,anotherProject,quote),LocalErrorCode.NotFound);
    Guid raceQuote=store.CreateQuotation(customer,project,document,1).Id;
    using(var left=new LocalSceneStore(path,ws,actor,validator))using(var right=new LocalSceneStore(path,ws,actor,validator)) {
     Guid[] ids=new Guid[2];Exception[] errors=new Exception[2];
     using(var ready=new System.Threading.CountdownEvent(2))using(var start=new System.Threading.ManualResetEvent(false)) {
      var a=new System.Threading.Thread(()=>{ready.Signal();start.WaitOne();try{ids[0]=left.CreateOrder(customer,project,raceQuote).Id;}catch(Exception e){errors[0]=e;}});
      var b=new System.Threading.Thread(()=>{ready.Signal();start.WaitOne();try{ids[1]=right.CreateOrder(customer,project,raceQuote).Id;}catch(Exception e){errors[1]=e;}});
      a.Start();b.Start();Check(ready.Wait(5000),"order race not ready");start.Set();Check(a.Join(10000)&&b.Join(10000),"order race stuck");
     }
     Check(errors[0]==null&&errors[1]==null&&ids[0]==ids[1],"concurrent duplicate order creation failed");
     Check(store.Orders(project).Total==2,"concurrent creation left duplicate orders");
    }
    Guid faultQuote=store.CreateQuotation(customer,project,document,1).Id;
    using(var db=new SqliteConnection(path))db.Execute("CREATE TRIGGER order_test_fault BEFORE INSERT ON local_order_lines BEGIN SELECT RAISE(ABORT,'order line fault'); END");
    bool rejected=false;try{store.CreateOrder(customer,project,faultQuote);}catch(LocalStoreError){rejected=true;}
    Check(rejected&&store.Orders(project).Total==2,"failed order line left partial header");
    using(var db=new SqliteConnection(path))db.Execute("DROP TRIGGER order_test_fault");
    var faultOrder=store.CreateOrder(customer,project,faultQuote);
    using(var db=new SqliteConnection(path))db.Execute("CREATE TRIGGER order_event_fault BEFORE INSERT ON local_order_events WHEN NEW.revision>1 BEGIN SELECT RAISE(ABORT,'event fault'); END");
    rejected=false;try{store.SetOrderStatus(faultOrder.Id,1,"confirmed");}catch(LocalStoreError){rejected=true;}
    Check(rejected&&store.Order(faultOrder.Id).Status=="draft"&&store.Order(faultOrder.Id).Events.Count==1,"failed status event left changed state");
    using(var db=new SqliteConnection(path))db.Execute("DROP TRIGGER order_event_fault");
    using(var left=new LocalSceneStore(path,ws,actor,validator))using(var right=new LocalSceneStore(path,ws,actor,validator)) {
     Exception[] errors=new Exception[2];
     using(var ready=new System.Threading.CountdownEvent(2))using(var start=new System.Threading.ManualResetEvent(false)) {
      var a=new System.Threading.Thread(()=>{ready.Signal();start.WaitOne();try{left.SetOrderStatus(faultOrder.Id,1,"confirmed");}catch(Exception e){errors[0]=e;}});
      var b=new System.Threading.Thread(()=>{ready.Signal();start.WaitOne();try{right.SetOrderStatus(faultOrder.Id,1,"cancelled");}catch(Exception e){errors[1]=e;}});
      a.Start();b.Start();Check(ready.Wait(5000),"status race not ready");start.Set();Check(a.Join(10000)&&b.Join(10000),"status race stuck");
     }
     Check((errors[0]==null)!=(errors[1]==null),"concurrent status transitions had no single winner");
     var settled=store.Order(faultOrder.Id);
     Check(settled.Revision==2&&settled.Events.Count==2,"status race left partial history");
    }
    using(var db=new SqliteConnection(path)) {
     bool changed=false;try{db.Execute("UPDATE local_orders SET total_cents=0 WHERE id=?",order.Id.ToString("D"));changed=true;}catch(LocalStoreError){}
     Check(!changed,"order header was mutable");
     changed=false;try{db.Execute("DELETE FROM local_order_lines WHERE order_id=?",order.Id.ToString("D"));changed=true;}catch(LocalStoreError){}
     Check(!changed,"order lines were mutable");
     changed=false;try{db.Execute("UPDATE local_order_events SET status='draft' WHERE order_id=?",order.Id.ToString("D"));changed=true;}catch(LocalStoreError){}
     Check(!changed,"order events were mutable");
    }
    using(var other=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
     SqliteTests.Error(()=>other.Order(order.Id),LocalErrorCode.NotFound);
     SqliteTests.Error(()=>other.CreateOrder(customer,project,quote),LocalErrorCode.NotFound);
    }
   }
  });
  Test("v5 orders migration preserves prior data and rolls back a broken schema",()=>{
   string path=Path.Combine(directory,"order-migration.sqlite");Guid ws=Guid.NewGuid(),actor=Guid.NewGuid(),customer;
   using(var store=new LocalSceneStore(path,ws,actor,validator))customer=store.CreateCustomer("王先生").Id;
   using(var db=new SqliteConnection(path)) {
    foreach(string table in new[]{"local_order_events","local_order_state","local_order_exclusions","local_order_lines","local_orders"})db.Execute("DROP TABLE "+table);
    db.Execute("PRAGMA user_version=5");
   }
   using(var upgraded=new LocalSceneStore(path,ws,actor,validator))Check(upgraded.Customer(customer).Name=="王先生","v5 customer lost on v6 upgrade");
   var backups=Directory.GetFiles(directory,"order-migration.sqlite.pre-v6-*.bak");Check(backups.Length==1,"pre-v6 backup missing");
   using(var db=new SqliteConnection(backups[0]))Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==5,"pre-v6 backup changed");
   string broken=Path.Combine(directory,"order-migration-broken.sqlite");File.Copy(backups[0],broken);
   using(var db=new SqliteConnection(broken))db.Execute("CREATE TABLE local_orders(broken INTEGER)");
   bool rejected=false;try{using(var ignored=new LocalSceneStore(broken,ws,actor,validator)){} }catch{rejected=true;}
   Check(rejected,"broken v6 schema upgraded");
   using(var db=new SqliteConnection(broken)) {
    Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==5,"failed v6 migration advanced format");
    Check((long)db.Query("SELECT COUNT(*) n FROM local_customers WHERE id=?",customer.ToString("D"))[0]["n"]==1,"failed v6 migration lost customer");
    Check(db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name='local_order_lines'").Count==0,"failed v6 migration left order lines");
   }
  });
  Console.WriteLine("Local orders: "+passed+" passed");
 }
}
