using System;
namespace LocalScenes {
 /// <summary>Commands and edits are suspended while confirmation is pending or a local operation is running.</summary>
 public sealed class LocalInteractionGate {
  Action pending; bool busy;
  public bool CanInteract { get { return !busy&&pending==null; } }
  public bool BeginConfirmation(Action action) { if(!CanInteract||action==null) return false; pending=action; return true; }
  public bool TryRun(Action action) { if(!CanInteract||action==null) return false; action(); return true; }
  public bool Confirm() { if(busy||pending==null) return false; var action=pending; pending=null; action(); return true; }
  public void Cancel() { pending=null; }
  public void SetBusy(bool value) { busy=value; }
 }
}
