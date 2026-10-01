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
 static object Customer(LocalCustomer c) { return new {id=c.Id,name=c.Name,phone=c.Phone,wechat=c.Wechat,source=c.Source,address=c.Address,budget=c.Budget,status=c.Status,notes=c.Notes,revision=c.Revision,created_at=c.CreatedAt,updated_at=c.UpdatedAt}; }
 static object Project(LocalProject p) { return new {id=p.Id,customer_id=p.CustomerId,sales_actor_id=p.SalesActorId,name=p.Name,address=p.Address,status=p.Status,revision=p.Revision,created_at=p.CreatedAt,updated_at=p.UpdatedAt}; }
 static object Product(LocalProduct p) { return new {id=p.Id,category=p.Category,brand=p.Brand,name=p.Name,sku=p.Sku,price=p.Price,width_mm=p.WidthMm,depth_mm=p.DepthMm,height_mm=p.HeightMm,metadata=JObject.Parse(p.MetadataJson),active_asset_id=p.ActiveAssetId,revision=p.Revision,created_at=p.CreatedAt,updated_at=p.UpdatedAt}; }
 static object Quotation(LocalQuotation q) { return new {id=q.Id,customer_id=q.CustomerId,project_id=q.ProjectId,document_id=q.DocumentId,scene_version=q.SceneRevision,customer_name=q.CustomerName,project_name=q.ProjectName,scene_name=q.SceneName,currency=q.Currency,total=q.Total,total_cents=q.TotalCents,excluded_demo_count=q.ExcludedDemoCount,created_by=q.CreatedBy,created_at=q.CreatedAt,lines=q.Lines.Select(x=>new {product_id=x.ProductId,name=x.ProductName,sku=x.Sku,unit_price=x.UnitPrice,quantity=x.Quantity,line_total=x.LineTotal}),exclusions=q.Exclusions.Select(x=>new {instance_id=x.InstanceId,product_id=x.ProductId,name=x.Name})}; }
 static string Field(JObject input,string key) { var value=input[key];if(value==null||value.Type==JTokenType.Null)return null;if(value.Type!=JTokenType.String)throw new LocalStoreError(LocalErrorCode.InvalidInput);return (string)value; }
 static Guid Reference(JObject input,string key) {Guid id;if(!Guid.TryParse(Field(input,key),out id)||id==Guid.Empty)throw new LocalStoreError(LocalErrorCode.InvalidInput);return id;}
 static long Number(JObject input,string key,long fallback) { var value=input[key];if(value==null) return fallback;if(value.Type!=JTokenType.Integer) throw new LocalStoreError(LocalErrorCode.InvalidInput);return (long)value; }
 static double Dimension(JObject input,string key) {var value=input[key];if(value==null||(value.Type!=JTokenType.Integer&&value.Type!=JTokenType.Float))throw new LocalStoreError(LocalErrorCode.InvalidInput);double number=value.Value<double>();if(number<=0||double.IsInfinity(number)||double.IsNaN(number))throw new LocalStoreError(LocalErrorCode.InvalidInput);return number;}
 static string Metadata(JObject input) {var value=input["metadata"];if(value==null)return "{}";if(value.Type!=JTokenType.Object)throw new LocalStoreError(LocalErrorCode.InvalidInput);return value.ToString(Formatting.None);}
 static Guid Id(JObject input) {return Reference(input,"id");}
 static Guid? SceneProject(LocalSceneStore store,JObject input) {
  if(input["project_id"]==null) {
   if(input["customer_id"]!=null) throw new LocalStoreError(LocalErrorCode.InvalidInput);
   return null;
  }
  Guid projectId=Reference(input,"project_id"),customerId=Reference(input,"customer_id");
  if(store.Project(projectId).CustomerId!=customerId) throw new LocalStoreError(LocalErrorCode.NotFound);
  return projectId;
 }
 static void RequireSceneScope(LocalSceneStore store,JObject input) {store.RequireSceneAccess(Id(input),SceneProject(store,input));}
 static Guid QuoteProject(LocalSceneStore store,JObject input) {Guid? project=SceneProject(store,input);if(!project.HasValue)throw new LocalStoreError(LocalErrorCode.InvalidInput);return project.Value;}
 public static int Main(string[] args) {
  Console.InputEncoding=Encoding.UTF8;Console.OutputEncoding=new UTF8Encoding(false);
  string action=null;
  try {
   if(args.Length<3||args.Length>4) throw new LocalStoreError(LocalErrorCode.InvalidInput);
   string text=Console.In.ReadToEnd();if(text.Length>1024*1024) throw new LocalStoreError(LocalErrorCode.InvalidInput);
   JObject input=JObject.Parse(text);
   string[] allowed={"action","id","customer_id","project_id","name","phone","wechat","source","address","budget","status","notes","base_revision","revision","scene","scene_version","limit","offset","search","category","brand","sku","price","width_mm","depth_mm","height_mm","metadata","sha256","byte_count"};
   if(input.Properties().Any(x=>!allowed.Contains(x.Name))) throw new LocalStoreError(LocalErrorCode.InvalidInput);
   action=(string)input["action"];
   if(!new[]{"list","create","sample","current","save","versions","restore","validate","catalog","customers","customer_create","customer","customer_update","projects","project_create","project","project_update","products","product_create","product","product_update","model_attach","model_asset","quotation_create","quotation","quotations"}.Contains(action)) throw new LocalStoreError(LocalErrorCode.InvalidInput);
   var validator=new OfflineSceneValidator(File.ReadAllText(args[1]));
   var identity=LocalIdentity.Open(args[0]);object data=null;
   using(var store=new LocalSceneStore(args[0],identity.WorkspaceId,identity.ActorId,validator)) {
    int limit=checked((int)Number(input,"limit",20)),offset=checked((int)Number(input,"offset",0));
    switch(action) {
     case "customers":var customers=store.Customers(limit,offset);data=new{total=customers.Total,items=customers.Items.Select(x=>Customer(x))};break;
     case "customer_create":data=Customer(store.CreateCustomer(Field(input,"name"),Field(input,"phone"),Field(input,"wechat"),Field(input,"source"),Field(input,"address"),Field(input,"budget"),Field(input,"status")??"new",Field(input,"notes")));break;
     case "customer":data=Customer(store.Customer(Id(input)));break;
     case "customer_update":data=Customer(store.UpdateCustomer(Id(input),Number(input,"base_revision",-1),Field(input,"name"),Field(input,"phone"),Field(input,"wechat"),Field(input,"source"),Field(input,"address"),Field(input,"budget"),Field(input,"status"),Field(input,"notes")));break;
     case "projects":var projects=store.Projects(Reference(input,"customer_id"),limit,offset);data=new{total=projects.Total,items=projects.Items.Select(x=>Project(x))};break;
     case "project_create":data=Project(store.CreateProject(Reference(input,"customer_id"),Field(input,"name"),Field(input,"address"),Field(input,"status")??"draft"));break;
     case "project":data=Project(store.Project(Id(input)));break;
     case "project_update":if(input["customer_id"]!=null)throw new LocalStoreError(LocalErrorCode.InvalidInput);data=Project(store.UpdateProject(Id(input),Number(input,"base_revision",-1),Field(input,"name"),Field(input,"address"),Field(input,"status")));break;
     case "products":var saleProducts=store.LocalProducts(limit,offset,Field(input,"search"),Field(input,"category"));data=new{total=saleProducts.Total,items=saleProducts.Items.Select(x=>Product(x))};break;
     case "product_create":if(input["id"]!=null)throw new LocalStoreError(LocalErrorCode.InvalidInput);data=Product(store.CreateLocalProduct(Field(input,"category"),Field(input,"brand"),Field(input,"name"),Field(input,"sku"),Field(input,"price"),Dimension(input,"width_mm"),Dimension(input,"depth_mm"),Dimension(input,"height_mm"),Metadata(input)));break;
     case "product":data=Product(store.LocalProduct(Id(input)));break;
     case "product_update":data=Product(store.UpdateLocalProduct(Id(input),Number(input,"base_revision",-1),Field(input,"category"),Field(input,"brand"),Field(input,"name"),Field(input,"sku"),Field(input,"price"),Dimension(input,"width_mm"),Dimension(input,"depth_mm"),Dimension(input,"height_mm"),Metadata(input)));break;
     case "model_attach":store.AttachLocalModel(Id(input),Number(input,"base_revision",-1),Field(input,"sha256"),Number(input,"byte_count",-1));data=Product(store.LocalProduct(Id(input)));break;
     case "model_asset":var model=store.ModelAsset(Id(input));store.VerifiedModelPath(model.Id);data=new{id=model.Id,product_id=model.ProductId,sha256=model.Sha256,byte_count=model.ByteCount};break;
     case "quotation_create":var quoteProject=QuoteProject(store,input);data=Quotation(store.CreateQuotation(Reference(input,"customer_id"),quoteProject,Id(input),Number(input,"scene_version",0)));break;
     case "quotation":var detail=store.Quotation(Id(input));if(detail.ProjectId!=QuoteProject(store,input))throw new LocalStoreError(LocalErrorCode.NotFound);data=Quotation(detail);break;
     case "quotations":var quotePage=store.Quotations(QuoteProject(store,input),limit,offset);data=new{total=quotePage.Total,items=quotePage.Items.Select(x=>Quotation(x))};break;
     case "catalog":
      if(args.Length!=4) throw new LocalStoreError(LocalErrorCode.InvalidInput);
      var products=JArray.Parse(File.ReadAllText(args[3]));
      foreach(JObject item in products) {
       Guid product=Guid.Parse((string)item["id"]);
       string name=(string)item["name"];
       double width=(double)item["width_mm"],depth=(double)item["depth_mm"],height=(double)item["height_mm"];
       store.Catalog(product,name,width,depth,height);
      }
      foreach(var product in store.LocalModelProducts()) products.Add(JObject.FromObject(new{id=product.Id,name=product.Name,category=product.Category,width_mm=product.WidthMm,depth_mm=product.DepthMm,height_mm=product.HeightMm,model="/local-models/"+product.ActiveAssetId.Value.ToString("D")+".glb",asset_id=product.ActiveAssetId.Value,sku=product.Sku}));
      data=products;break;
     case "list":var scopedProject=SceneProject(store,input);var page=scopedProject.HasValue?store.ProjectScenes(scopedProject.Value,limit,offset):store.LegacyDocuments(limit,offset);data=new {total=page.Total,items=page.Items.Select(x=>new{id=x.Id,name=x.Name,revision=x.Revision,saved_at=x.UpdatedAt})};break;
     case "create":var targetProject=SceneProject(store,input);data=new{id=targetProject.HasValue?store.CreateForProject(targetProject.Value,Field(input,"name")):store.Create(Field(input,"name"))};break;
     case "current":RequireSceneScope(store,input);data=Version(store.Current(Id(input)));break;
     case "sample":RequireSceneScope(store,input);var session=new LocalSceneSession(store,validator,File.ReadAllText(args[2]));if(!session.Open(Id(input))||!session.LoadSample()) throw new LocalStoreError(LocalErrorCode.InvalidInput);data=new{scene=JObject.Parse(session.Draft)};break;
     case "save":RequireSceneScope(store,input);if(input["scene"]==null)throw new SceneValidationError();data=Version(store.Put(Id(input),Number(input,"base_revision",-1),input["scene"].ToString(Formatting.None)));break;
     case "versions":RequireSceneScope(store,input);data=store.Versions(Id(input),limit,offset).Select(x=>Version(x)).ToArray();break;
     case "restore":RequireSceneScope(store,input);data=Version(store.Restore(Id(input),Number(input,"base_revision",-1),Number(input,"revision",0)));break;
     case "validate":data=new{scene=validator.Validate(input["scene"].ToString(Formatting.None)).Copy()};break;
    }
   }
   Console.Write(JsonConvert.SerializeObject(new{status=200,data=data}));
  } catch(Exception error) {
   int status=500;var local=error as LocalStoreError;
   if(error is SceneValidationError||error is JsonException||error is FormatException||error is OverflowException)status=422;
   if(local!=null) switch(local.Code){case LocalErrorCode.InvalidInput:status=422;break;case LocalErrorCode.Conflict:status=409;break;case LocalErrorCode.NotFound:status=404;break;case LocalErrorCode.Busy:status=503;break;}
   bool productAction=action!=null&&(action.StartsWith("product",StringComparison.Ordinal)||action.StartsWith("model",StringComparison.Ordinal));
   bool quoteAction=action!=null&&action.StartsWith("quotation",StringComparison.Ordinal);
   string message;
   if(productAction&&status==409)message=action=="product_create"?"商品 SKU 已存在，请换一个 SKU。":"商品 SKU 冲突或资料已变化，你的修改已保留，请刷新后重试。";
   else if(action=="model_asset"&&status==404)message="本机模型文件已丢失、损坏或无权访问，请重新导入。";
   else if(productAction&&status==404)message="商品不存在，可能已被其他操作移除。";
   else if(productAction&&status==422)message="商品资料不合法，请检查价格、尺寸和属性后重试。";
   else if(quoteAction&&status==404)message="报价或关联的客户、项目、方案版本不存在。";
   else if(quoteAction&&status==422)message="报价条件不满足：请先保存含在售商品的项目方案，再重试。";
   else message=status==422?"填写的内容不符合场景要求，请检查后重试。":LocalSceneSession.Friendly(error);
   Console.Write(JsonConvert.SerializeObject(new{status=status,error=message}));
  }
  return 0;
 }
}
