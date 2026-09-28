using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
internal static class Launcher {
 static string Quote(string value) { return "\""+value.Replace("\"","\\\"")+"\""; }
 [STAThread] static int Main(string[] args) {
  bool smoke=args.Length==1&&args[0]=="--smoke-test";
  Process service=null;Mutex mutex=null;bool owns=false;
  try {
   if(!smoke){mutex=new Mutex(true,"Local\\ZhinengFamilyLocalWindows",out owns);if(!owns){MessageBox.Show("智能家居已在运行，请查看已打开的设计窗口。","智能家居");return 0;}}
   string root=AppDomain.CurrentDomain.BaseDirectory;
   string node=Path.Combine(root,"runtime","node.exe"),client=Path.Combine(root,"runtime","client"),bridge=Path.Combine(root,"runtime","bridge","LocalBridge.exe");
   if(!File.Exists(node)||!File.Exists(bridge)||!File.Exists(Path.Combine(client,"server.mjs")))throw new IOException();
   string data=smoke?Path.Combine(Path.GetTempPath(),"FamilyPackageSmoke-"+Guid.NewGuid().ToString("N")):Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"ZhinengFamily");
   Directory.CreateDirectory(data);
   var config=new ProcessStartInfo(node,Quote(Path.Combine(client,"server.mjs"))){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,WorkingDirectory=client,RedirectStandardOutput=true,RedirectStandardError=true};
   config.EnvironmentVariables["FAMILY_BRIDGE"]=bridge;config.EnvironmentVariables["FAMILY_PROTOCOL"]=Path.Combine(client,"protocol");config.EnvironmentVariables["FAMILY_DATA"]=data;
   service=Process.Start(config);service.ErrorDataReceived+=(s,e)=>{};service.BeginErrorReadLine();
   var first=Task.Factory.StartNew(()=>service.StandardOutput.ReadLine());if(!first.Wait(15000))throw new IOException();string line=first.Result;
   if(line==null||!line.StartsWith("LOCAL_URL=http://127.0.0.1:"))throw new IOException();Uri uri;if(!Uri.TryCreate(line.Substring(10),UriKind.Absolute,out uri)||uri.Host!="127.0.0.1"||uri.Scheme!="http"||uri.Port<1)throw new IOException();
   if(smoke){using(var web=new WebClient()){string html=web.DownloadString(uri);if(!html.Contains("viewport"))throw new IOException();}Console.WriteLine("PACKAGED_SERVER_OK "+uri.Port);return 0;}
   string edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe");if(!File.Exists(edge))edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Microsoft","Edge","Application","msedge.exe");if(!File.Exists(edge)){MessageBox.Show("需要 Microsoft Edge 浏览器。请安装 Edge 后重新打开，资料不会被删除。","智能家居");return 1;}
   string profile=Path.Combine(data,"browser");
   var window=new ProcessStartInfo(edge,"--no-first-run --disable-background-mode --user-data-dir="+Quote(profile)+" --app="+Quote(uri.AbsoluteUri)){UseShellExecute=false};
   using(var browser=Process.Start(window)){browser.WaitForExit();}
   return 0;
  }catch{if(!smoke)MessageBox.Show("本地软件启动失败。请保留资料，确认安装目录完整后重试。","智能家居",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}
  finally{if(service!=null){try{if(!service.HasExited){service.Kill();service.WaitForExit(5000);}}catch{}service.Dispose();}if(mutex!=null){if(owns)mutex.ReleaseMutex();mutex.Dispose();}}
 }
}
