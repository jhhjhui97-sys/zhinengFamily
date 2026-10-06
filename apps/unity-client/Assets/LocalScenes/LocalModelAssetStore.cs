using System;
using System.IO;
using System.Security.Cryptography;
using System.Collections.Generic;

namespace LocalScenes {
 public sealed class LocalModelAsset {
  public Guid Id { get; internal set; }
  public Guid ProductId { get; internal set; }
  public string Sha256 { get; internal set; }
  public long ByteCount { get; internal set; }
  public string CreatedAt { get; internal set; }
 }
 public sealed partial class LocalSceneStore {
  static bool ValidSha(string sha) {
   if(sha==null||sha.Length!=64)return false;
   foreach(char c in sha)if(!((c>='0'&&c<='9')||(c>='a'&&c<='f')))return false;
   return true;
  }
  string ModelPath(string sha) {
   Input(ValidSha(sha));
   return Path.Combine(Path.GetDirectoryName(Path.GetFullPath(databasePath)),"models",sha+".glb");
  }
  static string Hash(string file) {
   using(var stream=File.OpenRead(file))using(var sha=SHA256.Create())
    return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
  }
  public LocalModelAsset ModelAsset(Guid id) {
   var rows=db.Query("SELECT * FROM local_model_assets WHERE workspace_id=? AND id=?",Key(workspace),Key(id));
   if(rows.Count!=1)throw new LocalStoreError(LocalErrorCode.NotFound);
   var row=rows[0];
   return new LocalModelAsset {Id=id,ProductId=Guid.Parse((string)row["product_id"]),Sha256=(string)row["sha256"],ByteCount=(long)row["byte_count"],CreatedAt=(string)row["created_at"]};
  }
  public List<LocalProduct> LocalModelProducts() {
   var products=new List<LocalProduct>();
   foreach(var row in db.Query(@"SELECT p.*,m.asset_id active_asset_id FROM local_products p
    INNER JOIN local_product_active_model m ON m.workspace_id=p.workspace_id AND m.product_id=p.id
    WHERE p.workspace_id=? AND p.deleted_at IS NULL ORDER BY p.name,p.id",Key(workspace))) {
    var product=ProductRow(row);
    try { VerifiedModelPath(product.ActiveAssetId.Value); products.Add(product); }
    catch(LocalStoreError error) { if(error.Code!=LocalErrorCode.NotFound) throw; }
   }
   return products;
  }
  public string VerifiedModelPath(Guid id) {
   var asset=ModelAsset(id);string path=ModelPath(asset.Sha256);
   if(!File.Exists(path)||new FileInfo(path).Length!=asset.ByteCount||Hash(path)!=asset.Sha256)throw new LocalStoreError(LocalErrorCode.NotFound);
   return path;
  }
  void RequireUploadedModel(string sha,long byteCount) {
   Input(ValidSha(sha)&&byteCount>0&&byteCount<=30L*1024*1024);
   string file=ModelPath(sha);
   Input(File.Exists(file)&&new FileInfo(file).Length==byteCount&&Hash(file)==sha);
  }
  LocalModelAsset AttachLocalModelCore(Guid product,long baseRevision,string sha,long byteCount) {
   ActiveLocalProduct(product);
   Guid assetId=Guid.NewGuid();string stamp=Now();
   int changed=db.Execute("UPDATE local_products SET revision=revision+1,updated_at=? WHERE workspace_id=? AND id=? AND revision=? AND deleted_at IS NULL",stamp,Key(workspace),Key(product),baseRevision);
   if(changed!=1)throw new LocalStoreError(LocalErrorCode.Conflict);
   db.Execute("INSERT INTO local_model_assets(workspace_id,id,product_id,sha256,byte_count,created_at) VALUES(?,?,?,?,?,?)",Key(workspace),Key(assetId),Key(product),sha,byteCount,stamp);
   db.Execute("DELETE FROM local_product_active_model WHERE workspace_id=? AND product_id=?",Key(workspace),Key(product));
   db.Execute("INSERT INTO local_product_active_model(workspace_id,product_id,asset_id) VALUES(?,?,?)",Key(workspace),Key(product),Key(assetId));
   return ModelAsset(assetId);
  }
  public LocalModelAsset AttachLocalModel(Guid product,long baseRevision,string sha,long byteCount) {
   Input(product!=Guid.Empty&&baseRevision>=1&&baseRevision<long.MaxValue&&ValidSha(sha)&&byteCount>0&&byteCount<=30L*1024*1024);
   ActiveLocalProduct(product);RequireUploadedModel(sha,byteCount);
   LocalModelAsset asset=null;
   db.Transaction(()=>{asset=AttachLocalModelCore(product,baseRevision,sha,byteCount);});
   return asset;
  }
  public LocalProduct CreateLocalProductWithModel(string category,string brand,string name,string sku,string price,double width,double depth,double height,string metadataJson,string sha,long byteCount) {
   RequireUploadedModel(sha,byteCount);
   LocalProduct product=null;
   db.Transaction(()=>{
    var created=CreateLocalProduct(category,brand,name,sku,price,width,depth,height,metadataJson);
    AttachLocalModelCore(created.Id,created.Revision,sha,byteCount);
    product=LocalProduct(created.Id);
   });
   return product;
  }
 }
}
