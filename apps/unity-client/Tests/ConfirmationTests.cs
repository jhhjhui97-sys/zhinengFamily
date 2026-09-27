using System;
using LocalScenes;
public static class ConfirmationTests {
 static void Check(bool value) { if(!value) throw new Exception("Confirmation gate allowed unintended operation"); }
 public static void Run() {
  var gate=new LocalInteractionGate(); int changes=0;
  Check(gate.BeginConfirmation(()=>changes++));
  Check(!gate.TryRun(()=>changes+=10)&&!gate.BeginConfirmation(()=>changes+=100)&&!gate.CanInteract);
  Check(gate.Confirm()&&changes==1&&!gate.Confirm());
  Check(gate.BeginConfirmation(()=>changes++)); gate.Cancel(); Check(changes==1&&gate.CanInteract);
  gate.SetBusy(true); Check(!gate.TryRun(()=>changes++)&&!gate.BeginConfirmation(()=>changes++)&&!gate.CanInteract);
  gate.SetBusy(false); Check(gate.TryRun(()=>changes++)&&changes==2);
  Console.WriteLine("Confirmation gate: 4 boundary checks passed");
 }
}
