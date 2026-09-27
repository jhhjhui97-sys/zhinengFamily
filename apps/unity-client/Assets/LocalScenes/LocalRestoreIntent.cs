using System;
namespace LocalScenes {
 public sealed class LocalRestoreIntent {
  public Guid DocumentId { get; private set; }
  public long BaseRevision { get; private set; }
  public long Revision { get; private set; }
  internal LocalRestoreIntent(Guid document,long baseline,long revision) { DocumentId=document; BaseRevision=baseline; Revision=revision; }
 }
}
