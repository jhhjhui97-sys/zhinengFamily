using UnityEngine;
namespace SmartHome.SceneConsumer
{
    [RequireComponent(typeof(Camera))]
    public sealed class OrbitCamera : MonoBehaviour
    {
        Vector3 target; float distance=15, yaw=-30, pitch=50;
        public void Frame(Bounds bounds) { target=bounds.center; distance=Mathf.Max(4,bounds.extents.magnitude*2.5f); yaw=-30; pitch=50; Apply(); }
        void Apply() { var rotation=Quaternion.Euler(pitch,yaw,0); transform.SetPositionAndRotation(target+rotation*new Vector3(0,0,-distance),rotation); }
        void Update() {
            if(Input.touchCount==2) {
                var a=Input.GetTouch(0); var b=Input.GetTouch(1);
                float oldGap=((a.position-a.deltaPosition)-(b.position-b.deltaPosition)).magnitude;
                distance-=((a.position-b.position).magnitude-oldGap)*.02f;
            } else if(Input.touchCount==1) {
                var touch=Input.GetTouch(0); if(touch.position.y<Screen.height-90) { yaw+=touch.deltaPosition.x*.2f; pitch-=touch.deltaPosition.y*.2f; }
            } else {
                if(Input.GetMouseButton(0)&&Input.mousePosition.y<Screen.height-90) { yaw+=Input.GetAxis("Mouse X")*3; pitch-=Input.GetAxis("Mouse Y")*3; }
                distance-=Input.mouseScrollDelta.y*1.5f;
            }
            pitch=Mathf.Clamp(pitch,15,85); distance=Mathf.Clamp(distance,1,500); Apply();
        }
    }
}
