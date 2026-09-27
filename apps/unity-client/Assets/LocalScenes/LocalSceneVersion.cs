using System;
namespace LocalScenes {
 public sealed class LocalSceneVersion {
  public Guid Id { get; internal set; }
  public Guid DocumentId { get; internal set; }
  public Guid WorkspaceId { get; internal set; }
  public long Revision { get; internal set; }
  public Guid CreatedBy { get; internal set; }
  public string CreatedAt { get; internal set; }
  public string SceneJson { get; internal set; }
 }
}
