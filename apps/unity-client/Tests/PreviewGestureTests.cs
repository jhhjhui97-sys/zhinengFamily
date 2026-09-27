using System;
using SmartHome.SceneConsumer;
public static class PreviewGestureTests {
 static void Check(bool v) { if(!v) throw new Exception("UI gesture isolation failed"); }
 public static void Run() {
  var gate=new PreviewGestureGate();
  gate.Begin(1,false); Check(!gate.Allows(1,true)); gate.End(1); gate.Begin(1,true); Check(gate.Allows(1,true));
  Check(!gate.Allows(1,false)&&gate.Allows(1,true)); gate.Begin(2,false); Check(!gate.Allows(1,true)||!gate.Allows(2,true));
  gate.Reset(); Check(!gate.Allows(1,true)&&!gate.Allows(2,true));
  gate.Begin(1,false); gate.Begin(1,true); Check(!gate.Allows(1,true));
  Console.WriteLine("Preview gestures: 5 boundary checks passed");
 }
}
