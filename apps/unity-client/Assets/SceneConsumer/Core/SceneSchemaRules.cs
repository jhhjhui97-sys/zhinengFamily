using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
namespace SmartHome.SceneConsumer {
internal sealed class SceneSchemaRules {
 readonly JObject root;
 static readonly HashSet<string> Keywords=new HashSet<string> { "$defs","$ref","$schema","additionalProperties","anyOf","const","default","enum","exclusiveMaximum","exclusiveMinimum","format","items","minItems","minimum","properties","required","title","type" };
 internal SceneSchemaRules(string json) { root=JObject.Parse(json); Inventory(root); }
 static void Require(bool valid) { if(!valid) throw new SceneValidationError(); }
 void Inventory(JObject node) {
  foreach(var property in node.Properties()) {
   Require(Keywords.Contains(property.Name));
   if(property.Name=="$defs"||property.Name=="properties") {
    foreach(var child in ((JObject)property.Value).Properties()) Inventory((JObject)child.Value);
   } else if(property.Name=="items"||property.Name=="additionalProperties") {
    if(property.Value is JObject) Inventory((JObject)property.Value);
   } else if(property.Name=="anyOf") foreach(var child in (JArray)property.Value) Inventory((JObject)child);
   else if(property.Name=="format") Require((string)property.Value=="uuid");
   else if(property.Name=="$ref") Require(((string)property.Value).StartsWith("#/$defs/",StringComparison.Ordinal));
  }
 }
 internal static Guid Id(JToken token) {
  Require(token!=null&&token.Type==JTokenType.String);
  string value=(string)token;
  Require(value==value.Trim());
  bool urn=value.StartsWith("urn:uuid:",StringComparison.Ordinal);
  if(urn) value=value.Substring(9);
  Guid parsed;
  Require(Guid.TryParseExact(value,"D",out parsed)||(!urn&&(Guid.TryParseExact(value,"N",out parsed)||Guid.TryParseExact(value,"B",out parsed))));
  return parsed;
 }
 internal void Validate(JToken value) { Match(root,value,0); }
 void Match(JObject schema,JToken value,int depth) {
  Require(depth<=128);
  if(schema["$ref"]!=null) {
   string name=((string)schema["$ref"]).Substring(8);
   var target=root["$defs"][name] as JObject; Require(target!=null); Match(target,value,depth+1); return;
  }
  if(schema["anyOf"]!=null) {
   foreach(var option in (JArray)schema["anyOf"]) { try { Match((JObject)option,value,depth+1); return; } catch(SceneValidationError) {} }
   throw new SceneValidationError();
  }
  string type=(string)schema["type"];
  if(type!=null) {
   Require(type=="object"||type=="array"||type=="number"||type=="string"||type=="null"||type=="boolean"||type=="integer");
   Require(type=="object" ? value is JObject : type=="array" ? value is JArray :
       type=="number" ? value.Type==JTokenType.Float||value.Type==JTokenType.Integer :
       type=="integer" ? value.Type==JTokenType.Integer :
       type=="string" ? value.Type==JTokenType.String :
       type=="null" ? value.Type==JTokenType.Null : value.Type==JTokenType.Boolean);
  }
  if(schema["const"]!=null) Require(JToken.DeepEquals(schema["const"],value));
  if(schema["enum"]!=null) { bool found=false; foreach(var item in (JArray)schema["enum"]) if(JToken.DeepEquals(item,value)) found=true; Require(found); }
  if(schema["format"]!=null) Id(value);
  if(value is JObject) {
   var obj=(JObject)value; var properties=schema["properties"] as JObject;
   if(schema["required"]!=null) foreach(string name in (JArray)schema["required"]) Require(obj.Property(name)!=null);
   foreach(var property in obj.Properties()) {
    var rule=properties==null?null:properties[property.Name] as JObject;
    if(rule!=null) Match(rule,property.Value,depth+1);
    else if(schema["additionalProperties"] is JObject) Match((JObject)schema["additionalProperties"],property.Value,depth+1);
    else if(schema["additionalProperties"]!=null) Require((bool)schema["additionalProperties"]);
   }
  }
  if(value is JArray) {
   var array=(JArray)value; if(schema["minItems"]!=null) Require(array.Count>=(int)schema["minItems"]);
   if(schema["items"]!=null) foreach(var item in array) Match((JObject)schema["items"],item,depth+1);
  }
  if(type=="number") {
   double n=(double)value; Require(!double.IsNaN(n)&&!double.IsInfinity(n));
   if(schema["minimum"]!=null) Require(n>=(double)schema["minimum"]);
   if(schema["exclusiveMinimum"]!=null) Require(n>(double)schema["exclusiveMinimum"]);
   if(schema["exclusiveMaximum"]!=null) Require(n<(double)schema["exclusiveMaximum"]);
  }
 }
}
}
