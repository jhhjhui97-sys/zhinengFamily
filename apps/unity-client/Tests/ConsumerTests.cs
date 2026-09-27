using System;
using System.IO;
using Newtonsoft.Json.Linq;
using SmartHome.SceneConsumer;
public static class ConsumerTests
{
    static int count;
    static void Require(bool condition) { if(!condition) throw new Exception("Consumer assertion failed"); count++; }
    static void Reject(string json) { try { SceneDocument.Parse(json); } catch(ArgumentException) { count++; return; } throw new Exception("Invalid document accepted"); }
    public static int Main(string[] args)
    {
        CoordinatesTests.Main();
        string json=File.ReadAllText(args[0]); var document=SceneDocument.Parse(json);
        Require(JToken.DeepEquals(JObject.Parse(json),JObject.Parse(document.Export())));
        var copy=document.Copy(); copy["metadata"]["title"]="consumer change";
        Require(!document.Export().Contains("consumer change"));
        Require(document.Copy()["doors"].HasValues && document.Copy()["windows"].HasValues);
        var rich=JObject.Parse(json); rich["metadata"]["nested"]=JObject.Parse("{\"list\":[1,null,{\"name\":\"中文\"}],\"flag\":true}");
        Require(JToken.DeepEquals(rich,JObject.Parse(SceneDocument.Parse(rich.ToString()).Export())));
        Reject(json.Replace("1.0.0","9.0.0"));
        Reject(json.Replace("\"mm\"","\"m\""));
        Reject(json.Replace("RH_Z_UP","LH_Y_UP"));
        Reject("{broken");
        Reject(json.Replace("\"offline_catalog_only\": true","\"overflow\": 1e400"));
        Console.WriteLine(count+" document cases passed"); return 0;
    }
}
