using System;
using System.IO;
using NUnit.Framework;
using LocalScenes;
using UnityEngine;
using UnityEngine.UIElements;
namespace SmartHome.SceneConsumer.Tests {
 public class LocalSceneViewTests {
  [Test] public void AdvancedDraftFieldEditsSessionWithoutSaving() {
   string dir=Path.Combine(Path.GetTempPath(),"local-view-"+Guid.NewGuid()); Directory.CreateDirectory(dir);
   try {
    var identity=LocalIdentity.Open(Path.Combine(dir,"local.sqlite"));
    var validator=new OfflineSceneValidator(File.ReadAllText(Path.Combine(Application.streamingAssetsPath,"scene.schema.json")));
    using(var store=new LocalSceneStore(Path.Combine(dir,"local.sqlite"),identity.WorkspaceId,identity.ActorId,validator)) {
     var session=new LocalSceneSession(store,validator,File.ReadAllText(Path.Combine(Application.streamingAssetsPath,"two-bedroom.json")));
     session.New("场景"); session.LoadSample(); session.Save();
     var view=new LocalSceneView(store,session,action=>action(),document=>{},()=>{});
     view.Root.Q<TextField>("draft-json").value="{}";
     Assert.That(session.Draft,Is.EqualTo("{}")); Assert.That(session.Dirty,Is.True);
     Assert.That(store.Current(session.DocumentId).Revision,Is.EqualTo(1));
     Assert.That(view.Root.Q<TextField>("current-json").isReadOnly,Is.True);
    }
   } finally { Directory.Delete(dir,true); }
  }
  [Test] public void HistoricalJsonIsReadonlyAndDraftRemainsCurrent() {
   string dir=Path.Combine(Path.GetTempPath(),"history-view-"+Guid.NewGuid()); Directory.CreateDirectory(dir);
   try {
    string path=Path.Combine(dir,"local.sqlite"); var identity=LocalIdentity.Open(path);
    var validator=new OfflineSceneValidator(File.ReadAllText(Path.Combine(Application.streamingAssetsPath,"scene.schema.json")));
    using(var store=new LocalSceneStore(path,identity.WorkspaceId,identity.ActorId,validator)) {
     var session=new LocalSceneSession(store,validator,File.ReadAllText(Path.Combine(Application.streamingAssetsPath,"two-bedroom.json")));
     session.New("场景"); session.LoadSample(); session.Save(); session.SetDraft(session.Draft+" "); session.Save();
     string draft=session.Draft; session.ViewHistory(1);
     var view=new LocalSceneView(store,session,action=>action(),document=>{},()=>{});
     Assert.That(view.Root.Q<TextField>("history-json").isReadOnly,Is.True);
     Assert.That(view.Root.Q<TextField>("history-json").value,Is.EqualTo(session.HistoryJson));
     Assert.That(session.Draft,Is.EqualTo(draft)); Assert.That(session.BaseRevision,Is.EqualTo(2));
    }
   } finally { Directory.Delete(dir,true); }
  }
 }
}
