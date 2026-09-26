using System;
namespace LocalScenes {
 public enum LocalErrorCode { Busy, Corrupt, Unavailable, Conflict, NotFound, InvalidInput }
 public sealed class LocalStoreError : Exception {
  public LocalErrorCode Code { get; private set; }
  public LocalStoreError(LocalErrorCode code) : base("本地资料操作失败：" + code) { Code = code; }
 }
}
