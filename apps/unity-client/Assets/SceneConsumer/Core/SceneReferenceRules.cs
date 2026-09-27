using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
namespace SmartHome.SceneConsumer {
internal static class SceneReferenceRules {
 internal static readonly string[] Collections={"rooms","walls","doors","windows","columns","beams","electrical_points","plumbing_points","furniture_instances"};
 static void Require(bool condition) { if(!condition) throw new SceneValidationError(); }
 static Dictionary<Guid,JObject> Index(JObject root,string collection) {
  var result=new Dictionary<Guid,JObject>(); foreach(var item in SceneGeometryRules.Items(root,collection)) result.Add(SceneSchemaRules.Id(item["id"]),item); return result;
 }
 internal static void Validate(JObject root) {
  var ids=new HashSet<Guid> { SceneSchemaRules.Id(root["scene_id"]) };
  foreach(var floor in SceneGeometryRules.Items(root,"floors")) Require(ids.Add(SceneSchemaRules.Id(floor["id"])));
  foreach(string collection in Collections)
   foreach(var element in SceneGeometryRules.Items(root,collection)) Require(ids.Add(SceneSchemaRules.Id(element["id"])));
  var floors=Index(root,"floors"); var walls=Index(root,"walls"); var rooms=Index(root,"rooms");
  foreach(string collection in Collections) foreach(var element in SceneGeometryRules.Items(root,collection)) {
   Guid floor=SceneSchemaRules.Id(element["floor_id"]); Require(floors.ContainsKey(floor));
   if(collection=="doors"||collection=="windows"||collection=="electrical_points"||collection=="plumbing_points") {
    if(element["wall_id"]!=null&&element["wall_id"].Type!=JTokenType.Null) {
     JObject wall; Require(walls.TryGetValue(SceneSchemaRules.Id(element["wall_id"]),out wall));
     Require(SceneSchemaRules.Id(wall["floor_id"])==floor);
     if(collection=="doors"||collection=="windows") {
      Require((double)element["offset_mm"]+(double)element["width_mm"]<=SceneGeometryRules.Length(wall["start"],wall["end"])+SceneGeometryRules.Tolerance);
      Require((double)element["sill_height_mm"]+(double)element["height_mm"]<=(double)wall["height_mm"]+SceneGeometryRules.Tolerance);
     }
    }
   }
   if(collection=="furniture_instances"&&element["room_id"]!=null&&element["room_id"].Type!=JTokenType.Null) {
    JObject room; Require(rooms.TryGetValue(SceneSchemaRules.Id(element["room_id"]),out room)); Require(SceneSchemaRules.Id(room["floor_id"])==floor);
   }
  }
 }
}
}
