using System;
using System.Collections.Generic;
namespace LocalScenes {
 public sealed class LocalIdentity {
  public Guid WorkspaceId { get; private set; }
  public Guid ActorId { get; private set; }
  public static LocalIdentity Open(string path) {
   LocalIdentity result=null;
   using(var db=new SqliteConnection(path)) db.Transaction(()=>{
    long format=(long)db.Query("PRAGMA user_version")[0]["user_version"];
    if(format!=0&&format!=1) throw new LocalStoreError(LocalErrorCode.Corrupt);
    var workspaces=new HashSet<Guid>();
    foreach(string table in new[]{"scene_documents","local_catalog"}) {
     if(db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name=?",table).Count==0) continue;
     foreach(var row in db.Query("SELECT DISTINCT workspace_id FROM "+table)) {
      Guid id; if(!Guid.TryParse((string)row["workspace_id"],out id)||id==Guid.Empty) throw new LocalStoreError(LocalErrorCode.Corrupt);
      workspaces.Add(id);
     }
    }
    db.Execute(@"CREATE TABLE IF NOT EXISTS local_identity(
     singleton INTEGER PRIMARY KEY CHECK(singleton=1), workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL)");
    var rows=db.Query("SELECT workspace_id,actor_id FROM local_identity WHERE singleton=1");
    Guid workspace,actor;
    if(rows.Count==1) {
     if(!Guid.TryParse((string)rows[0]["workspace_id"],out workspace)||workspace==Guid.Empty||
        !Guid.TryParse((string)rows[0]["actor_id"],out actor)||actor==Guid.Empty) throw new LocalStoreError(LocalErrorCode.Corrupt);
     foreach(Guid id in workspaces) if(id!=workspace) throw new LocalStoreError(LocalErrorCode.Corrupt);
    } else {
     if(workspaces.Count>1) throw new LocalStoreError(LocalErrorCode.Corrupt);
     workspace=Guid.NewGuid(); foreach(Guid id in workspaces) workspace=id;
     actor=Guid.NewGuid();
     db.Execute("INSERT INTO local_identity VALUES(1,?,?)",workspace.ToString("D"),actor.ToString("D"));
    }
    result=new LocalIdentity { WorkspaceId=workspace,ActorId=actor };
   });
   return result;
  }
 }
}
