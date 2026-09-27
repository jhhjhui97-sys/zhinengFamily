using System;
using System.IO;
using Newtonsoft.Json.Linq;
using SmartHome.SceneConsumer;
public static class ValidationTests {
 public static int Main(string[] args) {
  try { Run(args[0],args[1]); return 0; } catch(Exception e) { Console.Error.WriteLine(e); return 1; }
 }
 public static void Run(string schemaPath,string casesPath) {
  var integerCase = (JObject)JArray.Parse(File.ReadAllText(casesPath))[2]; SceneDocument.Parse(integerCase.Value<string>("json"));
  var validator = new OfflineSceneValidator(File.ReadAllText(schemaPath));
  int count=0;
  foreach(JObject item in JArray.Parse(File.ReadAllText(casesPath))) {
   bool accepted;
   try {
    string input=item.Value<string>("json");
    var output=validator.Validate(input);
    if(item.Value<string>("name")=="huge integer metadata") { if(!output.Export().Contains("1"+new string('0',400))) throw new Exception("lossy integer"); } else if(!JToken.DeepEquals(JObject.Parse(input),JObject.Parse(output.Export()))) throw new Exception("lossy JSON");
    accepted=true;
   } catch(SceneValidationError) { accepted=false; }
   if(accepted!=item.Value<bool>("valid")) throw new Exception("authority mismatch: "+item.Value<string>("name")+" accepted="+accepted);
   count++;
  }
  var schema=JObject.Parse(File.ReadAllText(schemaPath)); schema["pattern"]="unsupported";
  try { new OfflineSceneValidator(schema.ToString()); throw new Exception("unsupported schema silently accepted"); } catch(SceneValidationError) { count++; }
  Console.WriteLine("Offline validation: "+count+" authority cases passed");
 }
}
