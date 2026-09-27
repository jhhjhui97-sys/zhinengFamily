using System;
using UnityEngine;
namespace SmartHome.SceneConsumer {
 [RequireComponent(typeof(Camera))]
 public sealed class OrbitCamera : MonoBehaviour {
  Vector3 target; float distance=15,yaw=-30,pitch=50;
  readonly PreviewGestureGate gestures=new PreviewGestureGate();
  public Func<Vector2,bool> CanGesture;
  bool Preview(Vector2 position) { return CanGesture!=null&&CanGesture(position); }
  public void Frame(Bounds bounds) { target=bounds.center; distance=Mathf.Max(4,bounds.extents.magnitude*2.5f); yaw=-30; pitch=50; Apply(); }
  void Apply() { var rotation=Quaternion.Euler(pitch,yaw,0); transform.SetPositionAndRotation(target+rotation*new Vector3(0,0,-distance),rotation); }
  void OnDisable() { gestures.Reset(); }
  void Update() {
   if(Input.touchCount>0) {
    for(int i=0;i<Input.touchCount;i++) {
     var touch=Input.GetTouch(i);
     if(touch.phase==TouchPhase.Began) gestures.Begin(touch.fingerId,Preview(touch.position));
    }
    if(Input.touchCount==2) {
     var a=Input.GetTouch(0); var b=Input.GetTouch(1);
     if(gestures.Allows(a.fingerId,Preview(a.position))&&gestures.Allows(b.fingerId,Preview(b.position))) {
      float oldGap=((a.position-a.deltaPosition)-(b.position-b.deltaPosition)).magnitude;
      distance-=((a.position-b.position).magnitude-oldGap)*.02f;
     }
    } else if(Input.touchCount==1) {
     var touch=Input.GetTouch(0);
     if(touch.phase==TouchPhase.Moved&&gestures.Allows(touch.fingerId,Preview(touch.position))) {
      yaw+=touch.deltaPosition.x*.2f; pitch-=touch.deltaPosition.y*.2f;
     }
    }
    for(int i=0;i<Input.touchCount;i++) {
     var touch=Input.GetTouch(i);
     if(touch.phase==TouchPhase.Ended||touch.phase==TouchPhase.Canceled) gestures.End(touch.fingerId);
    }
   } else {
    if(Input.GetMouseButtonDown(0)) gestures.Begin(-1,Preview(Input.mousePosition));
    if(Input.GetMouseButton(0)&&gestures.Allows(-1,Preview(Input.mousePosition))) {
     yaw+=Input.GetAxis("Mouse X")*3; pitch-=Input.GetAxis("Mouse Y")*3;
    }
    if(Input.GetMouseButtonUp(0)) gestures.End(-1);
    if(Preview(Input.mousePosition)) distance-=Input.mouseScrollDelta.y*1.5f;
   }
   pitch=Mathf.Clamp(pitch,15,85); distance=Mathf.Clamp(distance,1,500); Apply();
  }
 }
}
