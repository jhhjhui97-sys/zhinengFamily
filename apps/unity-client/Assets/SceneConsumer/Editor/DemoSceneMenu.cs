using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
namespace SmartHome.SceneConsumer
{
    public static class DemoSceneMenu
    {
        [MenuItem("SceneConsumer/Create Demo Scene")]
        public static void Create() {
            if(!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            new GameObject("SceneModel demo").AddComponent<DemoBootstrap>();
            Directory.CreateDirectory("Assets/Scenes"); const string path="Assets/Scenes/SceneModelDemo.unity";
            EditorSceneManager.SaveScene(scene,path);
            var scenes=new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            if(!scenes.Exists(item=>item.path==path)) scenes.Add(new EditorBuildSettingsScene(path,true));
            EditorBuildSettings.scenes=scenes.ToArray(); AssetDatabase.Refresh();
        }
    }
}
