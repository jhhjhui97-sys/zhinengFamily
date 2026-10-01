using System;
using System.Collections.Generic;
using System.Globalization;
using Newtonsoft.Json.Linq;
using SmartHome.SceneConsumer;
namespace LocalScenes {
/// <summary>Offline library. Workspace and actor are local provenance, never remote authentication.</summary>
public sealed partial class LocalSceneStore : IDisposable {
 readonly SqliteConnection db;
 readonly Guid workspace,actor;
 readonly string databasePath;
 readonly OfflineSceneValidator validator;
 public LocalSceneStore(string path,Guid workspace,Guid actor,OfflineSceneValidator validator) {
  if(workspace==Guid.Empty||actor==Guid.Empty||validator==null) throw new LocalStoreError(LocalErrorCode.InvalidInput);
  this.workspace=workspace; this.actor=actor; this.validator=validator; this.databasePath=path;
  db=new SqliteConnection(path);
  try {
   long format=(long)db.Query("PRAGMA user_version")[0]["user_version"];
   if(format!=0&&format!=1&&format!=2&&format!=3&&format!=4&&format!=5) throw new LocalStoreError(LocalErrorCode.Corrupt);
   // Capture the original database before any schema change. All upgrade stages
   // then commit together, so a later failure cannot leave a partly upgraded v1/v2 file.
   for(int target=2;target<=5;target++) if(format>=1&&format<target) {
    string backup=path+".pre-v"+target+"-"+DateTime.UtcNow.ToString("yyyyMMddHHmmss",CultureInfo.InvariantCulture)+"-"+Guid.NewGuid().ToString("N")+".bak";
    db.BackupTo(backup);
   }
   if(format<5) db.Transaction(()=>{
   if(format<2) {
   if(format==0) {
    db.Execute(@"CREATE TABLE scene_documents(
     id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL, name TEXT NOT NULL,
     current_revision INTEGER CHECK(current_revision>=1), updated_at TEXT,
     UNIQUE(workspace_id,id),
     FOREIGN KEY(workspace_id,id,current_revision)
      REFERENCES scene_versions(workspace_id,document_id,revision) DEFERRABLE INITIALLY DEFERRED)");
    db.Execute(@"CREATE TABLE scene_versions(
     id TEXT NOT NULL UNIQUE, workspace_id TEXT NOT NULL, document_id TEXT NOT NULL,
     revision INTEGER NOT NULL CHECK(revision>=1), scene_data TEXT NOT NULL,
     created_by TEXT NOT NULL, created_at TEXT NOT NULL,
     PRIMARY KEY(document_id,revision), UNIQUE(workspace_id,document_id,revision),
     FOREIGN KEY(workspace_id,document_id) REFERENCES scene_documents(workspace_id,id))");
    db.Execute(@"CREATE TABLE local_catalog(
     workspace_id TEXT NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL,
     width_mm REAL NOT NULL CHECK(width_mm>0), depth_mm REAL NOT NULL CHECK(depth_mm>0),
     height_mm REAL NOT NULL CHECK(height_mm>0), PRIMARY KEY(workspace_id,product_id))");
    db.Execute("CREATE TRIGGER scene_versions_no_update BEFORE UPDATE ON scene_versions BEGIN SELECT RAISE(ABORT,'immutable history'); END");
    db.Execute("CREATE TRIGGER scene_versions_no_delete BEFORE DELETE ON scene_versions BEGIN SELECT RAISE(ABORT,'immutable history'); END");
   }
    db.Execute(@"CREATE TABLE local_customers(
     workspace_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL,
     phone TEXT, wechat TEXT, source TEXT, address TEXT, budget TEXT,
     status TEXT NOT NULL CHECK(status IN ('new','following','won','lost')),
     notes TEXT, revision INTEGER NOT NULL CHECK(revision>=1),
     created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
     PRIMARY KEY(workspace_id,id))");
    db.Execute("CREATE UNIQUE INDEX local_customers_phone ON local_customers(workspace_id,phone) WHERE phone IS NOT NULL AND phone<>''");
    db.Execute(@"CREATE TABLE local_projects(
     workspace_id TEXT NOT NULL, id TEXT NOT NULL, customer_id TEXT NOT NULL,
     sales_actor_id TEXT NOT NULL, name TEXT NOT NULL, address TEXT,
     status TEXT NOT NULL CHECK(status IN ('draft','active','archived')),
     revision INTEGER NOT NULL CHECK(revision>=1),
     created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
     PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,customer_id,name),
     FOREIGN KEY(workspace_id,customer_id) REFERENCES local_customers(workspace_id,id))");
    db.Execute(@"CREATE TABLE project_scenes(
     workspace_id TEXT NOT NULL, project_id TEXT NOT NULL, document_id TEXT NOT NULL,
     PRIMARY KEY(workspace_id,project_id,document_id), UNIQUE(workspace_id,document_id),
     FOREIGN KEY(workspace_id,project_id) REFERENCES local_projects(workspace_id,id),
     FOREIGN KEY(workspace_id,document_id) REFERENCES scene_documents(workspace_id,id))");
    db.Execute("PRAGMA user_version=2");
   }
   if(format<3) {
    db.Execute(@"CREATE TABLE local_products(
     workspace_id TEXT NOT NULL, id TEXT NOT NULL, category TEXT NOT NULL,
     brand TEXT NOT NULL, name TEXT NOT NULL, sku TEXT NOT NULL,
     price TEXT NOT NULL, width_mm REAL NOT NULL CHECK(width_mm>0),
     depth_mm REAL NOT NULL CHECK(depth_mm>0), height_mm REAL NOT NULL CHECK(height_mm>0),
     metadata_json TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>=1),
     created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
     PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,sku))");
    db.Execute("CREATE INDEX local_products_category ON local_products(workspace_id,category)");
    db.Execute("PRAGMA user_version=3");
   }
   if(format<4) {
    db.Execute(@"CREATE TABLE local_model_assets(
     workspace_id TEXT NOT NULL, id TEXT NOT NULL, product_id TEXT NOT NULL,
     sha256 TEXT NOT NULL CHECK(length(sha256)=64), byte_count INTEGER NOT NULL CHECK(byte_count>0),
     created_at TEXT NOT NULL,
     PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,product_id,id),
     FOREIGN KEY(workspace_id,product_id) REFERENCES local_products(workspace_id,id))");
    db.Execute(@"CREATE TABLE local_product_active_model(
     workspace_id TEXT NOT NULL, product_id TEXT NOT NULL, asset_id TEXT NOT NULL,
     PRIMARY KEY(workspace_id,product_id),
     FOREIGN KEY(workspace_id,product_id) REFERENCES local_products(workspace_id,id),
     FOREIGN KEY(workspace_id,product_id,asset_id) REFERENCES local_model_assets(workspace_id,product_id,id))");
    db.Execute("CREATE TRIGGER local_model_assets_no_update BEFORE UPDATE ON local_model_assets BEGIN SELECT RAISE(ABORT,'immutable asset'); END");
    db.Execute("CREATE TRIGGER local_model_assets_no_delete BEFORE DELETE ON local_model_assets BEGIN SELECT RAISE(ABORT,'immutable asset'); END");
    db.Execute("PRAGMA user_version=4");
   }
   if(format<5) {
    db.Execute("CREATE UNIQUE INDEX IF NOT EXISTS local_projects_quote_scope ON local_projects(workspace_id,id,customer_id)");
    db.Execute(@"CREATE TABLE local_quotations(
     workspace_id TEXT NOT NULL,id TEXT NOT NULL,customer_id TEXT NOT NULL,
     project_id TEXT NOT NULL,document_id TEXT NOT NULL,scene_revision INTEGER NOT NULL CHECK(scene_revision>=1),
     customer_name TEXT NOT NULL,project_name TEXT NOT NULL,scene_name TEXT NOT NULL,
     currency TEXT NOT NULL CHECK(currency='CNY'),total_cents INTEGER NOT NULL CHECK(total_cents>=0),
     excluded_demo_count INTEGER NOT NULL CHECK(excluded_demo_count>=0),
     created_by TEXT NOT NULL,created_at TEXT NOT NULL,
     PRIMARY KEY(workspace_id,id),
     FOREIGN KEY(workspace_id,customer_id) REFERENCES local_customers(workspace_id,id),
     FOREIGN KEY(workspace_id,project_id,customer_id) REFERENCES local_projects(workspace_id,id,customer_id),
     FOREIGN KEY(workspace_id,project_id,document_id) REFERENCES project_scenes(workspace_id,project_id,document_id),
     FOREIGN KEY(workspace_id,document_id,scene_revision) REFERENCES scene_versions(workspace_id,document_id,revision))");
    db.Execute(@"CREATE TABLE local_quotation_lines(
     workspace_id TEXT NOT NULL,quotation_id TEXT NOT NULL,product_id TEXT NOT NULL,
     product_name TEXT NOT NULL,sku TEXT NOT NULL,unit_price TEXT NOT NULL,
     unit_cents INTEGER NOT NULL CHECK(unit_cents>=0),quantity INTEGER NOT NULL CHECK(quantity>0),
     line_cents INTEGER NOT NULL CHECK(line_cents>=0),
     PRIMARY KEY(workspace_id,quotation_id,product_id),
     FOREIGN KEY(workspace_id,quotation_id) REFERENCES local_quotations(workspace_id,id))");
    db.Execute(@"CREATE TABLE local_quotation_exclusions(
     workspace_id TEXT NOT NULL,quotation_id TEXT NOT NULL,instance_id TEXT NOT NULL,
     product_id TEXT NOT NULL,name TEXT NOT NULL,
     PRIMARY KEY(workspace_id,quotation_id,instance_id),
     FOREIGN KEY(workspace_id,quotation_id) REFERENCES local_quotations(workspace_id,id))");
    db.Execute("CREATE INDEX local_quotations_project ON local_quotations(workspace_id,project_id,created_at DESC,id)");
    db.Execute("CREATE TRIGGER local_quotations_no_update BEFORE UPDATE ON local_quotations BEGIN SELECT RAISE(ABORT,'immutable quotation'); END");
    db.Execute("CREATE TRIGGER local_quotations_no_delete BEFORE DELETE ON local_quotations BEGIN SELECT RAISE(ABORT,'immutable quotation'); END");
    db.Execute("CREATE TRIGGER local_quotation_lines_no_update BEFORE UPDATE ON local_quotation_lines BEGIN SELECT RAISE(ABORT,'immutable quotation line'); END");
    db.Execute("CREATE TRIGGER local_quotation_lines_no_delete BEFORE DELETE ON local_quotation_lines BEGIN SELECT RAISE(ABORT,'immutable quotation line'); END");
    db.Execute("CREATE TRIGGER local_quotation_exclusions_no_update BEFORE UPDATE ON local_quotation_exclusions BEGIN SELECT RAISE(ABORT,'immutable quotation exclusion'); END");
    db.Execute("CREATE TRIGGER local_quotation_exclusions_no_delete BEFORE DELETE ON local_quotation_exclusions BEGIN SELECT RAISE(ABORT,'immutable quotation exclusion'); END");
    db.Execute("PRAGMA user_version=5");
   }
   });
  } catch { db.Dispose(); throw; }
 }
 static string Key(Guid id) { return id.ToString("D"); }
 static string Now() { return DateTime.UtcNow.ToString("o",CultureInfo.InvariantCulture); }
 static void Input(bool valid) { if(!valid) throw new LocalStoreError(LocalErrorCode.InvalidInput); }
 Dictionary<string,object> Document(Guid id) {
  var rows=db.Query("SELECT * FROM scene_documents WHERE workspace_id=? AND id=?",Key(workspace),Key(id));
  if(rows.Count!=1) throw new LocalStoreError(LocalErrorCode.NotFound); return rows[0];
 }
 static long Revision(Dictionary<string,object> document) { return document["current_revision"]==null?0:(long)document["current_revision"]; }
 public Guid Create(string name) {
  Input(!string.IsNullOrWhiteSpace(name)&&name.Length<=200);
  Guid id=Guid.NewGuid();
  db.Execute("INSERT INTO scene_documents(id,workspace_id,name) VALUES(?,?,?)",Key(id),Key(workspace),name.Trim());
  return id;
 }
 public void Catalog(Guid product,string name,double width,double depth,double height) {
  Input(product!=Guid.Empty&&!string.IsNullOrWhiteSpace(name)&&name.Length<=200);
  foreach(double size in new[]{width,depth,height}) Input(size>0&&!double.IsInfinity(size)&&!double.IsNaN(size));
  db.Transaction(()=>{
   // Portable to the iOS system SQLite; avoid recent UPSERT syntax.
   db.Execute("INSERT OR IGNORE INTO local_catalog VALUES(?,?,?,?,?,?)",Key(workspace),Key(product),name,width,depth,height);
   db.Execute("UPDATE local_catalog SET name=?,width_mm=?,depth_mm=?,height_mm=? WHERE workspace_id=? AND product_id=?",name,width,depth,height,Key(workspace),Key(product));
  });
 }
 void Products(SceneDocument scene) {
  var array=scene.Copy()["furniture_instances"] as JArray;
  if(array==null) return;
  foreach(JObject item in array) {
   string value=(string)item["product_id"];
   if(value.StartsWith("urn:uuid:",StringComparison.Ordinal)) value=value.Substring(9);
   Guid product=Guid.Parse(value); // Already checked by the authoritative offline validator.
   string assetText=(string)item["asset_id"];
   if(assetText==null) {
    Input(db.Query("SELECT product_id FROM local_catalog WHERE workspace_id=? AND product_id=?",Key(workspace),Key(product)).Count==1);
   } else {
    if(assetText.StartsWith("urn:uuid:",StringComparison.Ordinal)) assetText=assetText.Substring(9);
    Guid asset;Input(Guid.TryParse(assetText,out asset)&&asset!=Guid.Empty);
    Input(db.Query("SELECT id FROM local_model_assets WHERE workspace_id=? AND product_id=? AND id=?",Key(workspace),Key(product),Key(asset)).Count==1);
   }
  }
 }
 public LocalSceneVersion Put(Guid document,long baseRevision,string scene) {
  Input(baseRevision>=0&&baseRevision<long.MaxValue);
  SceneDocument validated=validator.Validate(scene);
  LocalSceneVersion result=null;
  db.Transaction(()=>{ Expect(document,baseRevision); result=Append(document,baseRevision,validated); });
  return result;
 }
 void Expect(Guid document,long baseline) {
  if(Revision(Document(document))!=baseline) throw new LocalStoreError(LocalErrorCode.Conflict);
 }
 LocalSceneVersion Append(Guid document,long baseline,SceneDocument scene) {
  Products(scene);
  long revision=baseline+1; string stamp=Now(),json=scene.Export(); Guid id=Guid.NewGuid();
  db.Execute("INSERT INTO scene_versions(id,workspace_id,document_id,revision,scene_data,created_by,created_at) VALUES(?,?,?,?,?,?,?)",
   Key(id),Key(workspace),Key(document),revision,json,Key(actor),stamp);
  int changed=db.Execute("UPDATE scene_documents SET current_revision=?,updated_at=? WHERE workspace_id=? AND id=? AND COALESCE(current_revision,0)=?",
   revision,stamp,Key(workspace),Key(document),baseline);
  if(changed!=1) throw new LocalStoreError(LocalErrorCode.Conflict);
  return new LocalSceneVersion { Id=id,DocumentId=document,WorkspaceId=workspace,Revision=revision,CreatedBy=actor,CreatedAt=stamp,SceneJson=json };
 }
 public LocalSceneVersion Restore(Guid document,long baseRevision,long revision) {
  Input(baseRevision>=0&&baseRevision<long.MaxValue&&revision>=1);
  LocalSceneVersion result=null;
  db.Transaction(()=>{
   Expect(document,baseRevision);
   var previous=Version(document,revision);
   result=Append(document,baseRevision,validator.Validate(previous.SceneJson));
  });
  return result;
 }
 static LocalSceneVersion Row(Dictionary<string,object> row) {
  return new LocalSceneVersion { Id=Guid.Parse((string)row["id"]),DocumentId=Guid.Parse((string)row["document_id"]),
   WorkspaceId=Guid.Parse((string)row["workspace_id"]),Revision=(long)row["revision"],
   CreatedBy=Guid.Parse((string)row["created_by"]),CreatedAt=(string)row["created_at"],SceneJson=(string)row["scene_data"] };
 }
 LocalSceneVersion Version(Guid document,long revision) {
  var rows=db.Query("SELECT * FROM scene_versions WHERE workspace_id=? AND document_id=? AND revision=?",Key(workspace),Key(document),revision);
  if(rows.Count!=1) throw new LocalStoreError(LocalErrorCode.NotFound); return Row(rows[0]);
 }
 public LocalSceneVersion Current(Guid document) {
  Document(document);
  var rows=db.Query(@"SELECT v.* FROM scene_versions v JOIN scene_documents d
   ON v.workspace_id=d.workspace_id AND v.document_id=d.id AND v.revision=d.current_revision
   WHERE d.workspace_id=? AND d.id=?",Key(workspace),Key(document));
  if(rows.Count==0) return null;
  var result=Row(rows[0]); validator.Validate(result.SceneJson); return result;
 }
 public List<LocalSceneVersion> Versions(Guid document,int limit=20,int offset=0) {
  Input(limit>=1&&limit<=100&&offset>=0); Document(document);
  var result=new List<LocalSceneVersion>();
  foreach(var row in db.Query("SELECT * FROM scene_versions WHERE workspace_id=? AND document_id=? ORDER BY revision DESC LIMIT ? OFFSET ?",Key(workspace),Key(document),limit,offset))
   result.Add(Row(row));
  return result;
 }
 public string ExportVersion(Guid document,long revision) {
  Input(revision>=1); Document(document);
  string json=Version(document,revision).SceneJson;
  validator.Validate(json); return json;
 }
public LocalScenePage Documents(int limit=20,int offset=0) {
  Input(limit>=1&&limit<=100&&offset>=0);
  LocalScenePage result=null;
  db.Transaction(()=>{
   var items=new List<LocalSceneSummary>();
   long total=(long)db.Query("SELECT COUNT(*) n FROM scene_documents WHERE workspace_id=?",Key(workspace))[0]["n"];
   foreach(var row in db.Query(@"SELECT id,name,current_revision,updated_at FROM scene_documents
    WHERE workspace_id=? ORDER BY COALESCE(updated_at,'') DESC,id ASC LIMIT ? OFFSET ?",Key(workspace),limit,offset))
    items.Add(new LocalSceneSummary { Id=Guid.Parse((string)row["id"]),Name=(string)row["name"],
     Revision=Revision(row),UpdatedAt=(string)row["updated_at"] });
   result=new LocalScenePage { Total=total,Items=items };
  });
  return result;
 }

 public void BackupTo(string path) { db.BackupTo(path); }
 public void Dispose() { db.Dispose(); }
}
}
