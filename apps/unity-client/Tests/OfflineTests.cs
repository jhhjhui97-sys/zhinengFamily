using System;
using System.IO;
public static class OfflineTests {
 public static int Main(string[] args) {
  string directory=Path.Combine(Path.GetTempPath(),"offline-core-"+Guid.NewGuid());
  Directory.CreateDirectory(directory);
  try {
   SqliteTests.Run(directory);
   ValidationTests.Run(args[0],args[1]);
   LocalStoreTests.Run(args[0],args[2],directory);
   ReviewRegressionTests.Run(args[0],args[2]);
   Console.WriteLine("All offline core suites passed on real SQLite");
   return 0;
  } catch(Exception e) { Console.Error.WriteLine(e); return 1; }
  finally { Directory.Delete(directory,true); }
 }
}
