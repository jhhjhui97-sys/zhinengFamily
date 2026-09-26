using System;
using System.IO;
using System.Numerics;
using LocalScenes;
using Newtonsoft.Json.Linq;
using SmartHome.SceneConsumer;

public static class ReviewRegressionTests {
 public static int Passed;
 static int failed;
 static OfflineSceneValidator validator;
 static string sample;
 static void Check(bool value,string name) { SqliteTests.Check(value,name); }
 static void Reject(string json) {
  try { validator.Validate(json); } catch(SceneValidationError) { return; }
  throw new Exception("Invalid input accepted");
 }
 static void Test(string name,Action action) {
  try { action(); Passed++; Console.WriteLine("PASS "+name); }
  catch(Exception e) { failed++; Console.WriteLine("FAIL "+name+" "+e.GetType().Name+": "+e.Message); }
 }
 public static int Main(string[] args) { try { Run(args[0],args[1]); return 0; } catch(Exception e) { Console.Error.WriteLine(e.Message); return 1; } }
 public static void Run(string schemaPath,string samplePath) {
  validator=new OfflineSceneValidator(File.ReadAllText(schemaPath)); sample=File.ReadAllText(samplePath);
  Test("escaped unpaired Unicode values and property names reject safely",()=>{
   foreach(string value in new[]{"\\ud800","\\udfff","\\ud800a","a\\udfff"}) {
    Reject(sample.Replace("\"offline_catalog_only\": true","\"probe\":\""+value+"\""));
    Reject(sample.Replace("\"offline_catalog_only\": true","\""+value+"\":true"));
   }
  });
  Test("raw unpaired Unicode rejects and SQL encoding never replaces it",()=>{
   foreach(char value in new[]{'\ud800','\udfff'}) Reject(sample.Replace("\"offline_catalog_only\": true","\"probe\":\""+value+"\""));
   });
  Test("SQL binding refuses invalid Unicode without a write",()=>{
   string path=Path.Combine(Path.GetTempPath(),"unicode-bind-"+Guid.NewGuid()+".sqlite");
   try { using(var db=new SqliteConnection(path)) {
    db.Execute("CREATE TABLE probe(value TEXT)");
    SqliteTests.Error(()=>db.Execute("INSERT INTO probe VALUES(?)","bad"+'\ud800'),LocalErrorCode.InvalidInput);
    Check(db.Query("SELECT * FROM probe").Count==0,"invalid text written");
   } } finally { File.Delete(path); }
  });
  Test("supplementary characters NUL and huge integer persist exactly",()=>{
   var root=JObject.Parse(sample);
   root["metadata"]["probe"]="家具😀\0保存";
   root["metadata"]["huge"]=new JValue(BigInteger.Pow(10,400));
   string path=Path.Combine(Path.GetTempPath(),"unicode-scene-"+Guid.NewGuid()+".sqlite");
   try { using(var store=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
    store.Catalog(Guid.Parse("40000000-0000-4000-8000-000000000002"),"三人沙发",2400,950,850);
    Guid id=store.Create("中文😀");
    var saved=store.Put(id,0,root.ToString());
    Check(saved.SceneJson==store.Current(id).SceneJson,"Unicode or integer mutated");
    Check(saved.SceneJson.Contains("1"+new string('0',400)),"huge integer changed");
    Check(saved.SceneJson.Contains("😀"),"supplementary character lost");
   } } finally { File.Delete(path); }
  });
  Test("large integer geometry accepts finite values and safely rejects overflow",()=>{
   foreach(int exponent in new[]{19,20,100}) {
    var root=JObject.Parse(sample); root["floors"][0]["elevation_mm"]=new JValue(BigInteger.Pow(10,exponent));
    string saved=validator.Validate(root.ToString()).Export();
    Check(saved.Contains("1"+new string('0',exponent)),"geometry integer changed");
   }
   var invalid=JObject.Parse(sample); invalid["floors"][0]["elevation_mm"]=new JValue(BigInteger.Pow(10,400));
   Reject(invalid.ToString());
  });
  Test("all malformed protocol header types produce safe validation errors",()=>{
   foreach(string field in new[]{"schema_version","units","coordinate_system"})
    foreach(JToken wrong in new JToken[]{new JObject(),new JArray(),new JValue(true),new JValue(1),JValue.CreateNull()}) {
     var root=JObject.Parse(sample); root[field]=wrong.DeepClone(); Reject(root.ToString());
    }
  });
  Test("UUID representations match authority and exclude .NET X and P",()=>{
   Guid id=Guid.Parse("abcdefab-cdef-4abc-8def-abcdefabcdef");
   foreach(string value in new[]{id.ToString("N"),id.ToString("D"),id.ToString("B"),id.ToString("D").ToUpperInvariant(),"urn:uuid:"+id.ToString("D")}) {
    var root=JObject.Parse(sample); root["scene_id"]=value; validator.Validate(root.ToString());
   }
   foreach(string value in new[]{id.ToString("X"),id.ToString("P")}) {
    var root=JObject.Parse(sample); root["scene_id"]=value; Reject(root.ToString());
   }
  });
  if(failed>0) throw new Exception("Review regressions: "+failed+" failed, "+Passed+" passed");
  Console.WriteLine("Review regressions: "+Passed+" passed");
 }
}
