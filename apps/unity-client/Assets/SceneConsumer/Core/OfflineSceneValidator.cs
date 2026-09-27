using System;
namespace SmartHome.SceneConsumer {
 public sealed class SceneValidationError : Exception {
  public SceneValidationError() : base("场景数据不符合协议，请检查结构、尺寸和对象关联。") {}
 }
 public sealed class OfflineSceneValidator {
  readonly SceneSchemaRules schema;
  public OfflineSceneValidator(string schemaJson) {
   try { schema=new SceneSchemaRules(schemaJson); } catch(SceneValidationError) { throw; }
   catch(ArgumentException) { throw new SceneValidationError(); }
   catch(Newtonsoft.Json.JsonException) { throw new SceneValidationError(); }
  }
  public SceneDocument Validate(string json) {
   try {
    var document=SceneDocument.Parse(json); var root=document.Copy();
    schema.Validate(root);
    SceneGeometryRules.Validate(root);
    SceneReferenceRules.Validate(root);
    return document;
   } catch(SceneValidationError) { throw; }
   catch(ArgumentException) { throw new SceneValidationError(); }
   catch(OverflowException) { throw new SceneValidationError(); }
   catch(Newtonsoft.Json.JsonException) { throw new SceneValidationError(); }
  }
 }
}
