using System;
using System.Linq;
using LocalScenes;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.UIElements;
namespace SmartHome.SceneConsumer {
 /// <summary>Toolkit adapter. All persistence and conflict rules are owned by the tested session.</summary>
 public sealed class LocalSceneView {
  readonly LocalSceneStore store; readonly LocalSceneSession session;
  readonly Action<Action> runner; readonly Action<SceneDocument> preview; readonly Action clearPreview;
  readonly VisualElement library,editor,modalHost; readonly ScrollView documents,versions,roomFields;
  readonly Label status,summary,libraryPage,historyPage; readonly TextField draft,current,history,newName;
  readonly Button save,libraryPrevious,libraryNext,historyPrevious,historyNext;
  int documentOffset,versionOffset; VisualElement modal; string previewNotice="";
  public VisualElement Root { get; private set; }
  public VisualElement PreviewArea { get; private set; }
  public LocalSceneView(LocalSceneStore store,LocalSceneSession session,Action<Action> runner,Action<SceneDocument> preview,Action clearPreview) {
   this.store=store; this.session=session; this.runner=runner; this.preview=preview; this.clearPreview=clearPreview;
   Root=new VisualElement { name="local-workspace",focusable=true }; Root.AddToClassList("workspace");
   var header=Row(Root); header.AddToClassList("header");
   header.Add(new Label("智能家居 · 本地场景"));
   Button(header,"场景库",()=>library.style.display=library.style.display==DisplayStyle.None?DisplayStyle.Flex:DisplayStyle.None);
   var main=Row(Root); main.AddToClassList("main");
   library=Panel(main,"library");
   newName=Field(library,"资料名称","new-name"); newName.value="新场景";
   Button(library,"新建场景",()=>Request(discard=>{
    if(session.New(newName.value,discard)) { versionOffset=0; clearPreview(); }
   }));
   Button(library,"刷新场景库",()=>Run(()=>{}));
   documents=new ScrollView(); documents.AddToClassList("library-list"); library.Add(documents);
   libraryPage=new Label(); library.Add(libraryPage);
   var page=Row(library);
   libraryPrevious=Button(page,"上一页",()=>Run(()=>documentOffset=Math.Max(0,documentOffset-20)));
   libraryNext=Button(page,"下一页",()=>Run(()=>documentOffset+=20));
   var right=Panel(main,"right");
   PreviewArea=new VisualElement { name="scene-preview",pickingMode=PickingMode.Ignore };
   PreviewArea.AddToClassList("preview"); right.Add(PreviewArea);
   var hint=new Label("拖动查看 · 双指缩放\n墙与家具为代理几何，门窗尚未切洞");
   hint.pickingMode=PickingMode.Ignore; hint.AddToClassList("preview-hint"); PreviewArea.Add(hint);
   var scroll=new ScrollView(); scroll.AddToClassList("editor-scroll"); right.Add(scroll);
   editor=scroll.contentContainer;
   summary=new Label("请选择或新建场景"); summary.AddToClassList("summary"); editor.Add(summary);
   var actions=Row(editor);
   Button(actions,"载入两室一厅",()=>Request(discard=>{ if(session.LoadSample(discard)) DrawDraft(); }));
   save=Button(actions,"保存版本",()=>Run(()=>{
    if(session.Save()) DrawSaved();
   }));
   Button(actions,"查看草稿",()=>Run(()=>DrawDraft()));
   Button(actions,"重新打开最新",()=>Request(discard=>{
    if(session.Open(session.DocumentId,discard)) { versionOffset=0; DrawSaved(); }
   }));
   roomFields=new ScrollView(); roomFields.AddToClassList("room-fields"); editor.Add(roomFields);
   var advanced=new Foldout { text="高级：编辑场景 JSON",value=false }; editor.Add(advanced);
   draft=Field(advanced,"草稿 JSON","draft-json"); draft.multiline=true; draft.maxLength=8*1024*1024; draft.AddToClassList("json");
   draft.RegisterValueChangedCallback(e=>{ session.SetDraft(e.newValue); UpdateStatus(); });
   var saved=new Foldout { text="当前保存的 JSON（只读）",value=false }; editor.Add(saved);
   current=JsonField(saved,"current-json");
   var historySection=new Foldout { text="版本历史",value=true }; editor.Add(historySection);
   versions=new ScrollView(); versions.AddToClassList("history-list"); historySection.Add(versions);
   historyPage=new Label(); historySection.Add(historyPage);
   var historyButtons=Row(historySection);
   historyPrevious=Button(historyButtons,"上一页版本",()=>Run(()=>versionOffset=Math.Max(0,versionOffset-20)));
   historyNext=Button(historyButtons,"下一页版本",()=>Run(()=>versionOffset+=20));
   history=JsonField(historySection,"history-json");
   Button(historySection,"将查看的历史恢复为新版本",()=>Request(discard=>{
    if(session.Restore(session.HistoryRevision,discard)) { versionOffset=0; DrawSaved(); }
   },true));
   status=new Label(); status.name="operation-status"; status.AddToClassList("status"); Root.Add(status);
   modalHost=new VisualElement { pickingMode=PickingMode.Ignore }; modalHost.AddToClassList("modal-host"); Root.Add(modalHost);
   Refresh();
  }
  static VisualElement Row(VisualElement parent) { var row=new VisualElement(); row.AddToClassList("row"); parent.Add(row); return row; }
  static VisualElement Panel(VisualElement parent,string name) { var panel=new VisualElement(); panel.AddToClassList(name); parent.Add(panel); return panel; }
  static Button Button(VisualElement parent,string text,Action action) { var button=new Button(action) { text=text }; parent.Add(button); return button; }
  static TextField Field(VisualElement parent,string label,string name) { var field=new TextField(label) { name=name }; parent.Add(field); return field; }
  static TextField JsonField(VisualElement parent,string name) { var field=Field(parent,"",name); field.multiline=true; field.isReadOnly=true; field.AddToClassList("json"); return field; }
  void Run(Action action) { runner(()=>{ action(); Refresh(); }); }
  void Request(Action<bool> action,bool restore=false) {
   if(!session.Dirty&&!restore) { Run(()=>action(false)); return; }
   if(modal!=null) return;
   draft.Blur(); modal=new VisualElement(); modal.AddToClassList("confirm"); modalHost.Add(modal);
   modal.Add(new Label(restore?"将历史恢复为一个新版本。未保存的修改会被放弃，已有历史仍保留。":"还有未保存的修改，继续会放弃这些修改。"));
   Button(modal,"继续编辑",CloseModal);
   Button(modal,restore?"确认恢复":"放弃修改并继续",()=>{ CloseModal(); Run(()=>action(true)); });
  }
  void CloseModal() { if(modal!=null) { modal.RemoveFromHierarchy(); modal=null; } }
  void DrawDraft() { var scene=session.Preview(); if(scene!=null) Draw(scene); }
  void DrawSaved() {
   if(string.IsNullOrEmpty(session.CurrentJson)) { clearPreview(); return; }
   Draw(SceneDocument.Parse(session.CurrentJson));
  }
  void Draw(SceneDocument scene) {
   try { preview(scene); previewNotice=""; }
   catch { previewNotice="资料已保留，但当前场景无法预览。请检查几何范围。"; }
  }
  public void SetBusy(bool value) { Root.SetEnabled(!value); if(value) status.text="正在处理，请稍候…"; }
  public void Notice(string message) { status.text=message; }
  void UpdateStatus() { status.text=session.Message+(previewNotice.Length>0?"\n"+previewNotice:""); save.SetEnabled(session.DocumentId!=Guid.Empty&&session.Dirty); }
  public void Refresh() {
   try {
    var page=store.Documents(20,documentOffset);
    if(page.Items.Count==0&&documentOffset>0) { documentOffset=Math.Max(0,documentOffset-20); page=store.Documents(20,documentOffset); }
    documents.Clear();
    foreach(var item in page.Items) {
     var entry=item;
     Button(documents,entry.Name+" · "+(entry.Revision==0?"未保存":"v"+entry.Revision),()=>Request(discard=>{
      if(session.Open(entry.Id,discard)) { versionOffset=0; DrawSaved(); }
     }));
    }
    if(page.Total==0) documents.Add(new Label("还没有本地场景，请新建。"));
    libraryPage.text=page.Total==0?"共 0 个场景":"显示 "+(documentOffset+1)+"–"+(documentOffset+page.Items.Count)+" / 共 "+page.Total+" 个";
    libraryPrevious.SetEnabled(documentOffset>0); libraryNext.SetEnabled(documentOffset+20<page.Total);
    draft.SetValueWithoutNotify(session.Draft); current.SetValueWithoutNotify(session.CurrentJson);
    history.SetValueWithoutNotify(session.HistoryJson??"");
    roomFields.Clear(); versions.Clear();
    summary.text=session.DocumentId==Guid.Empty?"请选择或新建场景":session.BaseRevision==0?"尚未保存场景":"当前 v"+session.BaseRevision+" · 保存于 "+session.SavedAt;
    if(!string.IsNullOrEmpty(session.CurrentJson)) {
     var snapshot=SceneDocument.Parse(session.CurrentJson).Copy();
     summary.text+="\n房间 "+((JArray)snapshot["rooms"]).Count+" · 墙 "+((JArray)snapshot["walls"]).Count+
      " · 门 "+((JArray)snapshot["doors"]).Count+" · 窗 "+((JArray)snapshot["windows"]).Count+" · 家具 "+((JArray)snapshot["furniture_instances"]).Count;
    }
    try {
     var rooms=SceneDocument.Parse(session.Draft).Copy()["rooms"] as JArray;
     foreach(JObject room in rooms) {
      Guid id=SceneUuid.Parse((string)room["id"]); var row=Row(roomFields);
      var field=Field(row,"房间名称","room-"+id); field.value=(string)room["name"];
      Button(row,"应用名称",()=>Run(()=>session.ChangeRoomName(id,field.value)));
     }
    } catch { roomFields.Add(new Label("载入示例后可修改房间名称。高级 JSON 须符合场景协议。")); }
    int count=0;
    if(session.DocumentId!=Guid.Empty) foreach(var version in store.Versions(session.DocumentId,20,versionOffset)) {
     long revision=version.Revision; count++;
     Button(versions,"查看 v"+revision+" · "+version.CreatedAt,()=>Run(()=>session.ViewHistory(revision)));
    }
    historyPage.text=session.HistoryRevision>0?"正在只读查看 v"+session.HistoryRevision:"选择一个版本查看只读 JSON";
    historyPrevious.SetEnabled(versionOffset>0); historyNext.SetEnabled(count==20);
    UpdateStatus();
   } catch(Exception e) { Notice(LocalSceneSession.Friendly(e)); }
  }
  public bool CanPreviewAt(Vector2 panelPoint) {
   if(modal!=null||!Root.enabledInHierarchy||!PreviewArea.worldBound.Contains(panelPoint)) return false;
   var focused=Root.panel==null?null:Root.panel.focusController.focusedElement as VisualElement;
   for(var element=focused;element!=null;element=element.parent) if(element is TextField) return false;
   return true;
  }
 }
}
