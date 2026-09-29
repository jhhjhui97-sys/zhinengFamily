using System;
using System.IO;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using LocalScenes;
using SmartHome.SceneConsumer;

public static class LocalQuotationTests {
 static int passed;
 static void Check(bool value,string message) { if(!value) throw new Exception(message); }
 static void Test(string name,Action body) { body();passed++;Console.WriteLine("PASS "+name); }
 static string AddModel(string database,string source) {
  byte[] bytes=File.ReadAllBytes(source);string hash;
  using(var sha=SHA256.Create())hash=BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();
  string folder=Path.Combine(Path.GetDirectoryName(database),"models");Directory.CreateDirectory(folder);File.WriteAllBytes(Path.Combine(folder,hash+".glb"),bytes);return hash;
 }
 public static void Run(string schema,string sample,string directory) {
  var validator=new OfflineSceneValidator(File.ReadAllText(schema));
  Test("saved sellable scene creates exact immutable quotation snapshot",()=>{
   string path=Path.Combine(directory,"quotation-snapshot.sqlite");Guid ws=Guid.NewGuid(),actor=Guid.NewGuid();
   string hash=AddModel(path,"apps/windows-local/public/assets/sofa.glb");
   using(var store=new LocalSceneStore(path,ws,actor,validator)) {
    Guid customer=store.CreateCustomer("张先生").Id;
    Guid project=store.CreateProject(customer,"龙湖小区120㎡").Id;
    Guid product=store.CreateLocalProduct("sofa","门店品牌","三人沙发","SOFA-1","6800.50",2400,950,850).Id;
    var asset=store.AttachLocalModel(product,1,hash,new FileInfo(Path.Combine(directory,"models",hash+".glb")).Length);
    Guid document=store.CreateForProject(project,"客厅设计");
    var scene=JObject.Parse(File.ReadAllText(sample));var items=(JArray)scene["furniture_instances"];
    var sellable=(JObject)items[0].DeepClone();sellable["id"]=Guid.NewGuid().ToString("D");sellable["product_id"]=product.ToString("D");sellable["asset_id"]=asset.Id.ToString("D");items.Add(sellable);
    var second=(JObject)sellable.DeepClone();second["id"]=Guid.NewGuid().ToString("D");items.Add(second);
    store.Catalog(Guid.Parse("40000000-0000-4000-8000-000000000002"),"演示沙发",2400,950,850);
    store.Put(document,0,scene.ToString());
    var quote=store.CreateQuotation(customer,project,document,1);
    Check(quote.CustomerId==customer&&quote.ProjectId==project&&quote.SceneRevision==1,"quote scope wrong");
    Check(quote.Total=="13601.00"&&quote.TotalCents==1360100,"cent arithmetic lost precision");
    Check(quote.Lines.Count==1&&quote.Lines[0].Quantity==2&&quote.Lines[0].UnitPrice=="6800.50","SKU quantity or unit snapshot wrong");
    Check(quote.ExcludedDemoCount==1,"demo furniture silently priced");
    store.UpdateLocalProduct(product,2,"sofa","门店品牌","三人沙发","SOFA-1","9999.99",2400,950,850,"{}");
    Check(store.Quotation(quote.Id).Total=="13601.00","old quote changed after product edit");
    Check(store.Quotations(project).Total==1&&store.Quotations(project).Items[0].Id==quote.Id,"quote list wrong");
    using(var db=new SqliteConnection(path)) {
     bool changed=false;try { db.Execute("UPDATE local_quotations SET total_cents=0 WHERE id=?",quote.Id.ToString("D"));changed=true; } catch(LocalStoreError) {}
     Check(!changed,"quotation header was mutable");
     changed=false;try { db.Execute("DELETE FROM local_quotation_lines WHERE quotation_id=?",quote.Id.ToString("D"));changed=true; } catch(LocalStoreError) {}
     Check(!changed,"quotation lines were mutable");
    }
    using(var other=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
     SqliteTests.Error(()=>other.Quotation(quote.Id),LocalErrorCode.NotFound);
     SqliteTests.Error(()=>other.CreateQuotation(customer,project,document,1),LocalErrorCode.NotFound);
    }
   }
  });
  Test("demo-only and unrelated project scenes cannot be quoted",()=>{
   string path=Path.Combine(directory,"quotation-scope.sqlite");Guid ws=Guid.NewGuid(),actor=Guid.NewGuid();
   using(var store=new LocalSceneStore(path,ws,actor,validator)) {
    Guid a=store.CreateCustomer("张先生").Id,b=store.CreateCustomer("李先生").Id;
    Guid project=store.CreateProject(a,"张先生方案").Id,other=store.CreateProject(b,"李先生方案").Id;
    Guid document=store.CreateForProject(project,"客厅");
    store.Catalog(Guid.Parse("40000000-0000-4000-8000-000000000002"),"演示沙发",2400,950,850);
    store.Put(document,0,File.ReadAllText(sample));
    SqliteTests.Error(()=>store.CreateQuotation(a,project,document,1),LocalErrorCode.InvalidInput);
    SqliteTests.Error(()=>store.CreateQuotation(b,project,document,1),LocalErrorCode.NotFound);
    SqliteTests.Error(()=>store.CreateQuotation(b,other,document,1),LocalErrorCode.NotFound);
    SqliteTests.Error(()=>store.CreateQuotation(a,project,document,2),LocalErrorCode.NotFound);
    Check(store.Quotations(project).Total==0,"failed quote left a partial row");
   }
  });
  Test("v4 quotation migration backs up old products and rolls back on final-stage failure",()=>{
   string path=Path.Combine(directory,"quotation-migration.sqlite");Guid ws=Guid.NewGuid(),actor=Guid.NewGuid(),product;
   using(var store=new LocalSceneStore(path,ws,actor,validator))product=store.CreateLocalProduct("sofa","品牌","沙发","S-1","12345.67",2400,950,850).Id;
   using(var db=new SqliteConnection(path)) {
    db.Execute("DROP TABLE local_quotation_lines");db.Execute("DROP TABLE local_quotations");db.Execute("DROP INDEX local_projects_quote_scope");db.Execute("PRAGMA user_version=4");
   }
   using(var upgraded=new LocalSceneStore(path,ws,actor,validator))Check(upgraded.LocalProduct(product).Price=="12345.67","v4 product changed after quote upgrade");
   string[] backups=Directory.GetFiles(directory,"quotation-migration.sqlite.pre-v5-*.bak");Check(backups.Length==1,"v4 backup missing");
   using(var db=new SqliteConnection(backups[0]))Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==4,"backup not original v4");
   string restored=Path.Combine(directory,"quotation-restored.sqlite");File.Copy(backups[0],restored);
   using(var copy=new LocalSceneStore(restored,ws,actor,validator))Check(copy.LocalProduct(product).Price=="12345.67","restored v4 product missing");
   string broken=Path.Combine(directory,"quotation-broken.sqlite");File.Copy(backups[0],broken);
   using(var db=new SqliteConnection(broken))db.Execute("CREATE TABLE local_quotations(broken INTEGER)");
   bool rejected=false;try { using(var ignored=new LocalSceneStore(broken,ws,actor,validator)) {} } catch { rejected=true; }
   Check(rejected,"broken quote migration succeeded");
   using(var db=new SqliteConnection(broken)) {
    Check((long)db.Query("PRAGMA user_version")[0]["user_version"]==4,"failed v5 migration advanced format");
    Check((long)db.Query("SELECT COUNT(*) n FROM local_products WHERE id=?",product.ToString("D"))[0]["n"]==1,"failed v5 migration lost product");
    Check(db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name='local_quotation_lines'").Count==0,"failed v5 migration left partial lines");
   }
  });
  Console.WriteLine("Local quotations: "+passed+" passed");
 }
}
