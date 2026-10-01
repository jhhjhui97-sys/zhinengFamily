using System;
using System.Collections.Generic;
using System.Globalization;

namespace LocalScenes {
 public sealed class LocalOrderEvent {
  public long Revision { get; internal set; }
  public string Status { get; internal set; }
  public Guid ActorId { get; internal set; }
  public string CreatedAt { get; internal set; }
 }
 public sealed class LocalOrder {
  public Guid Id { get; internal set; }
  public string Number { get; internal set; }
  public Guid QuotationId { get; internal set; }
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
  public Guid CreatedBy { get; internal set; }
  public string CreatedAt { get; internal set; }
  public string Status { get; internal set; }
  public long Revision { get; internal set; }
  public string UpdatedAt { get; internal set; }
  public List<LocalQuotationLine> Lines { get; internal set; }
  public List<LocalQuotationExclusion> Exclusions { get; internal set; }
  public List<LocalOrderEvent> Events { get; internal set; }
 }
 public sealed class LocalOrderPage {
  public long Total { get; internal set; }
  public List<LocalOrder> Items { get; internal set; }
 }
 public sealed partial class LocalSceneStore {
  public LocalOrder CreateOrder(Guid customerId,Guid projectId,Guid quotationId) {
   Input(customerId!=Guid.Empty&&projectId!=Guid.Empty&&quotationId!=Guid.Empty);
   Guid result=Guid.Empty;
   db.Transaction(()=>{
    var project=Project(projectId);
    if(project.CustomerId!=customerId)throw new LocalStoreError(LocalErrorCode.NotFound);
    var quote=Quotation(quotationId);
    if(quote.CustomerId!=customerId||quote.ProjectId!=projectId)throw new LocalStoreError(LocalErrorCode.NotFound);
    var existing=db.Query("SELECT id FROM local_orders WHERE workspace_id=? AND quotation_id=?",Key(workspace),Key(quotationId));
    if(existing.Count!=0) { result=Guid.Parse((string)existing[0]["id"]);return; }
    result=Guid.NewGuid();string stamp=Now(),number="DD-"+DateTime.UtcNow.ToString("yyyyMMdd",CultureInfo.InvariantCulture)+"-"+result.ToString("N").Substring(0,8).ToUpperInvariant();
    db.Execute(@"INSERT INTO local_orders(workspace_id,id,order_number,quotation_id,customer_id,project_id,document_id,scene_revision,customer_name,project_name,scene_name,currency,total_cents,created_by,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",Key(workspace),Key(result),number,Key(quote.Id),Key(customerId),Key(projectId),Key(quote.DocumentId),quote.SceneRevision,quote.CustomerName,quote.ProjectName,quote.SceneName,quote.Currency,quote.TotalCents,Key(actor),stamp);
    foreach(var line in quote.Lines)db.Execute(@"INSERT INTO local_order_lines(workspace_id,order_id,product_id,product_name,sku,unit_price,unit_cents,quantity,line_cents)
     VALUES(?,?,?,?,?,?,?,?,?)",Key(workspace),Key(result),Key(line.ProductId),line.ProductName,line.Sku,line.UnitPrice,line.UnitCents,line.Quantity,line.LineCents);
    foreach(var exclusion in quote.Exclusions)db.Execute("INSERT INTO local_order_exclusions(workspace_id,order_id,instance_id,product_id,name) VALUES(?,?,?,?,?)",Key(workspace),Key(result),Key(exclusion.InstanceId),Key(exclusion.ProductId),exclusion.Name);
    db.Execute("INSERT INTO local_order_state(workspace_id,order_id,status,revision,updated_at) VALUES(?,?,'draft',1,?)",Key(workspace),Key(result),stamp);
    db.Execute("INSERT INTO local_order_events(workspace_id,order_id,revision,status,actor_id,created_at) VALUES(?,?,1,'draft',?,?)",Key(workspace),Key(result),Key(actor),stamp);
   });
   return Order(result);
  }
  LocalOrder OrderRow(Dictionary<string,object> row) {
   Guid id=Guid.Parse((string)row["id"]);
   var state=db.Query("SELECT status,revision,updated_at FROM local_order_state WHERE workspace_id=? AND order_id=?",Key(workspace),Key(id));
   if(state.Count!=1)throw new LocalStoreError(LocalErrorCode.Corrupt);
   var result=new LocalOrder {
    Id=id,Number=(string)row["order_number"],QuotationId=Guid.Parse((string)row["quotation_id"]),CustomerId=Guid.Parse((string)row["customer_id"]),ProjectId=Guid.Parse((string)row["project_id"]),DocumentId=Guid.Parse((string)row["document_id"]),
    SceneRevision=(long)row["scene_revision"],CustomerName=(string)row["customer_name"],ProjectName=(string)row["project_name"],SceneName=(string)row["scene_name"],Currency=(string)row["currency"],TotalCents=(long)row["total_cents"],
    CreatedBy=Guid.Parse((string)row["created_by"]),CreatedAt=(string)row["created_at"],Status=(string)state[0]["status"],Revision=(long)state[0]["revision"],UpdatedAt=(string)state[0]["updated_at"],
    Lines=new List<LocalQuotationLine>(),Exclusions=new List<LocalQuotationExclusion>(),Events=new List<LocalOrderEvent>()
   };
   foreach(var line in db.Query("SELECT * FROM local_order_lines WHERE workspace_id=? AND order_id=? ORDER BY sku,product_id",Key(workspace),Key(id)))
    result.Lines.Add(new LocalQuotationLine {ProductId=Guid.Parse((string)line["product_id"]),ProductName=(string)line["product_name"],Sku=(string)line["sku"],UnitPrice=(string)line["unit_price"],UnitCents=(long)line["unit_cents"],Quantity=(long)line["quantity"],LineCents=(long)line["line_cents"]});
   foreach(var exclusion in db.Query("SELECT * FROM local_order_exclusions WHERE workspace_id=? AND order_id=? ORDER BY instance_id",Key(workspace),Key(id)))
    result.Exclusions.Add(new LocalQuotationExclusion {InstanceId=Guid.Parse((string)exclusion["instance_id"]),ProductId=Guid.Parse((string)exclusion["product_id"]),Name=(string)exclusion["name"]});
   foreach(var evt in db.Query("SELECT revision,status,actor_id,created_at FROM local_order_events WHERE workspace_id=? AND order_id=? ORDER BY revision",Key(workspace),Key(id)))
    result.Events.Add(new LocalOrderEvent {Revision=(long)evt["revision"],Status=(string)evt["status"],ActorId=Guid.Parse((string)evt["actor_id"]),CreatedAt=(string)evt["created_at"]});
   return result;
  }
  public LocalOrder Order(Guid id) {
   var rows=db.Query("SELECT * FROM local_orders WHERE workspace_id=? AND id=?",Key(workspace),Key(id));
   if(rows.Count!=1)throw new LocalStoreError(LocalErrorCode.NotFound);
   return OrderRow(rows[0]);
  }
  public LocalOrderPage Orders(Guid projectId,int limit=20,int offset=0) {
   Input(limit>=1&&limit<=100&&offset>=0);Project(projectId);
   LocalOrderPage page=null;
   db.Transaction(()=>{
    long total=(long)db.Query("SELECT COUNT(*) n FROM local_orders WHERE workspace_id=? AND project_id=?",Key(workspace),Key(projectId))[0]["n"];
    var items=new List<LocalOrder>();
    foreach(var row in db.Query("SELECT * FROM local_orders WHERE workspace_id=? AND project_id=? ORDER BY created_at DESC,id ASC LIMIT ? OFFSET ?",Key(workspace),Key(projectId),limit,offset))items.Add(OrderRow(row));
    page=new LocalOrderPage {Total=total,Items=items};
   });
   return page;
  }
  public LocalOrder SetOrderStatus(Guid id,long baseRevision,string status) {
   Input(id!=Guid.Empty&&baseRevision>=1&&(status=="confirmed"||status=="cancelled"));
   db.Transaction(()=>{
    var current=Order(id);
    if(current.Status==status)return;
    if(current.Revision!=baseRevision||current.Status=="cancelled")throw new LocalStoreError(LocalErrorCode.Conflict);
    if(current.Status!="draft"&&!(current.Status=="confirmed"&&status=="cancelled"))throw new LocalStoreError(LocalErrorCode.Conflict);
    long next=checked(current.Revision+1);string stamp=Now();
    int changed=db.Execute("UPDATE local_order_state SET status=?,revision=?,updated_at=? WHERE workspace_id=? AND order_id=? AND revision=?",status,next,stamp,Key(workspace),Key(id),baseRevision);
    if(changed!=1)throw new LocalStoreError(LocalErrorCode.Conflict);
    db.Execute("INSERT INTO local_order_events(workspace_id,order_id,revision,status,actor_id,created_at) VALUES(?,?,?,?,?,?)",Key(workspace),Key(id),next,status,Key(actor),stamp);
   });
   return Order(id);
  }
 }
}
