using System.Linq;
using UnityEngine;
namespace SmartHome.SceneConsumer {
 /// <summary>Presentation only. Durable scene data belongs to LocalSceneStore, never a Unity scene file.</summary>
 public sealed class DemoBootstrap : MonoBehaviour {
  GameObject sceneRoot; OrbitCamera orbit; Camera previewCamera;
  public OrbitCamera Orbit { get { return orbit; } }
  public Camera PreviewCamera { get { return previewCamera; } }
  void Awake() {
   var cameraObject=new GameObject("Preview camera"); cameraObject.transform.SetParent(transform,false);
   previewCamera=cameraObject.AddComponent<Camera>(); previewCamera.backgroundColor=new Color(.95f,.96f,.98f); previewCamera.clearFlags=CameraClearFlags.SolidColor;
   orbit=cameraObject.AddComponent<OrbitCamera>();
   var lightObject=new GameObject("Preview light"); lightObject.transform.SetParent(transform,false);
   var light=lightObject.AddComponent<Light>(); light.type=LightType.Directional; light.intensity=1.2f;
   light.transform.rotation=Quaternion.Euler(55,-25,0);
  }
  public void Show(SceneDocument document) {
   var replacement=SceneRenderer.Build(document,transform);
   if(sceneRoot) { sceneRoot.SetActive(false); Destroy(sceneRoot); }
   sceneRoot=replacement; Frame();
  }
  public void Clear() { if(sceneRoot) { sceneRoot.SetActive(false); Destroy(sceneRoot); sceneRoot=null; } }
  public void Frame() {
   if(!sceneRoot) return;
   var renderers=sceneRoot.GetComponentsInChildren<Renderer>();
   var bounds=renderers.Length>0?renderers[0].bounds:new Bounds(Vector3.zero,Vector3.one);
   for(int i=1;i<renderers.Length;i++) bounds.Encapsulate(renderers[i].bounds); orbit.Frame(bounds);
  }
 }
}
