using System;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using LocalScenes;
using SmartHome.SceneConsumer;
public static class LocalBridge {
 static object Version(LocalSceneVersion v) { return v==null ? null : new {revision=v.Revision,saved_at=v.CreatedAt,scene=JObject.Parse(v.SceneJson)}; }
 static long Number(JObject input,string key,long fallback) { var value=input[key];if(value==null) return fallback;if(value.Type!=JTokenType.Integer) throw new LocalStoreError(LocalErrorCode.InvalidInput);return (long)value; }
 static Guid Id(JObject input) {Guid id;if(!Guid.TryParse((string)input["id"],out id)||id==Guid.Empty) throw new LocalStoreError(LocalErrorCode.InvalidInput);return id;}
 public static int Main(string[] args) {
  Console.InputEncoding=Encoding.UTF8;Console.OutputEncoding=new UTF8Encoding(false);
  try {
   if(args.Length<3||args.Length>4) throw new LocalStoreError(LocalErrorCode.InvalidInput);
   string text=Console.In.ReadToEnd();if(text.Length>1024*1024) throw new LocalStoreError(LocalErrorCode.InvalidInput);
   JObject input=JObject.Parse(text);
   string[] allowed={"action","id","name","base_revision","revision","scene","limit","offset"};
   if(input.Properties().Any(x=>!allowed.Contains(x.Name))) throw new LocalStoreError(LocalErrorCode.InvalidInput);
   string action=(string)input["action"];
   if(!new[]{"list","create","sample","current","save","versions","restore","validate","catalog"}.Contains(action)) throw new LocalStoreError(LocalErrorCode.InvalidInput);
   var validator=new OfflineSceneValidator(File.ReadAllText(args[1]));
   var identity=LocalIdentity.Open(args[0]);object data=null;
   using(var store=new LocalSceneStore(args[0],identity.WorkspaceId,identity.ActorId,validator)) {
    int limit=checked((int)Number(input,"limit",20)),offset=checked((int)Number(input,"offset",0));
    switch(action) {
     case "catalog":
      if(args.Length!=4) throw new LocalStoreError(LocalErrorCode.InvalidInput);
      var products=JArray.Parse(File.ReadAllText(args[3]));
      foreach(JObject item in products) {
       Guid product=Guid.Parse((string)item["id"]);
       string name=(string)item["name"];
       double width=(double)item["width_mm"],depth=(double)item["depth_mm"],height=(double)item["height_mm"];
       store.Catalog(product,name,width,depth,height);
      }
      data=products;break;
     case "list":var page=store.Documents(limit,offset);data=new {total=page.Total,items=page.Items.Select(x=>new{id=x.Id,name=x.Name,revision=x.Revision,saved_at=x.UpdatedAt})};break;
     case "create":data=new{id=store.Create((string)input["name"])};break;
     case "current":data=Version(store.Current(Id(input)));break;
     case "sample":var session=new LocalSceneSession(store,validator,File.ReadAllText(args[2]));if(!session.Open(Id(input))||!session.LoadSample()) throw new LocalStoreError(LocalErrorCode.InvalidInput);data=new{scene=JObject.Parse(session.Draft)};break;
     case "save":if(input["scene"]==null)throw new SceneValidationError();data=Version(store.Put(Id(input),Number(input,"base_revision",-1),input["scene"].ToString(Formatting.None)));break;
     case "versions":data=store.Versions(Id(input),limit,offset).Select(x=>Version(x)).ToArray();break;
     case "restore":data=Version(store.Restore(Id(input),Number(input,"base_revision",-1),Number(input,"revision",0)));break;
     case "validate":data=new{scene=validator.Validate(input["scene"].ToString(Formatting.None)).Copy()};break;
    }
   }
   Console.Write(JsonConvert.SerializeObject(new{status=200,data=data}));
  } catch(Exception error) {
   int status=500;var local=error as LocalStoreError;
   if(error is SceneValidationError||error is JsonException||error is FormatException||error is OverflowException)status=422;
   if(local!=null) switch(local.Code){case LocalErrorCode.InvalidInput:status=422;break;case LocalErrorCode.Conflict:status=409;break;case LocalErrorCode.NotFound:status=404;break;case LocalErrorCode.Busy:status=503;break;}
   string message=status==422?"填写的内容不符合场景要求，请检查后重试。":LocalSceneSession.Friendly(error);
   Console.Write(JsonConvert.SerializeObject(new{status=status,error=message}));
  }
  return 0;
 }
}
