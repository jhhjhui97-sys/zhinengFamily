using System;
namespace SmartHome.SceneConsumer
{
    // Presentation math only; this is not another SceneModel definition.
    public struct PresentationVector
    {
        public readonly double X, Y, Z;
        public PresentationVector(double x,double y,double z) { X=x; Y=y; Z=z; }
    }
    public static class SceneCoordinates
    {
        static void Finite(double number) { if (double.IsNaN(number)||double.IsInfinity(number)) throw new ArgumentException("Coordinates must be finite"); }
        static PresentationVector Checked(double x,double y,double z) { Finite(x); Finite(y); Finite(z); return new PresentationVector(x,y,z); }
        static void Finite(PresentationVector p) { Finite(p.X); Finite(p.Y); Finite(p.Z); }
        public static PresentationVector ToUnityPosition(PresentationVector localMm,double floorElevationMm)
        {
            Finite(localMm); Finite(floorElevationMm);
            // Divide before adding to avoid unnecessary overflow in mm.
            return Checked(localMm.X/1000,localMm.Z/1000+floorElevationMm/1000,localMm.Y/1000);
        }
        public static PresentationVector FromUnityPosition(PresentationVector worldM,double floorElevationMm)
        {
            Finite(worldM); Finite(floorElevationMm);
            return Checked(worldM.X*1000,worldM.Z*1000,worldM.Y*1000-floorElevationMm);
        }
        public static PresentationVector ToUnitySize(double widthMm,double depthMm,double heightMm)
        {
            Finite(widthMm); Finite(depthMm); Finite(heightMm);
            if(widthMm<=0||depthMm<=0||heightMm<=0) throw new ArgumentException("Dimensions must be positive");
            return Checked(widthMm/1000,heightMm/1000,depthMm/1000);
        }
        public static PresentationVector RotateUnityBasis(PresentationVector basis,double protocolDegrees)
        {
            Finite(basis); Finite(protocolDegrees);
            if(protocolDegrees<0||protocolDegrees>=360) throw new ArgumentException("Rotation must be in [0,360)");
            double radians=protocolDegrees*Math.PI/180, c=Math.Cos(radians),s=Math.Sin(radians);
            // S * Rz * inverse(S): a protocol +90 turns Unity right toward forward.
            return Checked(c*basis.X-s*basis.Z,basis.Y,s*basis.X+c*basis.Z);
        }
    }
}
