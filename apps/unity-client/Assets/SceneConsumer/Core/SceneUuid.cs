using System;
namespace SmartHome.SceneConsumer {
 public static class SceneUuid {
  public static Guid Parse(string value) {
   if(value==null) throw new SceneValidationError();
   bool urn=value.StartsWith("urn:uuid:",StringComparison.Ordinal);
   if(urn) value=value.Substring(9);
   Guid id;
   if(Guid.TryParseExact(value,"D",out id)||(!urn&&(Guid.TryParseExact(value,"N",out id)||Guid.TryParseExact(value,"B",out id)))) return id;
   throw new SceneValidationError();
  }
 }
}
