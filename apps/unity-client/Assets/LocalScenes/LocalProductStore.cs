using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace LocalScenes {
 public sealed class LocalProduct {
  public Guid Id { get; internal set; }
  public string Category { get; internal set; }
  public string Brand { get; internal set; }
  public string Name { get; internal set; }
  public string Sku { get; internal set; }
  public string Price { get; internal set; }
  public double WidthMm { get; internal set; }
  public double DepthMm { get; internal set; }
  public double HeightMm { get; internal set; }
  public string MetadataJson { get; internal set; }
  public Guid? ActiveAssetId { get; internal set; }
  public long Revision { get; internal set; }
  public string CreatedAt { get; internal set; }
  public string UpdatedAt { get; internal set; }
 }
 public sealed class LocalProductPage {
  public long Total { get; internal set; }
  public List<LocalProduct> Items { get; internal set; }
 }
 public sealed partial class LocalSceneStore {
  static string ProductLabel(string value) {
   Input(!string.IsNullOrWhiteSpace(value)); string text=value.Trim();
   Input(text.Length<=100); return text;
  }
  static string ProductPrice(string value) {
   string price=Budget(value); Input(price!=null); return price;
  }
  static void ProductDimensions(double width,double depth,double height) {
   foreach(double value in new[]{width,depth,height}) Input(value>0&&!double.IsInfinity(value)&&!double.IsNaN(value));
  }
  static bool FiniteJson(JToken value) {
   if(value.Type==JTokenType.Float) {
    double number=value.Value<double>(); return !double.IsNaN(number)&&!double.IsInfinity(number);
   }
   var container=value as JContainer;
   if(container!=null) foreach(JToken child in container.Children()) if(!FiniteJson(child)) return false;
   return true;
  }
  static string ProductMetadata(string json) {
   try {
    JObject value=JObject.Parse(string.IsNullOrWhiteSpace(json)?"{}":json);
    Input(FiniteJson(value)); return value.ToString(Formatting.None);
   } catch(LocalStoreError) { throw; }
     catch(JsonException) { throw new LocalStoreError(LocalErrorCode.InvalidInput); }
     catch(OverflowException) { throw new LocalStoreError(LocalErrorCode.InvalidInput); }
     catch(FormatException) { throw new LocalStoreError(LocalErrorCode.InvalidInput); }
  }
  static LocalProduct ProductRow(Dictionary<string,object> row) {
   return new LocalProduct {
    Id=Guid.Parse((string)row["id"]),Category=(string)row["category"],Brand=(string)row["brand"],
    Name=(string)row["name"],Sku=(string)row["sku"],Price=(string)row["price"],
    WidthMm=(double)row["width_mm"],DepthMm=(double)row["depth_mm"],HeightMm=(double)row["height_mm"],
    MetadataJson=(string)row["metadata_json"],ActiveAssetId=row["active_asset_id"]==null?(Guid?)null:Guid.Parse((string)row["active_asset_id"]),Revision=(long)row["revision"],
    CreatedAt=(string)row["created_at"],UpdatedAt=(string)row["updated_at"]
   };
  }
  public LocalProduct CreateLocalProduct(string category,string brand,string name,string sku,string price,double width,double depth,double height,string metadataJson="{}") {
   category=ProductLabel(category);brand=ProductLabel(brand);name=Name(name);sku=ProductLabel(sku);
   price=ProductPrice(price);ProductDimensions(width,depth,height);metadataJson=ProductMetadata(metadataJson);
   Guid id=Guid.NewGuid();string stamp=Now();
   db.Execute(@"INSERT INTO local_products(workspace_id,id,category,brand,name,sku,price,width_mm,depth_mm,height_mm,metadata_json,revision,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?)",Key(workspace),Key(id),category,brand,name,sku,price,width,depth,height,metadataJson,stamp,stamp);
   return LocalProduct(id);
  }
  public LocalProduct LocalProduct(Guid id) {
   var rows=db.Query(@"SELECT p.*,m.asset_id active_asset_id FROM local_products p
    LEFT JOIN local_product_active_model m ON m.workspace_id=p.workspace_id AND m.product_id=p.id
    WHERE p.workspace_id=? AND p.id=?",Key(workspace),Key(id));
   if(rows.Count!=1) throw new LocalStoreError(LocalErrorCode.NotFound);
   return ProductRow(rows[0]);
  }
  public LocalProductPage LocalProducts(int limit=20,int offset=0,string search=null,string category=null) {
   Input(limit>=1&&limit<=100&&offset>=0);
   search=Optional(search,100);category=Optional(category,100);
   string filter=" WHERE p.workspace_id=?";var args=new List<object>{Key(workspace)};
   if(category!=null) { filter+=" AND p.category=?";args.Add(category); }
   if(search!=null) {
    string pattern="%"+search.Replace("\\","\\\\").Replace("%","\\%").Replace("_","\\_")+"%";
    filter+=" AND (p.name LIKE ? ESCAPE '\\' OR p.sku LIKE ? ESCAPE '\\' OR p.brand LIKE ? ESCAPE '\\')";
    args.Add(pattern);args.Add(pattern);args.Add(pattern);
   }
   LocalProductPage page=null;
   db.Transaction(()=>{
    long total=(long)db.Query("SELECT COUNT(*) n FROM local_products p"+filter,args.ToArray())[0]["n"];
    var items=new List<LocalProduct>();var pageArgs=new List<object>(args);pageArgs.Add(limit);pageArgs.Add(offset);
    foreach(var row in db.Query("SELECT p.*,m.asset_id active_asset_id FROM local_products p LEFT JOIN local_product_active_model m ON m.workspace_id=p.workspace_id AND m.product_id=p.id"+filter+" ORDER BY p.updated_at DESC,p.id ASC LIMIT ? OFFSET ?",pageArgs.ToArray()))
     items.Add(ProductRow(row));
    page=new LocalProductPage {Total=total,Items=items};
   });
   return page;
  }
  public LocalProduct UpdateLocalProduct(Guid id,long baseRevision,string category,string brand,string name,string sku,string price,double width,double depth,double height,string metadataJson) {
   Input(baseRevision>=1);category=ProductLabel(category);brand=ProductLabel(brand);name=Name(name);sku=ProductLabel(sku);
   price=ProductPrice(price);ProductDimensions(width,depth,height);metadataJson=ProductMetadata(metadataJson);
   LocalProduct(id);
   int changed=db.Execute(@"UPDATE local_products SET category=?,brand=?,name=?,sku=?,price=?,width_mm=?,depth_mm=?,height_mm=?,metadata_json=?,revision=revision+1,updated_at=?
    WHERE workspace_id=? AND id=? AND revision=?",category,brand,name,sku,price,width,depth,height,metadataJson,Now(),Key(workspace),Key(id),baseRevision);
   if(changed!=1) throw new LocalStoreError(LocalErrorCode.Conflict);
   return LocalProduct(id);
  }
 }
}
