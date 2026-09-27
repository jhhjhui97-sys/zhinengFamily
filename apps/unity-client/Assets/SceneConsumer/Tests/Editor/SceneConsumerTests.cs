using System.IO;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;
using SmartHome.SceneConsumer;
public class SceneConsumerTests
{
    SceneDocument Sample() { return SceneDocument.Parse(File.ReadAllText(Path.Combine(Application.streamingAssetsPath,"two-bedroom.json"))); }
    [Test] public void DocumentRoundtripPreservesUnshownFields() {
        var original=Sample(); Assert.That(JToken.DeepEquals(original.Copy(),JObject.Parse(original.Export())),Is.True);
    }
    [Test] public void FurnitureBottomCenterAndRotationAreMapped() {
        var root=SceneRenderer.Build(Sample(),null);
        try {
            var furniture=root.transform.Find("furniture:40000000-0000-4000-8000-000000000001");
            Assert.That(furniture,Is.Not.Null);
            Assert.That(Vector3.Distance(furniture.position,new Vector3(4,.425f,2)),Is.LessThan(.0001f));
            Assert.That(Vector3.Distance(furniture.localScale,new Vector3(2.4f,.85f,.95f)),Is.LessThan(.0001f));
            Assert.That(Vector3.Distance(furniture.right,Vector3.forward),Is.LessThan(.0001f));
        } finally { Object.DestroyImmediate(root); }
    }
    [Test] public void SecondFloorElevationIsAppliedExactlyOnce() {
        var json=Sample().Copy(); var floor=(JObject)json["floors"][0].DeepClone();
        floor["id"]="50000000-0000-4000-8000-000000000001"; floor["elevation_mm"]=3000; ((JArray)json["floors"]).Add(floor);
        var furniture=(JObject)json["furniture_instances"][0].DeepClone();
        furniture["id"]="50000000-0000-4000-8000-000000000002"; furniture["floor_id"]=floor["id"]; furniture["room_id"]=null;
        ((JArray)json["furniture_instances"]).Add(furniture);
        var root=SceneRenderer.Build(SceneDocument.Parse(json.ToString()),null);
        try { Assert.That(root.transform.Find("furniture:"+furniture["id"]).position.y,Is.EqualTo(3.425f).Within(.0001f)); }
        finally { Object.DestroyImmediate(root); }
    }
}
