using System;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
namespace SmartHome.SceneConsumer
{
    // Keeps the authority's JSON intact. This preflight is not SceneModel validation.
    public sealed class SceneDocument
    {
        readonly JObject source;
        SceneDocument(JObject value) { source=value; }
        public JObject Copy() { return (JObject)source.DeepClone(); }
        public string Export() { return source.ToString(Formatting.Indented); }
        public static SceneDocument Parse(string json)
        {
            if(string.IsNullOrWhiteSpace(json)||json.Length>8*1024*1024) throw new ArgumentException("Scene JSON is empty or too large");
            try {
                JObject root;
                using(var text=new StringReader(json))
                using(var reader=new JsonTextReader(text)) {
                    reader.DateParseHandling=DateParseHandling.None; reader.MaxDepth=128;
                    root=JObject.Load(reader,new JsonLoadSettings { DuplicatePropertyNameHandling=DuplicatePropertyNameHandling.Error });
                    if(reader.Read()) throw new ArgumentException("Trailing scene content");
                }
                if(root.Value<string>("schema_version")!="1.0.0"||root.Value<string>("units")!="mm"||root.Value<string>("coordinate_system")!="RH_Z_UP") throw new ArgumentException("Unsupported scene protocol");
                var floors=root["floors"] as JArray;
                if(floors==null||floors.Count==0) throw new ArgumentException("Scene floors are required");
                foreach(var token in root.Descendants()) {
                    if(token.Type!=JTokenType.Float && token.Type!=JTokenType.Integer) continue;
                    double number=token.Value<double>();
                    if(double.IsNaN(number)||double.IsInfinity(number)) throw new ArgumentException("Scene numbers must be finite");
                }
                return new SceneDocument(root);
            } catch(JsonException error) { throw new ArgumentException("Invalid scene JSON",error); }
            catch(OverflowException error) { throw new ArgumentException("Scene number is out of range",error); }
        }
    }
}
