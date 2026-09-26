using System;
using System.Globalization;
using System.Numerics;
using System.Text;
using Newtonsoft.Json.Linq;
namespace SmartHome.SceneConsumer {
// Strict RFC JSON, preserving integer metadata without a double conversion or Json.NET's 380-digit reader limit.
internal sealed class StrictSceneJson {
 readonly string text; int cursor;
 StrictSceneJson(string text) { this.text=text; }
 internal static JObject Parse(string text) {
  if(string.IsNullOrWhiteSpace(text)||text.Length>8*1024*1024) throw new ArgumentException("Invalid scene JSON");
  var reader=new StrictSceneJson(text);
  var result=reader.Value(0) as JObject; reader.Space();
  if(result==null||reader.cursor!=text.Length) throw new ArgumentException("Invalid scene JSON");
  return result;
 }
 void Bad() { throw new ArgumentException("Invalid scene JSON"); }
 void Space() { while(cursor<text.Length && (text[cursor]==' '||text[cursor]=='\t'||text[cursor]=='\n'||text[cursor]=='\r')) cursor++; }
 bool Take(char ch) { Space(); if(cursor<text.Length&&text[cursor]==ch) { cursor++; return true; } return false; }
 void Need(char ch) { if(!Take(ch)) Bad(); }
 JToken Value(int depth) {
  Space(); if(depth>128||cursor>=text.Length) { Bad(); }
  char ch=text[cursor];
  if(ch=='{') {
   cursor++; var obj=new JObject(); if(Take('}')) return obj;
   do { Space(); string key=String(); Need(':'); if(obj.Property(key)!=null) Bad(); obj.Add(key,Value(depth+1)); } while(Take(','));
   Need('}'); return obj;
  }
  if(ch=='[') {
   cursor++; var array=new JArray(); if(Take(']')) return array;
   do { array.Add(Value(depth+1)); } while(Take(','));
   Need(']'); return array;
  }
  if(ch=='"') return new JValue(String());
  if(ch=='t') { Literal("true"); return new JValue(true); }
  if(ch=='f') { Literal("false"); return new JValue(false); }
  if(ch=='n') { Literal("null"); return JValue.CreateNull(); }
  return Number();
 }
 void Literal(string literal) {
  if(cursor+literal.Length>text.Length||string.CompareOrdinal(text,cursor,literal,0,literal.Length)!=0) Bad();
  cursor+=literal.Length;
 }
 string String() {
  if(cursor>=text.Length||text[cursor++]!='"') { Bad(); }
  var result=new StringBuilder();
  while(cursor<text.Length) {
   char ch=text[cursor++];
   if(ch=='"') {
    string value=result.ToString();
    try { new UTF8Encoding(false,true).GetByteCount(value); }
    catch(EncoderFallbackException) { Bad(); }
    return value;
   }
   if(ch<32) Bad();
   if(ch!='\\') { result.Append(ch); continue; }
   if(cursor>=text.Length) Bad();
   char escaped=text[cursor++];
   switch(escaped) {
    case '"': case '\\': case '/': result.Append(escaped); break;
    case 'b': result.Append('\b'); break;
    case 'f': result.Append('\f'); break;
    case 'n': result.Append('\n'); break;
    case 'r': result.Append('\r'); break;
    case 't': result.Append('\t'); break;
    case 'u':
     if(cursor+4>text.Length) Bad();
     int value;
     if(!int.TryParse(text.Substring(cursor,4),NumberStyles.AllowHexSpecifier,CultureInfo.InvariantCulture,out value)) Bad();
     result.Append((char)value); cursor+=4; break;
    default: Bad(); break;
   }
  }
  Bad(); return null;
 }
 bool Digit() { return cursor<text.Length&&text[cursor]>='0'&&text[cursor]<='9'; }
 JToken Number() {
  int start=cursor;
  if(cursor<text.Length&&text[cursor]=='-') cursor++;
  if(!Digit()) Bad();
  if(text[cursor]=='0') cursor++;
  else while(Digit()) cursor++;
  bool real=false;
  if(cursor<text.Length&&text[cursor]=='.') { real=true; cursor++; if(!Digit()) Bad(); while(Digit()) cursor++; }
  if(cursor<text.Length&&(text[cursor]=='e'||text[cursor]=='E')) {
   real=true; cursor++; if(cursor<text.Length&&(text[cursor]=='+'||text[cursor]=='-')) cursor++;
   if(!Digit()) Bad(); while(Digit()) cursor++;
  }
  string raw=text.Substring(start,cursor-start);
  if(!real) { long integer; if(long.TryParse(raw,NumberStyles.AllowLeadingSign,CultureInfo.InvariantCulture,out integer)) return new JValue(integer); return new JValue(BigInteger.Parse(raw,CultureInfo.InvariantCulture)); }
  double number;
  if(!double.TryParse(raw,NumberStyles.Float,CultureInfo.InvariantCulture,out number)||double.IsNaN(number)||double.IsInfinity(number)) Bad();
  return new JValue(number);
 }
}
}
