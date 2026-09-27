using System;
using System.Collections;
using System.IO;
using System.Linq;
using LocalScenes;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UIElements;
namespace SmartHome.SceneConsumer.Tests {
 public class LocalSceneViewTests {
  sealed class Fixture : IDisposable {
   readonly string dir; readonly GameObject host; readonly PanelSettings settings;
   public LocalSceneStore Store; public LocalSceneSession Session; public LocalSceneView View;
   public Fixture(Action<SceneDocument> preview=null) {
    dir=Path.Combine(Path.GetTempPath(),"local-view-"+Guid.NewGuid()); Directory.CreateDirectory(dir);
    string path=Path.Combine(dir,"local.sqlite"); var identity=LocalIdentity.Open(path);
    var validator=new OfflineSceneValidator(File.ReadAllText(Path.Combine(Application.streamingAssetsPath,"scene.schema.json")));
    Store=new LocalSceneStore(path,identity.WorkspaceId,identity.ActorId,validator);
    Session=new LocalSceneSession(Store,validator,File.ReadAllText(Path.Combine(Application.streamingAssetsPath,"two-bedroom.json")));
    Session.New("场景"); Session.LoadSample(); Session.Save();
    settings=ScriptableObject.CreateInstance<PanelSettings>();
    settings.themeStyleSheet=Resources.Load<ThemeStyleSheet>("LocalSceneTheme");
    Assert.That(settings.themeStyleSheet,Is.Not.Null);
    host=new GameObject("Toolkit test panel"); var document=host.AddComponent<UIDocument>(); document.panelSettings=settings;
    View=new LocalSceneView(Store,Session,action=>action(),preview??(scene=>{}),()=>{});
    View.Root.styleSheets.Add(Resources.Load<StyleSheet>("LocalSceneWorkspace"));
    document.rootVisualElement.Add(View.Root);
   }
   public void Click(string text) {
    var button=View.Root.Query<Button>().ToList().First(b=>b.text==text);
    using(var submit=NavigationSubmitEvent.GetPooled()) button.SendEvent(submit);
   }
   public void Dispose() { if(host) UnityEngine.Object.DestroyImmediate(host); if(settings) UnityEngine.Object.DestroyImmediate(settings); Store.Dispose(); Directory.Delete(dir,true); }
  }
  [Test] public void AdvancedDraftFieldEditsSessionWithoutSaving() {
   using(var f=new Fixture()) {
    f.View.Root.Q<TextField>("draft-json").value="{}";
    Assert.That(f.Session.Draft,Is.EqualTo("{}")); Assert.That(f.Session.Dirty,Is.True);
    Assert.That(f.Store.Current(f.Session.DocumentId).Revision,Is.EqualTo(1));
    Assert.That(f.View.Root.Q<TextField>("current-json").isReadOnly,Is.True);
   }
  }
  [Test] public void HistoricalJsonIsReadonlyAndDraftRemainsCurrent() {
   using(var f=new Fixture()) {
    f.Session.SetDraft(f.Session.Draft+" "); f.Session.Save(); string draft=f.Session.Draft;
    f.Session.ViewHistory(1); f.View.Refresh();
    Assert.That(f.View.Root.Q<TextField>("history-json").isReadOnly,Is.True);
    Assert.That(f.View.Root.Q<TextField>("history-json").value,Is.EqualTo(f.Session.HistoryJson));
    Assert.That(f.Session.Draft,Is.EqualTo(draft)); Assert.That(f.Session.BaseRevision,Is.EqualTo(2));
   }
  }
  [Test] public void RestoreModalBlocksUnderlyingControlsAndCapturesTarget() {
   using(var f=new Fixture()) {
    f.Session.SetDraft(f.Session.Draft+" "); f.Session.Save(); f.Session.ViewHistory(1); f.View.Refresh();
    f.Click("将查看的历史恢复为新版本");
    Assert.That(f.View.Root.Q<VisualElement>("confirmation"),Is.Not.Null);
    Assert.That(f.View.Root.Query<Button>().ToList().First(b=>b.text=="保存版本").enabledInHierarchy,Is.False);
    string draft=f.Session.Draft;
    f.View.Root.Q<TextField>("draft-json").value="{}";
    Assert.That(f.Session.Draft,Is.EqualTo(draft));
    f.Session.ViewHistory(2); // A changed selection outside the panel must not alter the captured operation.
    f.Click("确认恢复");
    Assert.That(f.Session.BaseRevision,Is.EqualTo(3));
    Assert.That(f.Session.Draft,Is.EqualTo(f.Store.ExportVersion(f.Session.DocumentId,1)));
   }
  }
  [Test] public void ModalCancelPreservesDraftAndBusyBlocksEditingAndSave() {
   using(var f=new Fixture()) {
    f.Session.SetDraft(f.Session.Draft+" "); f.View.Refresh(); string draft=f.Session.Draft;
    f.Click("载入两室一厅"); Assert.That(f.View.Root.Q<VisualElement>("confirmation"),Is.Not.Null);
    f.Click("继续编辑"); Assert.That(f.Session.Draft,Is.EqualTo(draft)); Assert.That(f.Store.Versions(f.Session.DocumentId).Count,Is.EqualTo(1));
    f.View.SetBusy(true); f.View.Root.Q<TextField>("draft-json").value="{}"; f.Click("保存版本");
    Assert.That(f.Session.Draft,Is.EqualTo(draft)); Assert.That(f.Store.Versions(f.Session.DocumentId).Count,Is.EqualTo(1));
    f.View.SetBusy(false); f.View.Refresh();
   }
  }
  [Test] public void SuccessfulSaveSurvivesPreviewFailureAndWarningRemainsVisible() {
   using(var f=new Fixture(scene=>{ throw new InvalidOperationException("renderer failure"); })) {
    f.Session.SetDraft(f.Session.Draft+" "); f.View.Refresh(); f.Click("保存版本");
    Assert.That(f.Store.Current(f.Session.DocumentId).Revision,Is.EqualTo(2)); Assert.That(f.Session.Dirty,Is.False);
    Assert.That(f.View.Root.Q<Label>("operation-status").text,Does.Contain("无法预览"));
    Assert.That(f.View.Root.Q<Label>("operation-status").text,Does.Not.Contain("renderer failure"));
   }
  }
  [UnityTest] public IEnumerator AttachedPanelFocusAndModalBlockPreviewInput() {
   using(var f=new Fixture()) {
    yield return null; yield return null;
    Assert.That(f.View.Root.panel,Is.Not.Null);
    var center=f.View.PreviewArea.worldBound.center;
    Assert.That(f.View.PreviewArea.worldBound.width,Is.GreaterThan(0));
    Assert.That(f.View.CanPreviewAt(center),Is.True);
    Assert.That(f.View.CanPreviewAt(new Vector2(-100,-100)),Is.False);
    var field=f.View.Root.Q<TextField>("draft-json"); field.Focus(); yield return null;
    Assert.That(f.View.CanPreviewAt(center),Is.False);
    field.Blur(); f.View.Root.Focus(); yield return null;
    Assert.That(f.View.CanPreviewAt(center),Is.True);
    f.Session.ViewHistory(1); f.View.Refresh(); f.Click("将查看的历史恢复为新版本");
    Assert.That(f.View.CanPreviewAt(center),Is.False);
   }
  }
  [Test] public void CameraViewportUsesPanelOriginAndFlipsVerticalAxis() {
   Rect result=LocalSceneWorkspace.Viewport(new Rect(220,130,600,300),new Rect(20,30,1000,700));
   Assert.That(result.x,Is.EqualTo(.2f).Within(.00001)); Assert.That(result.y,Is.EqualTo(3f/7).Within(.00001));
   Assert.That(result.width,Is.EqualTo(.6f).Within(.00001)); Assert.That(result.height,Is.EqualTo(3f/7).Within(.00001));
  }
 }
}
