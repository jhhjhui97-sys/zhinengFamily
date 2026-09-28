using System;
using System.IO;
using LocalScenes;
using SmartHome.SceneConsumer;

public static class LocalSalesTests {
 static int passed;
 static void Check(bool value,string message) { if(!value) throw new Exception(message); }
 static void Test(string name,Action body) { body(); passed++; Console.WriteLine("PASS "+name); }
 static void Reject(Action body,LocalErrorCode code) { SqliteTests.Error(body,code); }
 public static void Run(string schema,string directory) {
  var validator=new OfflineSceneValidator(File.ReadAllText(schema));
  Test("customers persist exact fields and paginate within the workspace",()=>{
   string path=Path.Combine(directory,"sales-customers.sqlite");
   Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid(),first;
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) {
    var created=store.CreateCustomer("张先生","13800000001","zhang","到店","龙湖小区","80000.50","following","喜欢浅灰色");
    first=created.Id;
    Check(created.Revision==1&&created.Budget=="80000.50"&&created.Status=="following","new customer fields");
    for(int i=0;i<23;i++) store.CreateCustomer("测试客户"+i,"13800001"+i.ToString("D3"));
    var page1=store.Customers(20,0); var page2=store.Customers(20,20);
    Check(page1.Total==24&&page1.Items.Count==20&&page2.Items.Count==4,"customer pagination");
    Check(store.Customer(first).Notes=="喜欢浅灰色","customer detail");
    Reject(()=>store.CreateCustomer("另一位","13800000001"),LocalErrorCode.Conflict);
    Check(store.Customers().Total==24,"duplicate phone inserted");
   }
   using(var reopened=new LocalSceneStore(path,workspace,actor,validator))
    Check(reopened.Customer(first).Budget=="80000.50","customer restart persistence");
   using(var other=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
    Check(other.Customers().Total==0,"other workspace saw customers");
    Reject(()=>other.Customer(first),LocalErrorCode.NotFound);
    Reject(()=>other.UpdateCustomer(first,1,"越权",null,null,null,null,null,"new",null),LocalErrorCode.NotFound);
   }
  });
  Test("customer validation and stale edits do not overwrite committed data",()=>{
   string path=Path.Combine(directory,"sales-customer-edits.sqlite");
   using(var store=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
    Reject(()=>store.CreateCustomer("  "),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateCustomer("客户",null,null,null,null,"1e400"),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateCustomer("客户",null,null,null,null,"-1"),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateCustomer("客户",null,null,null,null,"12.345"),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateCustomer("客户",null,null,null,null,null,"unknown"),LocalErrorCode.InvalidInput);
    var person=store.CreateCustomer("王女士",null,null,null,null,"0.01");
    var edited=store.UpdateCustomer(person.Id,1,"王女士","13800000002","wx2","朋友介绍","新地址","12345.67","won","已成交");
    Check(edited.Revision==2&&edited.Budget=="12345.67"&&edited.Name=="王女士","customer update");
    Reject(()=>store.UpdateCustomer(person.Id,1,"旧页面覆盖",null,null,null,null,null,"new",null),LocalErrorCode.Conflict);
    Check(store.Customer(person.Id).Notes=="已成交"&&store.Customer(person.Id).Revision==2,"stale edit mutated customer");
   }
  });
  Test("projects are customer-scoped with unique names and immutable ownership",()=>{
   string path=Path.Combine(directory,"sales-projects.sqlite");
   Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid(),customer,project;
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) {
    customer=store.CreateCustomer("张先生").Id;
    var second=store.CreateCustomer("张先生").Id;
    var created=store.CreateProject(customer,"龙湖小区120㎡","杭州龙湖小区","draft");
    project=created.Id;
    Check(created.CustomerId==customer&&created.SalesActorId==actor&&created.Revision==1,"project provenance");
    Reject(()=>store.CreateProject(customer,"龙湖小区120㎡"),LocalErrorCode.Conflict);
    Check(store.CreateProject(second,"龙湖小区120㎡").CustomerId==second,"name must be scoped by customer");
    Check(store.Projects(customer).Total==1&&store.Projects(second).Total==1,"project list scope");
    Reject(()=>store.CreateProject(Guid.NewGuid(),"错误关联"),LocalErrorCode.NotFound);
    Reject(()=>store.CreateProject(customer,"  "),LocalErrorCode.InvalidInput);
    Reject(()=>store.CreateProject(customer,"测试",null,"unknown"),LocalErrorCode.InvalidInput);
    var edited=store.UpdateProject(project,1,"龙湖小区精装方案","杭州新地址","active");
    Check(edited.Revision==2&&edited.CustomerId==customer&&edited.Status=="active","project update");
    Reject(()=>store.UpdateProject(project,1,"旧名称",null,"draft"),LocalErrorCode.Conflict);
    Check(store.Project(project).Name=="龙湖小区精装方案","stale project overwrite");
   }
   using(var reopened=new LocalSceneStore(path,workspace,actor,validator)) Check(reopened.Project(project).CustomerId==customer,"project lost after restart");
   using(var other=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
    Reject(()=>other.Project(project),LocalErrorCode.NotFound);
    Reject(()=>other.Projects(customer),LocalErrorCode.NotFound);
    Reject(()=>other.CreateProject(customer,"越权"),LocalErrorCode.NotFound);
    Reject(()=>other.UpdateProject(project,2,"越权",null,"draft"),LocalErrorCode.NotFound);
   }
  });
  Test("project scenes are linked atomically and legacy scenes remain available",()=>{
   string path=Path.Combine(directory,"sales-scene-links.sqlite");
   Guid workspace=Guid.NewGuid(),actor=Guid.NewGuid(),linked,project,legacy;
   using(var store=new LocalSceneStore(path,workspace,actor,validator)) {
    Guid customer=store.CreateCustomer("张先生").Id;
    Guid otherCustomer=store.CreateCustomer("李女士").Id;
    project=store.CreateProject(customer,"龙湖小区").Id;
    Guid otherProject=store.CreateProject(otherCustomer,"江景苑").Id;
    linked=store.CreateForProject(project,"客厅方案");
    legacy=store.Create("以前保存的方案");
    Check(store.ProjectScenes(project).Total==1&&store.ProjectScenes(otherProject).Total==0,"project scene list leaked");
    Check(store.LegacyDocuments().Total==1&&store.LegacyDocuments().Items[0].Id==legacy,"legacy scene was hidden or linked");
    store.RequireSceneAccess(linked,project);
    store.RequireSceneAccess(legacy,null);
    Reject(()=>store.RequireSceneAccess(linked,null),LocalErrorCode.NotFound);
    Reject(()=>store.RequireSceneAccess(linked,otherProject),LocalErrorCode.NotFound);
    Reject(()=>store.RequireSceneAccess(legacy,project),LocalErrorCode.NotFound);
    Reject(()=>store.CreateForProject(Guid.NewGuid(),"不存在"),LocalErrorCode.NotFound);
    store.Catalog(Guid.Parse("40000000-0000-4000-8000-000000000002"),"沙发",2400,950,850);
    string scene=File.ReadAllText(Path.Combine(Path.GetDirectoryName(schema),"two-bedroom.json"));
    store.Put(linked,0,scene);store.Put(linked,1,scene);store.Restore(linked,2,1);
    Check(store.Current(linked).Revision==3&&store.Versions(linked).Count==3,"linked history damaged");
    using(var sql=new SqliteConnection(path)) {
     sql.Execute("CREATE TRIGGER reject_link BEFORE INSERT ON project_scenes BEGIN SELECT RAISE(ABORT,'test failure'); END");
     Reject(()=>store.CreateForProject(project,"不能半成品"),LocalErrorCode.Conflict);
     Check((long)sql.Query("SELECT COUNT(*) n FROM scene_documents WHERE name='不能半成品'")[0]["n"]==0,"failed link left orphan scene");
    }
   }
   using(var reopened=new LocalSceneStore(path,workspace,actor,validator)) {
    reopened.RequireSceneAccess(linked,project);
    Check(reopened.Current(linked).Revision==3&&reopened.LegacyDocuments().Total==1,"restart lost scene relation");
   }
   using(var other=new LocalSceneStore(path,Guid.NewGuid(),Guid.NewGuid(),validator)) {
    Reject(()=>other.RequireSceneAccess(linked,project),LocalErrorCode.NotFound);
    Reject(()=>other.ProjectScenes(project),LocalErrorCode.NotFound);
   }
  });
  Console.WriteLine("Local sales: "+passed+" passed");
 }
}
