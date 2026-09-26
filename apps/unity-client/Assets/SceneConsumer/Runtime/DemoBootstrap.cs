using System.IO;
using System.Linq;
using UnityEngine;
namespace SmartHome.SceneConsumer
{
    public sealed class DemoBootstrap : MonoBehaviour
    {
        GameObject sceneRoot; OrbitCamera orbit; string status="正在载入示例…";
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void EnsureDemo() { if(!FindFirstObjectByType<DemoBootstrap>()) new GameObject("SceneModel demo").AddComponent<DemoBootstrap>(); }
        void Awake() {
            var cameraObject=new GameObject("Preview camera"); cameraObject.transform.SetParent(transform,false);
            var camera=cameraObject.AddComponent<Camera>(); camera.backgroundColor=new Color(.95f,.96f,.98f); camera.clearFlags=CameraClearFlags.SolidColor;
            orbit=cameraObject.AddComponent<OrbitCamera>();
            var lightObject=new GameObject("Preview light"); lightObject.transform.SetParent(transform,false);
            var light=lightObject.AddComponent<Light>(); light.type=LightType.Directional; light.intensity=1.2f; light.transform.rotation=Quaternion.Euler(55,-25,0);
            LoadSample();
        }
        void LoadSample() {
            try {
                var document=SceneDocument.Parse(File.ReadAllText(Path.Combine(Application.streamingAssetsPath,"two-bedroom.json")));
                var replacement=SceneRenderer.Build(document,transform);
                if(sceneRoot) { sceneRoot.SetActive(false); Destroy(sceneRoot); }
                sceneRoot=replacement; Frame(); var json=document.Copy();
                status="两室一厅 · 房间 "+json["rooms"].Count()+" · 墙 "+json["walls"].Count()+" · 家具 "+json["furniture_instances"].Count();
            } catch { status="场景加载失败，请检查协议文件。"; }
        }
        void Frame() {
            var renderers=sceneRoot.GetComponentsInChildren<Renderer>();
            var bounds=renderers.Length>0?renderers[0].bounds:new Bounds(Vector3.zero,Vector3.one);
            for(int i=1;i<renderers.Length;i++) bounds.Encapsulate(renderers[i].bounds);
            orbit.Frame(bounds);
        }
        void OnGUI() {
            GUI.Box(new Rect(10,10,Mathf.Min(Screen.width-20,720),80),status+"\n拖动查看，滚轮/双指缩放；门窗洞口暂未切割，家具为示例方块。");
            if(GUI.Button(new Rect(20,60,120,25),"重载示例")) LoadSample();
            if(sceneRoot && GUI.Button(new Rect(150,60,120,25),"重置相机")) Frame();
        }
    }
}
