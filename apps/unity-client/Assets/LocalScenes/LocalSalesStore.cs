using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;

namespace LocalScenes {
 public sealed class LocalCustomer {
  public Guid Id { get; internal set; }
  public string Name { get; internal set; }
  public string Phone { get; internal set; }
  public string Wechat { get; internal set; }
  public string Source { get; internal set; }
  public string Address { get; internal set; }
  public string Budget { get; internal set; }
  public string Status { get; internal set; }
  public string Notes { get; internal set; }
  public long Revision { get; internal set; }
  public string CreatedAt { get; internal set; }
  public string UpdatedAt { get; internal set; }
 }
 public sealed class LocalCustomerPage {
  public long Total { get; internal set; }
  public List<LocalCustomer> Items { get; internal set; }
 }
 public sealed class LocalProject {
  public Guid Id { get; internal set; }
  public Guid CustomerId { get; internal set; }
  public Guid SalesActorId { get; internal set; }
  public string Name { get; internal set; }
  public string Address { get; internal set; }
  public string Status { get; internal set; }
  public long Revision { get; internal set; }
  public string CreatedAt { get; internal set; }
  public string UpdatedAt { get; internal set; }
 }
 public sealed class LocalProjectPage {
  public long Total { get; internal set; }
  public List<LocalProject> Items { get; internal set; }
 }
 public sealed partial class LocalSceneStore {
  static string Name(string value) {
   Input(!string.IsNullOrWhiteSpace(value)); string text=value.Trim();
   Input(text.Length<=200); return text;
  }
  static string Optional(string value,int limit) {
   if(value==null) return null;
   string text=value.Trim(); Input(text.Length<=limit);
   return text.Length==0?null:text;
  }
  static string Budget(string value) {
   string text=Optional(value,13);
   if(text==null) return null;
   Input(Regex.IsMatch(text,@"^[0-9]{1,10}(\.[0-9]{1,2})?$",RegexOptions.CultureInvariant));
   decimal amount;
   Input(decimal.TryParse(text,NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture,out amount));
   Input(amount<=9999999999.99m);
   return text;
  }
  static string CustomerStatus(string status) {
   Input(status=="new"||status=="following"||status=="won"||status=="lost"); return status;
  }
  static string ProjectStatus(string status) {
   Input(status=="draft"||status=="active"||status=="archived"); return status;
  }
  static LocalCustomer CustomerRow(Dictionary<string,object> row) {
   return new LocalCustomer {
    Id=Guid.Parse((string)row["id"]),Name=(string)row["name"],Phone=(string)row["phone"],
    Wechat=(string)row["wechat"],Source=(string)row["source"],Address=(string)row["address"],
    Budget=(string)row["budget"],Status=(string)row["status"],Notes=(string)row["notes"],
    Revision=(long)row["revision"],CreatedAt=(string)row["created_at"],UpdatedAt=(string)row["updated_at"]
   };
  }
  static LocalProject ProjectRow(Dictionary<string,object> row) {
   return new LocalProject {
    Id=Guid.Parse((string)row["id"]),CustomerId=Guid.Parse((string)row["customer_id"]),
    SalesActorId=Guid.Parse((string)row["sales_actor_id"]),Name=(string)row["name"],
    Address=(string)row["address"],Status=(string)row["status"],
    Revision=(long)row["revision"],CreatedAt=(string)row["created_at"],UpdatedAt=(string)row["updated_at"]
   };
  }
  public LocalCustomer CreateCustomer(string name,string phone=null,string wechat=null,string source=null,string address=null,string budget=null,string status="new",string notes=null) {
   name=Name(name);phone=Optional(phone,32);wechat=Optional(wechat,100);
   source=Optional(source,100);address=Optional(address,500);budget=Budget(budget);
   status=CustomerStatus(status);notes=Optional(notes,10000);
   Guid id=Guid.NewGuid(); string stamp=Now();
   db.Execute(@"INSERT INTO local_customers(workspace_id,id,name,phone,wechat,source,address,budget,status,notes,revision,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)",Key(workspace),Key(id),name,phone,wechat,source,address,budget,status,notes,stamp,stamp);
   return Customer(id);
  }
  public LocalCustomer Customer(Guid id) {
   var rows=db.Query("SELECT * FROM local_customers WHERE workspace_id=? AND id=?",Key(workspace),Key(id));
   if(rows.Count!=1) throw new LocalStoreError(LocalErrorCode.NotFound);
   return CustomerRow(rows[0]);
  }
  public LocalCustomerPage Customers(int limit=20,int offset=0) {
   Input(limit>=1&&limit<=100&&offset>=0);
   LocalCustomerPage page=null;
   db.Transaction(()=>{
    long total=(long)db.Query("SELECT COUNT(*) n FROM local_customers WHERE workspace_id=?",Key(workspace))[0]["n"];
    var items=new List<LocalCustomer>();
    foreach(var row in db.Query("SELECT * FROM local_customers WHERE workspace_id=? ORDER BY updated_at DESC,id ASC LIMIT ? OFFSET ?",Key(workspace),limit,offset))
     items.Add(CustomerRow(row));
    page=new LocalCustomerPage {Total=total,Items=items};
   });
   return page;
  }
  public LocalCustomer UpdateCustomer(Guid id,long baseRevision,string name,string phone,string wechat,string source,string address,string budget,string status,string notes) {
   Input(baseRevision>=1);name=Name(name);phone=Optional(phone,32);wechat=Optional(wechat,100);
   source=Optional(source,100);address=Optional(address,500);budget=Budget(budget);
   status=CustomerStatus(status);notes=Optional(notes,10000);
   Customer(id);
   int changed=db.Execute(@"UPDATE local_customers SET name=?,phone=?,wechat=?,source=?,address=?,budget=?,status=?,notes=?,revision=revision+1,updated_at=?
    WHERE workspace_id=? AND id=? AND revision=?",name,phone,wechat,source,address,budget,status,notes,Now(),Key(workspace),Key(id),baseRevision);
   if(changed!=1) throw new LocalStoreError(LocalErrorCode.Conflict);
   return Customer(id);
  }
  public LocalProject CreateProject(Guid customerId,string name,string address=null,string status="draft") {
   Customer(customerId);name=Name(name);address=Optional(address,500);status=ProjectStatus(status);
   Guid id=Guid.NewGuid(); string stamp=Now();
   db.Execute(@"INSERT INTO local_projects(workspace_id,id,customer_id,sales_actor_id,name,address,status,revision,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,1,?,?)",Key(workspace),Key(id),Key(customerId),Key(actor),name,address,status,stamp,stamp);
   return Project(id);
  }
  public LocalProject Project(Guid id) {
   var rows=db.Query("SELECT * FROM local_projects WHERE workspace_id=? AND id=?",Key(workspace),Key(id));
   if(rows.Count!=1) throw new LocalStoreError(LocalErrorCode.NotFound);
   return ProjectRow(rows[0]);
  }
  public LocalProjectPage Projects(Guid customerId,int limit=20,int offset=0) {
   Input(limit>=1&&limit<=100&&offset>=0);Customer(customerId);
   LocalProjectPage page=null;
   db.Transaction(()=>{
    long total=(long)db.Query("SELECT COUNT(*) n FROM local_projects WHERE workspace_id=? AND customer_id=?",Key(workspace),Key(customerId))[0]["n"];
    var items=new List<LocalProject>();
    foreach(var row in db.Query("SELECT * FROM local_projects WHERE workspace_id=? AND customer_id=? ORDER BY updated_at DESC,id ASC LIMIT ? OFFSET ?",Key(workspace),Key(customerId),limit,offset))
     items.Add(ProjectRow(row));
    page=new LocalProjectPage {Total=total,Items=items};
   });
   return page;
  }
  public LocalProject UpdateProject(Guid id,long baseRevision,string name,string address,string status) {
   Input(baseRevision>=1);name=Name(name);address=Optional(address,500);status=ProjectStatus(status);
   Project(id);
   int changed=db.Execute(@"UPDATE local_projects SET name=?,address=?,status=?,revision=revision+1,updated_at=?
    WHERE workspace_id=? AND id=? AND revision=?",name,address,status,Now(),Key(workspace),Key(id),baseRevision);
   if(changed!=1) throw new LocalStoreError(LocalErrorCode.Conflict);
   return Project(id);
  }
 }
}
