using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;
namespace SmartHome.SceneConsumer
{
    public static class SceneRenderer
    {
        public static Vector3 Vector(PresentationVector value) {
            return new Vector3(Single(value.X),Single(value.Y),Single(value.Z));
        }
        static float Single(double value) {
            if(double.IsNaN(value)||double.IsInfinity(value)||Math.Abs(value)>float.MaxValue) throw new ArgumentException("Scene cannot be represented by Unity");
            var converted=(float)value;
            if(converted==0 && value!=0) throw new ArgumentException("Scene precision cannot be represented by Unity");
            return converted;
        }
        static double Number(JToken token,string key) { return token.Value<double>(key); }
        static JArray Items(JObject root,string key) { if(root[key]==null) return new JArray(); var items=root[key] as JArray; if(items==null) throw new ArgumentException("Expected scene collection"); return items; }
        static double Floor(Dictionary<string,double> floors,JToken element) { double height; if(!floors.TryGetValue(element.Value<string>("floor_id"),out height)) throw new ArgumentException("Missing floor reference"); return height; }
        static Quaternion Rotation(double angle) {
            var forward=SceneCoordinates.RotateUnityBasis(new PresentationVector(0,0,1),angle);
            return Quaternion.LookRotation(Vector(forward),Vector3.up);
        }
        static void Box(Transform parent,string name,Vector3 position,Vector3 size,Quaternion rotation,Material material) {
            var cube=GameObject.CreatePrimitive(PrimitiveType.Cube); cube.name=name;
            cube.transform.SetParent(parent,false); cube.transform.localPosition=position; cube.transform.localScale=size; cube.transform.localRotation=rotation;
            cube.GetComponent<Renderer>().sharedMaterial=material;
            var collider=cube.GetComponent<Collider>(); if(Application.isPlaying) UnityEngine.Object.Destroy(collider); else UnityEngine.Object.DestroyImmediate(collider);
        }
        public static GameObject Build(SceneDocument document,Transform parent) {
            var root=new GameObject("SceneModel preview"); root.SetActive(false); root.transform.SetParent(parent,false);
            try {
                var json=document.Copy(); var floors=new Dictionary<string,double>();
                foreach(var floor in Items(json,"floors")) floors.Add(floor.Value<string>("id"),Number(floor,"elevation_mm"));
                var materials=root.AddComponent<SceneResourceOwner>(); materials.Initialize();
                foreach(var room in Items(json,"rooms")) {
                    var lineObject=new GameObject("room:"+room.Value<string>("id")); lineObject.transform.SetParent(root.transform,false);
                    var line=lineObject.AddComponent<LineRenderer>(); var points=room["boundary"] as JArray;
                    if(points==null||points.Count<3) throw new ArgumentException("Room boundary missing");
                    line.useWorldSpace=false; line.loop=true; line.positionCount=points.Count; line.widthMultiplier=.025f; line.sharedMaterial=materials.Room;
                    for(int i=0;i<points.Count;i++) line.SetPosition(i,Vector(SceneCoordinates.ToUnityPosition(new PresentationVector(Number(points[i],"x"),Number(points[i],"y"),3),Floor(floors,room))));
                }
                foreach(var wall in Items(json,"walls")) {
                    var a=wall["start"]; var b=wall["end"]; double dx=Number(b,"x")-Number(a,"x"),dy=Number(b,"y")-Number(a,"y");
                    double length=Math.Sqrt(dx*dx+dy*dy),height=Number(wall,"height_mm");
                    double angle=(Math.Atan2(dy,dx)*180/Math.PI+360)%360;
                    var center=new PresentationVector((Number(a,"x")+Number(b,"x"))/2,(Number(a,"y")+Number(b,"y"))/2,height/2);
                    Box(root.transform,"wall:"+wall.Value<string>("id"),Vector(SceneCoordinates.ToUnityPosition(center,Floor(floors,wall))),Vector(SceneCoordinates.ToUnitySize(length,Number(wall,"thickness_mm"),height)),Rotation(angle),materials.Wall);
                }
                foreach(var furniture in Items(json,"furniture_instances")) {
                    var point=furniture["position"]; double height=Number(furniture,"height_mm");
                    var center=new PresentationVector(Number(point,"x"),Number(point,"y"),Number(point,"z")+height/2);
                    Box(root.transform,"furniture:"+furniture.Value<string>("id"),Vector(SceneCoordinates.ToUnityPosition(center,Floor(floors,furniture))),Vector(SceneCoordinates.ToUnitySize(Number(furniture,"width_mm"),Number(furniture,"depth_mm"),height)),Rotation(Number(furniture,"rotation_deg")),materials.Furniture);
                }
                root.SetActive(true); return root;
            } catch { if(Application.isPlaying) UnityEngine.Object.Destroy(root); else UnityEngine.Object.DestroyImmediate(root); throw; }
        }
    }
}
