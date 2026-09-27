using System;
using System.Collections;
using System.IO;
using System.Linq;
using LocalScenes;
using UnityEngine;
using UnityEngine.UIElements;
namespace SmartHome.SceneConsumer {
 public sealed class LocalSceneWorkspace : MonoBehaviour {
  LocalSceneStore store; LocalSceneView view; DemoBootstrap preview; PanelSettings settings; UIDocument document; Font font;
  bool busy;
  [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
  static void EnsureWorkspace() {
   if(!FindFirstObjectByType<LocalSceneWorkspace>()) new GameObject("Local scene workspace").AddComponent<LocalSceneWorkspace>();
  }
  void Start() {
   settings=ScriptableObject.CreateInstance<PanelSettings>();
   settings.scaleMode=PanelScaleMode.ScaleWithScreenSize; settings.referenceResolution=new Vector2Int(1024,768); settings.match=.5f;
   settings.themeStyleSheet=Resources.Load<ThemeStyleSheet>("LocalSceneTheme");
   document=gameObject.AddComponent<UIDocument>(); document.panelSettings=settings;
   var root=document.rootVisualElement;
   root.style.flexGrow=1;
   try {
    if(!settings.themeStyleSheet) throw new InvalidOperationException("UI theme missing");
    string path=Path.Combine(Application.persistentDataPath,"local-scenes.sqlite");
    var identity=LocalIdentity.Open(path);
    var validator=new OfflineSceneValidator(File.ReadAllText(Path.Combine(Application.streamingAssetsPath,"scene.schema.json")));
    store=new LocalSceneStore(path,identity.WorkspaceId,identity.ActorId,validator);
    var session=new LocalSceneSession(store,validator,File.ReadAllText(Path.Combine(Application.streamingAssetsPath,"two-bedroom.json")));
    preview=FindFirstObjectByType<DemoBootstrap>();
    if(!preview) preview=gameObject.AddComponent<DemoBootstrap>();
    view=new LocalSceneView(store,session,Run,preview.Show,preview.Clear);
    var stylesheet=Resources.Load<StyleSheet>("LocalSceneWorkspace");
    if(!stylesheet) throw new InvalidOperationException("UI stylesheet missing");
    view.Root.styleSheets.Add(stylesheet); root.Add(view.Root);
    var names=Font.GetOSInstalledFontNames();
    string chosen=new[]{"PingFang SC","Heiti SC","STHeiti","Microsoft YaHei","SimHei","Noto Sans CJK SC"}.FirstOrDefault(names.Contains);
    if(chosen!=null) {
     font=Font.CreateDynamicFontFromOSFont(chosen,18); view.Root.style.unityFontDefinition=FontDefinition.FromFont(font);
    } else {
     var warning=new Label("Chinese font unavailable. Device font configuration must be verified before delivery.");
     root.Add(warning);
    }
    preview.Orbit.CanGesture=point=>{
     if(view.Root.panel==null) return false;
     return view.CanPreviewAt(RuntimePanelUtils.ScreenToPanel(view.Root.panel,new Vector2(point.x,Screen.height-point.y)));
    };
   } catch(Exception e) {
    if(store!=null) { store.Dispose(); store=null; }
    root.Add(new Label(LocalSceneSession.Friendly(e)));
   }
  }
  void Run(Action action) { if(!busy) StartCoroutine(Process(action)); }
  IEnumerator Process(Action action) {
   busy=true; view.SetBusy(true); yield return null;
   try { action(); }
   catch(Exception e) { view.Notice(LocalSceneSession.Friendly(e)); }
   finally { busy=false; if(view!=null) view.SetBusy(false); }
  }
  void LateUpdate() {
   if(view==null||view.Root.panel==null||preview==null) return;
   var root=document.rootVisualElement.worldBound; if(root.width<=0||root.height<=0||Screen.width<=0||Screen.height<=0) return;
   var safe=Screen.safeArea;
   view.Root.style.paddingLeft=safe.x/Screen.width*root.width;
   view.Root.style.paddingRight=(Screen.width-safe.xMax)/Screen.width*root.width;
   view.Root.style.paddingTop=(Screen.height-safe.yMax)/Screen.height*root.height;
   view.Root.style.paddingBottom=safe.y/Screen.height*root.height;
   var area=view.PreviewArea.worldBound;
   if(area.width>0&&area.height>0) preview.PreviewCamera.rect=new Rect(area.x/root.width,1-area.yMax/root.height,area.width/root.width,area.height/root.height);
  }
  void OnDestroy() {
   StopAllCoroutines(); if(preview&&preview.Orbit) preview.Orbit.CanGesture=null;
   if(store!=null) store.Dispose();
   if(font) Destroy(font); if(settings) Destroy(settings);
  }
 }
}
