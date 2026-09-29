using System;
using System.Collections.Generic;
using System.Globalization;
using Newtonsoft.Json.Linq;

namespace LocalScenes {
 public sealed class LocalQuotationLine {
  public Guid ProductId { get; internal set; }
  public string ProductName { get; internal set; }
  public string Sku { get; internal set; }
  public string UnitPrice { get; internal set; }
  public long UnitCents { get; internal set; }
  public long Quantity { get; internal set; }
  public long LineCents { get; internal set; }
  public string LineTotal { get { return LocalSceneStore.Money(LineCents); } }
 }
 public sealed class LocalQuotation {
  public Guid Id { get; internal set; }
  public Guid CustomerId { get; internal set; }
  public Guid ProjectId { get; internal set; }
  public Guid DocumentId { get; internal set; }
  public long SceneRevision { get; internal set; }
  public string CustomerName { get; internal set; }
  public string ProjectName { get; internal set; }
  public string SceneName { get; internal set; }
  public string Currency { get; internal set; }
  public long TotalCents { get; internal set; }
  public string Total { get { return LocalSceneStore.Money(TotalCents); } }
  public long ExcludedDemoCount { get; internal set; }
  public Guid CreatedBy { get; internal set; }
  public string CreatedAt { get; internal set; }
  public List<LocalQuotationLine> Lines { get; internal set; }
 }
 public sealed class LocalQuotationPage {
  public long Total { get; internal set; }
  public List<LocalQuotation> Items { get; internal set; }
 }
 public sealed partial class LocalSceneStore {
  internal static string Money(long cents) { return (cents/100m).ToString("0.00",CultureInfo.InvariantCulture); }
  static long Cents(string price) {
   decimal amount=decimal.Parse(price,NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture);
   return decimal.ToInt64(amount*100m);
  }
  static Guid SceneReference(string value) {
   if(value!=null&&value.StartsWith("urn:uuid:",StringComparison.OrdinalIgnoreCase))value=value.Substring(9);
   Guid id;Input(Guid.TryParse(value,out id)&&id!=Guid.Empty);return id;
  }
  public LocalQuotation CreateQuotation(Guid customerId,Guid projectId,Guid documentId,long sceneRevision) {
   Input(customerId!=Guid.Empty&&projectId!=Guid.Empty&&documentId!=Guid.Empty&&sceneRevision>=1);
   Guid id=Guid.NewGuid();
   db.Transaction(()=>{
    var customer=Customer(customerId);var project=Project(projectId);
    if(project.CustomerId!=customerId)throw new LocalStoreError(LocalErrorCode.NotFound);
    RequireSceneAccess(documentId,projectId);
    string sceneJson=Version(documentId,sceneRevision).SceneJson;
    validator.Validate(sceneJson);
    var furniture=(JArray)JObject.Parse(sceneJson)["furniture_instances"];
    var lines=new Dictionary<Guid,LocalQuotationLine>();long excluded=0,total=0;
    foreach(JObject item in furniture) {
     if(item["asset_id"]==null||item["asset_id"].Type==JTokenType.Null) { excluded++;continue; }
     Guid productId=SceneReference((string)item["product_id"]),assetId=SceneReference((string)item["asset_id"]);
     if(ModelAsset(assetId).ProductId!=productId)throw new LocalStoreError(LocalErrorCode.InvalidInput);
     LocalQuotationLine line;
     if(!lines.TryGetValue(productId,out line)) {
      var product=LocalProduct(productId);
      line=new LocalQuotationLine {ProductId=productId,ProductName=product.Name,Sku=product.Sku,UnitPrice=product.Price,UnitCents=Cents(product.Price)};
      lines.Add(productId,line);
     }
     line.Quantity=checked(line.Quantity+1);
     line.LineCents=checked(line.Quantity*line.UnitCents);
    }
    Input(lines.Count>0);
    foreach(var line in lines.Values)total=checked(total+line.LineCents);
    string stamp=Now(),sceneName=(string)Document(documentId)["name"];
    db.Execute(@"INSERT INTO local_quotations(workspace_id,id,customer_id,project_id,document_id,scene_revision,customer_name,project_name,scene_name,currency,total_cents,excluded_demo_count,created_by,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,'CNY',?,?,?,?)",Key(workspace),Key(id),Key(customerId),Key(projectId),Key(documentId),sceneRevision,customer.Name,project.Name,sceneName,total,excluded,Key(actor),stamp);
    foreach(var line in lines.Values)db.Execute(@"INSERT INTO local_quotation_lines(workspace_id,quotation_id,product_id,product_name,sku,unit_price,unit_cents,quantity,line_cents)
     VALUES(?,?,?,?,?,?,?,?,?)",Key(workspace),Key(id),Key(line.ProductId),line.ProductName,line.Sku,line.UnitPrice,line.UnitCents,line.Quantity,line.LineCents);
   });
   return Quotation(id);
  }
  LocalQuotation QuotationRow(Dictionary<string,object> row) {
   var quotation=new LocalQuotation {
    Id=Guid.Parse((string)row["id"]),CustomerId=Guid.Parse((string)row["customer_id"]),ProjectId=Guid.Parse((string)row["project_id"]),DocumentId=Guid.Parse((string)row["document_id"]),
    SceneRevision=(long)row["scene_revision"],CustomerName=(string)row["customer_name"],ProjectName=(string)row["project_name"],SceneName=(string)row["scene_name"],
    Currency=(string)row["currency"],TotalCents=(long)row["total_cents"],ExcludedDemoCount=(long)row["excluded_demo_count"],CreatedBy=Guid.Parse((string)row["created_by"]),CreatedAt=(string)row["created_at"],Lines=new List<LocalQuotationLine>()
   };
   foreach(var line in db.Query("SELECT * FROM local_quotation_lines WHERE workspace_id=? AND quotation_id=? ORDER BY sku,product_id",Key(workspace),Key(quotation.Id)))
    quotation.Lines.Add(new LocalQuotationLine {ProductId=Guid.Parse((string)line["product_id"]),ProductName=(string)line["product_name"],Sku=(string)line["sku"],UnitPrice=(string)line["unit_price"],UnitCents=(long)line["unit_cents"],Quantity=(long)line["quantity"],LineCents=(long)line["line_cents"]});
   return quotation;
  }
  public LocalQuotation Quotation(Guid id) {
   var rows=db.Query("SELECT * FROM local_quotations WHERE workspace_id=? AND id=?",Key(workspace),Key(id));
   if(rows.Count!=1)throw new LocalStoreError(LocalErrorCode.NotFound);
   return QuotationRow(rows[0]);
  }
  public LocalQuotationPage Quotations(Guid projectId,int limit=20,int offset=0) {
   Input(limit>=1&&limit<=100&&offset>=0);Project(projectId);
   LocalQuotationPage page=null;
   db.Transaction(()=>{
    long total=(long)db.Query("SELECT COUNT(*) n FROM local_quotations WHERE workspace_id=? AND project_id=?",Key(workspace),Key(projectId))[0]["n"];
    var items=new List<LocalQuotation>();
    foreach(var row in db.Query("SELECT * FROM local_quotations WHERE workspace_id=? AND project_id=? ORDER BY created_at DESC,id ASC LIMIT ? OFFSET ?",Key(workspace),Key(projectId),limit,offset))items.Add(QuotationRow(row));
    page=new LocalQuotationPage {Total=total,Items=items};
   });
   return page;
  }
 }
}
