using System.Collections.Generic;
namespace SmartHome.SceneConsumer {
 /// <summary>A pointer is admitted only where its gesture began; crossing UI never starts camera input.</summary>
 public sealed class PreviewGestureGate {
  readonly Dictionary<int,bool> pointers=new Dictionary<int,bool>();
  public void Begin(int id,bool preview) { if(!pointers.ContainsKey(id)) pointers.Add(id,preview); }
  public bool Allows(int id,bool preview) { bool admitted; return preview&&pointers.TryGetValue(id,out admitted)&&admitted; }
  public void End(int id) { pointers.Remove(id); }
  public void Reset() { pointers.Clear(); }
 }
}
