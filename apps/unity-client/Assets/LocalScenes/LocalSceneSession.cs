using System;
using System.Linq;
using Newtonsoft.Json.Linq;
using SmartHome.SceneConsumer;
namespace LocalScenes {
 /// <summary>Engine-independent editor session. History is readonly; stale bases never silently rebase.</summary>
 public sealed class LocalSceneSession {
  readonly LocalSceneStore store; readonly OfflineSceneValidator validator; readonly string sample;
  public Guid DocumentId { get; private set; }
  public string Draft { get; private set; }
  public string CurrentJson { get; private set; }
  public string Message { get; private set; }
  public string SavedAt { get; private set; }
  public string HistoryJson { get; private set; }
  public long HistoryRevision { get; private set; }
  public long BaseRevision { get; private set; }
  public bool Dirty { get { return Draft!=CurrentJson; } }
  public LocalSceneSession(LocalSceneStore store,OfflineSceneValidator validator,string sample) {
   if(store==null||validator==null||sample==null) throw new ArgumentNullException();
   this.store=store; this.validator=validator; this.sample=sample; Draft=CurrentJson="";
  }
  public static string Friendly(Exception error) {
   if(error is SceneValidationError) return "场景格式或内容不符合要求，请检查后重试。";
   var local=error as LocalStoreError;
   if(local!=null) switch(local.Code) {
    case LocalErrorCode.Conflict: return "场景已被其他操作更新。你的修改已保留，请确认后重新打开最新版本。";
    case LocalErrorCode.Busy: return "本地资料正在使用中，请稍后重试。";
    case LocalErrorCode.NotFound: return "找不到该场景或版本，请刷新列表。";
    case LocalErrorCode.InvalidInput: return "填写的内容不符合要求，或引用的本地商品不存在。";
    case LocalErrorCode.Corrupt: return "本地资料无法读取，请保留资料并检查备份。";
   }
   return "本地资料操作失败，请重试。资料不会被自动删除。";
  }
  bool Attempt(Action action,string success) {
   try { action(); Message=success; return true; }
   catch(Exception e) { Message=Friendly(e); return false; }
  }
  bool Discard(bool discard) {
   if(!Dirty||discard) return true;
   Message="还有未保存的修改，请先保存或明确放弃修改。"; return false;
  }
  void RequireDocument() { if(DocumentId==Guid.Empty) throw new LocalStoreError(LocalErrorCode.NotFound); }
  void Adopt(Guid id,LocalSceneVersion version) {
   DocumentId=id; BaseRevision=version==null?0:version.Revision;
   Draft=CurrentJson=version==null?"":version.SceneJson;
   SavedAt=version==null?null:version.CreatedAt; HistoryJson=null; HistoryRevision=0;
  }
  public bool New(string name,bool discard=false) {
   if(!Discard(discard)) return false;
   return Attempt(()=>Adopt(store.Create(name),null),"已新建本地场景，请载入示例或填写场景数据。");
  }
  public bool Open(Guid id,bool discard=false) {
   if(!Discard(discard)) return false;
   return Attempt(()=>{ var current=store.Current(id); Adopt(id,current); },"已打开本地场景。");
  }
  public bool LoadSample(bool discard=false) {
   if(!Discard(discard)) return false;
   return Attempt(()=>{
    RequireDocument(); var json=validator.Validate(sample).Copy();
    json["scene_id"]=DocumentId.ToString("D");
    // Explicit offline sample catalog, never submitted to or impersonating the remote merchant catalog.
    foreach(JObject item in (JArray)json["furniture_instances"]) {
     Guid product=SceneUuid.Parse((string)item["product_id"]);
     store.Catalog(product,"离线示例家具",(double)item["width_mm"],(double)item["depth_mm"],(double)item["height_mm"]);
    }
    Draft=validator.Validate(json.ToString()).Export();
   },"两室一厅示例已载入，尚未保存。");
  }
  public void SetDraft(string value) { Draft=value??""; Message="修改尚未保存。"; }
  public bool ChangeRoomName(Guid room,string name) {
   return Attempt(()=>{
    RequireDocument(); var json=validator.Validate(Draft).Copy();
    var item=((JArray)json["rooms"]).OfType<JObject>().FirstOrDefault(x=>SceneUuid.Parse((string)x["id"])==room);
    if(item==null) throw new LocalStoreError(LocalErrorCode.NotFound);
    if(string.IsNullOrWhiteSpace(name)) throw new LocalStoreError(LocalErrorCode.InvalidInput);
    item["name"]=name; Draft=validator.Validate(json.ToString()).Export();
   },"房间名称已修改，尚未保存。");
  }
  public SceneDocument Preview() {
   SceneDocument result=null;
   Attempt(()=>{ RequireDocument(); result=validator.Validate(Draft); },"草稿校验通过，尚未保存的内容仍是草稿。");
   return result;
  }
  public bool Save() {
   if(!Dirty) { Message="当前内容已保存，无需再次保存。"; return false; }
   return Attempt(()=>{ RequireDocument(); var version=store.Put(DocumentId,BaseRevision,Draft); Adopt(DocumentId,version); },"已保存新版本。");
  }
  public bool ViewHistory(long revision) {
   return Attempt(()=>{ RequireDocument(); string json=store.ExportVersion(DocumentId,revision); HistoryJson=json; HistoryRevision=revision; },"正在查看历史版本；当前草稿没有改变。");
  }
  public LocalRestoreIntent CaptureRestore() {
   LocalRestoreIntent result=null;
   Attempt(()=>{ RequireDocument(); if(HistoryRevision<1) throw new LocalStoreError(LocalErrorCode.NotFound);
    result=new LocalRestoreIntent(DocumentId,BaseRevision,HistoryRevision); },"请确认恢复所选历史版本。");
   return result;
  }
  public bool Restore(LocalRestoreIntent intent,bool discard=false) {
   if(!Discard(discard)) return false;
   return Attempt(()=>{ RequireDocument();
    if(intent==null) throw new LocalStoreError(LocalErrorCode.InvalidInput);
    if(intent.DocumentId!=DocumentId||intent.BaseRevision!=BaseRevision) throw new LocalStoreError(LocalErrorCode.Conflict);
    var restored=store.Restore(intent.DocumentId,intent.BaseRevision,intent.Revision); Adopt(intent.DocumentId,restored);
   },"已恢复为新版本，原有历史仍保留。");
  }
  public bool Restore(long revision,bool discard=false) {
   return Restore(new LocalRestoreIntent(DocumentId,BaseRevision,revision),discard);
  }
 }
}
