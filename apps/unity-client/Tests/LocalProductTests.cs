using System;
using System.IO;
using LocalScenes;
using SmartHome.SceneConsumer;

public static class LocalProductTests {
 static int passed;
 static void Check(bool condition,string message) { if(!condition) throw new Exception(message); }
 static void Test(string name,Action body) { body(); passed++; Console.WriteLine("PASS "+name); }
 static void Reject(Action action,LocalErrorCode expected) { SqliteTests.Error(action,expected); }
 static LocalProduct Create(LocalSceneStore store,string name,string sku,string brand="示例品牌",string category="sofa",string price="6800.50") {
  return store.CreateLocalProduct(category,brand,name,sku,price,2400,950,850,"{\"color\":\"浅灰\"}");
 }
 public static void Run(string schema,string directory) {
  var validator=new OfflineSceneValidator(File.ReadAllText(schema));
  Test("v2 products migration preserves sales and scenes with restorable backup",()=>{
   string path=Path.Combine(directory,"products-migration.sqlite");
   Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid(),customer,project,scene;
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) {
    customer=store.CreateCustomer("张先生","13800000000").Id;
    project=store.CreateProject(customer,"龙湖小区").Id;
    scene=store.CreateForProject(project,"客厅设计");
   }
   using(var db=new SqliteConnection(path)) {
    foreach(string table in new[]{"local_order_events","local_order_state","local_order_exclusions","local_order_lines","local_orders"})db.Execute("DROP TABLE IF EXISTS "+table);db.Execute("DROP TABLE IF EXISTS local_quotation_exclusions");db.Execute("DROP TABLE IF EXISTS local_quotation_lines");db.Execute("DROP TABLE IF EXISTS local_quotations");
    db.Execute("DROP TABLE IF EXISTS local_product_active_model");
    db.Execute("DROP TABLE IF EXISTS local_model_assets");
    db.Execute("DROP TABLE IF EXISTS local_products");
    db.Execute("PRAGMA user_version=2");
   }
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) {
    Check(store.Customer(customer).Name=="张先生"&&store.Project(project).Id==project,"sales data lost");
    Check(store.ProjectScenes(project).Total==1&&store.ProjectScenes(project).Items[0].Id==scene,"project scene lost");
    Check(store.LocalProducts().Total==0,"new product table not empty");
   }
   string[] backup=Directory.GetFiles(directory,"products-migration.sqlite.pre-v3-*.bak");
   Check(backup.Length==1,"unique pre-v3 backup missing");
   string restored=Path.Combine(directory,"products-restored.sqlite"); File.Copy(backup[0],restored);
   using(var store=new LocalSceneStore(restored,workspace,actor,validator))
    Check(store.Customer(customer).Id==customer&&store.ProjectScenes(project).Total==1,"backup cannot be restored");
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) Check(store.LocalProducts().Total==0,"v3 reopen failed");
   Check(Directory.GetFiles(directory,"products-migration.sqlite.pre-v3-*.bak").Length==1,"v3 reopen made redundant backup");
  });
  Test("product records preserve monetary strings and workspace isolation",()=>{
   string path=Path.Combine(directory,"products-crud.sqlite");
   Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid(),product;
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) {
    var created=Create(store,"三人沙发","SOFA-001");product=created.Id;
    Check(created.Price=="6800.50"&&created.Revision==1&&created.MetadataJson.Contains("浅灰"),"new product fields");
    for(int i=0;i<23;i++) Create(store,"床架"+i,"BED-"+i.ToString("D3"),"木作","bed","3999.90");
    Check(store.LocalProducts(20,0).Total==24&&store.LocalProducts(20,20).Items.Count==4,"product pagination");
    Check(store.LocalProducts(20,0,"SOFA").Total==1,"sku search");
    Check(store.LocalProducts(20,0,"示例品牌").Total==1,"brand search");
    Check(store.LocalProducts(20,0,"三人").Total==1,"name search");
    Check(store.LocalProducts(20,0,null,"bed").Total==23,"category filter");
    Check(store.LocalProducts(20,0,"床架","bed").Total==23,"combined search/category");
    Check(store.LocalProducts(20,20,null,"bed").Items.Count==3,"filtered page count");
    Reject(()=>Create(store,"重复SKU","SOFA-001"),LocalErrorCode.Conflict);
    Check(store.LocalProducts().Total==24,"duplicate SKU was inserted");
    var updated=store.UpdateLocalProduct(product,1,"sofa","新品牌","升级沙发","SOFA-001","12345.67",2500,1000,900,"{}");
    Check(updated.Price=="12345.67"&&updated.Revision==2&&updated.Name=="升级沙发","product update");
    Reject(()=>store.UpdateLocalProduct(product,1,"sofa","旧品牌","旧编辑","SOFA-001","1",1,1,1,"{}"),LocalErrorCode.Conflict);
    Check(store.LocalProduct(product).Name=="升级沙发","stale update overwrote product");
   }
   using(var reopened=new LocalSceneStore(path,workspace,actor,validator)) Check(reopened.LocalProduct(product).Price=="12345.67","product restart persistence");
   using(var other=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
    Check(other.LocalProducts(20,0,"SOFA").Total==0,"other workspace saw product search");
    Reject(()=>other.LocalProduct(product),LocalErrorCode.NotFound);
    Reject(()=>other.UpdateLocalProduct(product,2,"sofa","越权","越权","SOFA-001","1",1,1,1,"{}"),LocalErrorCode.NotFound);
   }
  });
  Test("failed v3 product migration rolls back without altering existing customer",()=>{
   string path=Path.Combine(directory,"products-failed-migration.sqlite");
   Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid(),customer;
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) customer=store.CreateCustomer("李女士").Id;
   using(var db=new SqliteConnection(path)) {
    foreach(string table in new[]{"local_order_events","local_order_state","local_order_exclusions","local_order_lines","local_orders"})db.Execute("DROP TABLE IF EXISTS "+table);db.Execute("DROP TABLE IF EXISTS local_quotation_exclusions");db.Execute("DROP TABLE IF EXISTS local_quotation_lines");db.Execute("DROP TABLE IF EXISTS local_quotations");
    db.Execute("DROP TABLE IF EXISTS local_product_active_model");
    db.Execute("DROP TABLE IF EXISTS local_model_assets");
    db.Execute("DROP TABLE local_products");
    db.Execute("PRAGMA user_version=2");
    db.Execute("CREATE TABLE local_products(broken INTEGER)");
   }
   bool rejected=false;
   try { using(var ignored=new LocalSceneStore(path,workspace,actor,validator)) {} } catch { rejected=true; }
   Check(rejected,"broken v3 migration was accepted");
   using(var db=new SqliteConnection(path)) {
    Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==2,"failed migration advanced format");
    Check((long)db.Query("SELECT COUNT(*) n FROM local_customers WHERE id=?",customer.ToString("D"))[0]["n"]==1,"failed migration lost customer");
    Check(db.Query("SELECT name FROM sqlite_master WHERE type='index' AND name='local_products_category'").Count==0,"failed migration left partial index");
   }
   Check(Directory.GetFiles(directory,"products-failed-migration.sqlite.pre-v3-*.bak").Length==1,"failed migration lacked recovery backup");
  });
  Test("product validation rejects invalid price dimensions metadata and searches",()=>{
   string path=Path.Combine(directory,"products-invalid.sqlite");
   using(var store=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
    Reject(()=>store.CreateLocalProduct("sofa","品牌","商品","A","1e400",1,1,1,"{}"),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateLocalProduct("sofa","品牌","商品","A","12.345",1,1,1,"{}"),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateLocalProduct("sofa","品牌","商品","A","12.00",0,1,1,"{}"),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateLocalProduct("sofa","品牌","商品","A","12.00",double.PositiveInfinity,1,1,"{}"),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateLocalProduct("sofa","品牌","商品","A","12.00",1,1,1,"[]"),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateLocalProduct("sofa","品牌","商品","A","12.00",1,1,1,"{\"nested\":[1e400]}"),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateLocalProduct("sofa","品牌","商品","A","12.00",1,1,1,"{bad}"),LocalErrorCode.InvalidInput);
    Reject(()=>store.LocalProducts(20,0,new string('x',101)),LocalErrorCode.InvalidInput);
    Reject(()=>store.LocalProducts(0,0),LocalErrorCode.InvalidInput);
    Reject(()=>store.LocalProducts(20,-1),LocalErrorCode.InvalidInput);
    Check(store.LocalProducts().Total==0,"invalid input inserted product");
   }
  });
  Test("active catalogue includes every product without requiring uploaded models",()=>{
   string path=Path.Combine(directory,"products-catalog.sqlite");Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid();
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) {
    for(int i=0;i<105;i++)Create(store,"沙发"+i,"S-"+i);
    var catalog=store.LocalCatalogProducts();Check(catalog.Count==105,"catalogue was paginated or required a model");
    foreach(var product in catalog)Check(product.ActiveAssetId==null,"assetless catalogue fabricated an asset");
   }
   using(var other=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) Check(other.LocalCatalogProducts().Count==0,"catalogue leaked another workspace");
  });
  Test("product removal hides all active lists preserves the record and reserves its SKU",()=>{
   string path=Path.Combine(directory,"products-deleted.sqlite");Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid(),product;
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) {
    product=Create(store,"待删除沙发","DELETED-S1").Id;Create(store,"仍在售床架","KEEP-B1","木作","bed");
    var updated=store.UpdateLocalProduct(product,1,"sofa","品牌","待删除沙发","DELETED-S1","6800.50",2400,950,850,"{}");
    Reject(()=>store.DeleteLocalProduct(product,1),LocalErrorCode.Conflict);
    Check(store.LocalProducts().Total==2,"stale delete hid the product");
    Reject(()=>store.DeleteLocalProduct(product,0),LocalErrorCode.InvalidInput);
    using(var other=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator))Reject(()=>other.DeleteLocalProduct(product,updated.Revision),LocalErrorCode.NotFound);
    store.DeleteLocalProduct(product,updated.Revision);
    Check(store.LocalProducts().Total==1&&store.LocalProducts(20,0,"DELETED").Total==0&&store.LocalProducts(20,0,null,"sofa").Total==0,"deleted product remained in a product list");
    Check(store.LocalCatalogProducts().Count==1,"deleted product remained in placement catalogue");
    var historical=store.LocalProduct(product);Check(historical.Sku=="DELETED-S1"&&historical.DeletedAt!=null&&historical.Revision==3,"product history was removed or tombstone did not revise it");
    Reject(()=>store.UpdateLocalProduct(product,3,"sofa","品牌","被修改","DELETED-S1","1.00",1,1,1,"{}"),LocalErrorCode.NotFound);
    Reject(()=>store.DeleteLocalProduct(product,3),LocalErrorCode.Conflict);
    Reject(()=>Create(store,"SKU 被复用","DELETED-S1"),LocalErrorCode.Conflict);
   }
   using(var reopened=new LocalSceneStore(path,workspace,actor,validator))Check(reopened.LocalProduct(product).DeletedAt!=null&&reopened.LocalProducts().Total==1,"product removal did not survive restart");
  });
  Console.WriteLine("Local products: "+passed+" passed");
 }
}
