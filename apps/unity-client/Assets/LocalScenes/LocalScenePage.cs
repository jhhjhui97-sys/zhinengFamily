using System;
using System.Collections.Generic;
namespace LocalScenes {
 public sealed class LocalSceneSummary { public Guid Id; public string Name; public long Revision; public string UpdatedAt; }
 public sealed class LocalScenePage { public long Total; public List<LocalSceneSummary> Items; }
}
