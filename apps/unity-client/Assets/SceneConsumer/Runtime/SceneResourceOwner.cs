using System;
using UnityEngine;
namespace SmartHome.SceneConsumer
{
    public sealed class SceneResourceOwner : MonoBehaviour
    {
        public Material Room { get; private set; }
        public Material Wall { get; private set; }
        public Material Furniture { get; private set; }
        Material Make(Color color) {
            var shader=Resources.Load<Shader>("ScenePreview"); if(!shader) throw new ArgumentException("Preview shader unavailable");
            var material=new Material(shader); material.color=color; return material;
        }
        public void Initialize() {
            Room=Make(new Color(.15f,.55f,.65f));
            Wall=Make(new Color(.82f,.85f,.88f));
            Furniture=Make(new Color(.9f,.58f,.28f));
        }
        void OnDestroy() {
            foreach(var material in new[]{Room,Wall,Furniture}) if(material) { if(Application.isPlaying) Destroy(material); else DestroyImmediate(material); }
        }
    }
}
