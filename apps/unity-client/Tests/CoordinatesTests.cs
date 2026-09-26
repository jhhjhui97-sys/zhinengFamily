using System;
using SmartHome.SceneConsumer;
public static class CoordinatesTests
{
    static int count;
    static void Near(double value, double expected) { if (Math.Abs(value-expected)>1e-9) throw new Exception("Expected " + expected + " got " + value); }
    static void Vector(PresentationVector value, double x,double y,double z) { Near(value.X,x); Near(value.Y,y); Near(value.Z,z); count++; }
    static void Reject(Action action) { try { action(); } catch(ArgumentException) { count++; return; } throw new Exception("Invalid input was accepted"); }
    public static int Main()
    {
        Vector(SceneCoordinates.ToUnityPosition(new PresentationVector(1200,2300,400),3000),1.2,3.4,2.3);
        Vector(SceneCoordinates.FromUnityPosition(new PresentationVector(1.2,3.4,2.3),3000),1200,2300,400);
        Vector(SceneCoordinates.ToUnitySize(2400,950,850),2.4,.85,.95);
        Vector(SceneCoordinates.RotateUnityBasis(new PresentationVector(1,0,0),90),0,0,1);
        Vector(SceneCoordinates.RotateUnityBasis(new PresentationVector(0,0,1),90),-1,0,0);
        Vector(SceneCoordinates.RotateUnityBasis(new PresentationVector(1,0,0),270),0,0,-1);
        Vector(SceneCoordinates.RotateUnityBasis(new PresentationVector(1,2,3),0),1,2,3);
        Vector(SceneCoordinates.ToUnityPosition(new PresentationVector(-1000,-2000,0),-500),-1,-.5,-2);
        Vector(SceneCoordinates.ToUnityPosition(new PresentationVector(0,0,100),6000),0,6.1,0);
        Vector(SceneCoordinates.ToUnityPosition(new PresentationVector(0,0,100),0),0,.1,0);
        var world=SceneCoordinates.ToUnityPosition(new PresentationVector(-1234.56,789.12,40.5),2800);
        Vector(SceneCoordinates.FromUnityPosition(world,2800),-1234.56,789.12,40.5);
        Reject(()=>SceneCoordinates.ToUnityPosition(new PresentationVector(double.NaN,0,0),0));
        Reject(()=>SceneCoordinates.ToUnityPosition(new PresentationVector(0,0,0),double.PositiveInfinity));
        Reject(()=>SceneCoordinates.ToUnitySize(0,1,1));
        Reject(()=>SceneCoordinates.ToUnitySize(1,-1,1));
        Reject(()=>SceneCoordinates.ToUnitySize(1,1,double.NegativeInfinity));
        Reject(()=>SceneCoordinates.RotateUnityBasis(new PresentationVector(1,0,0),360));
        Reject(()=>SceneCoordinates.RotateUnityBasis(new PresentationVector(1,0,0),-1));
        Reject(()=>SceneCoordinates.FromUnityPosition(new PresentationVector(double.PositiveInfinity,0,0),0));
        Console.WriteLine(count+" coordinate cases passed"); return 0;
    }
}
