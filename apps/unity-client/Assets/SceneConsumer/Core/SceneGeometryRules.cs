using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
namespace SmartHome.SceneConsumer {
internal static class SceneGeometryRules {
 internal const double Tolerance=0.001;
 static void Require(bool valid) { if(!valid) throw new SceneValidationError(); }
 internal static IEnumerable<JObject> Items(JObject root,string name) {
  var array=root[name] as JArray;
  if(array!=null) foreach(JObject item in array) yield return item;
 }
 static double[] Point(JToken p) { return p["z"]==null ? new[] {(double)p["x"],(double)p["y"]} : new[] {(double)p["x"],(double)p["y"],(double)p["z"]}; }
 static double Hypot(params double[] values) {
  double maximum=0;
  foreach(double v in values) { if(double.IsInfinity(v)||double.IsNaN(v)) return double.PositiveInfinity; maximum=Math.Max(maximum,Math.Abs(v)); }
  if(maximum==0) return 0;
  double sum=0; foreach(double v in values) sum+=(v/maximum)*(v/maximum);
  return maximum*Math.Sqrt(sum);
 }
 internal static double Length(JToken start,JToken end) {
  var a=Point(start); var b=Point(end); var differences=new double[a.Length];
  for(int i=0;i<a.Length;i++) differences[i]=b[i]-a[i];
  double length=Hypot(differences);
  Require(!double.IsInfinity(length)&&length>Tolerance); return length;
 }
 static double Distance(double[] a,double[] b,double[] p) {
  double dx=b[0]-a[0],dy=b[1]-a[1],length=Hypot(dx,dy);
  return dx/length*(p[1]-a[1])-dy/length*(p[0]-a[0]);
 }
 static bool On(double[] a,double[] b,double[] p,double t) {
  return Math.Abs(Distance(a,b,p))<=t&&Math.Min(a[0],b[0])-t<=p[0]&&p[0]<=Math.Max(a[0],b[0])+t&&Math.Min(a[1],b[1])-t<=p[1]&&p[1]<=Math.Max(a[1],b[1])+t;
 }
 static bool Cross(double[] a,double[] b,double[] c,double[] d,double t) {
  double u=Distance(a,b,c),v=Distance(a,b,d),w=Distance(c,d,a),x=Distance(c,d,b);
  return (((u>t&&v<-t)||(u<-t&&v>t))&&((w>t&&x<-t)||(w<-t&&x>t)))||On(a,b,c,t)||On(a,b,d,t)||On(c,d,a,t)||On(c,d,b,t);
 }
 static void Boundary(JArray source) {
  int size=source.Count; var points=new double[size][];
  double minX=double.PositiveInfinity,minY=double.PositiveInfinity,maxX=double.NegativeInfinity,maxY=double.NegativeInfinity;
  for(int i=0;i<size;i++) {
   points[i]=Point(source[i]);
   minX=Math.Min(minX,points[i][0]); minY=Math.Min(minY,points[i][1]);
   maxX=Math.Max(maxX,points[i][0]); maxY=Math.Max(maxY,points[i][1]);
   Length(source[i],source[(i+1)%size]);
   for(int j=0;j<i;j++) Require(Hypot(points[i][0]-points[j][0],points[i][1]-points[j][1])>Tolerance);
  }
  double scale=Math.Max(maxX-minX,maxY-minY);
  Require(scale>0&&!double.IsInfinity(scale));
  for(int i=0;i<size;i++) { points[i][0]=(points[i][0]-minX)/scale; points[i][1]=(points[i][1]-minY)/scale; }
  double tolerance=Tolerance/scale,area=0,compensation=0;
  for(int i=0;i<size;i++) {
   var a=points[i]; var b=points[(i+1)%size];
   Require(a[0]!=b[0]||a[1]!=b[1]);
   double term=a[0]*b[1]-b[0]*a[1];
   double combined=area+term;
   compensation+=Math.Abs(area)>=Math.Abs(term)?(area-combined)+term:(term-combined)+area;
   area=combined;
  }
  Require(area+compensation>tolerance*tolerance);
  for(int i=0;i<size;i++) {
   var a=points[(i+size-1)%size]; var b=points[i]; var c=points[(i+1)%size];
   if(Math.Abs(Distance(a,b,c))<=tolerance) Require((a[0]-b[0])*(c[0]-b[0])+(a[1]-b[1])*(c[1]-b[1])<=0);
   for(int j=i+1;j<size;j++) {
    if(j==i+1||(i==0&&j==size-1)) continue;
    Require(!Cross(points[i],points[(i+1)%size],points[j],points[(j+1)%size],tolerance));
   }
  }
 }
 internal static void Validate(JObject root) {
  foreach(var room in Items(root,"rooms")) Boundary((JArray)room["boundary"]);
  foreach(var wall in Items(root,"walls")) Length(wall["start"],wall["end"]);
  foreach(var beam in Items(root,"beams")) Length(beam["start"],beam["end"]);
 }
}
}
