using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
namespace SmartHome.SceneConsumer {
 // Protocol preflight only. Persistence must use OfflineSceneValidator for the complete SceneModel.
 public sealed class SceneDocument {
  readonly JObject source;
  SceneDocument(JObject value) { source=value; }
  public JObject Copy() { return (JObject)source.DeepClone(); }
  public string Export() { return source.ToString(Formatting.Indented); }
  public static SceneDocument Parse(string json) {
   var root=StrictSceneJson.Parse(json);
   if(root.Value<string>("schema_version")!="1.0.0"||root.Value<string>("units")!="mm"||root.Value<string>("coordinate_system")!="RH_Z_UP")
    throw new ArgumentException("Unsupported scene protocol");
   var floors=root["floors"] as JArray;
   if(floors==null||floors.Count==0) throw new ArgumentException("Scene floors are required");
   return new SceneDocument(root);
  }
 }
}
