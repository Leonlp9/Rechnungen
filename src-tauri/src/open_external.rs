//! Eine Datei an eine andere App übergeben.
//!
//! Auf dem Desktop macht das der Opener von Tauri: Er kennt den Standard-
//! Öffner des Systems und ruft ihn mit dem Pfad auf.
//!
//! Auf Android geht das nicht. Dort darf eine App keinen Dateipfad aus ihrem
//! eigenen Ordner weiterreichen – seit Android 7 wirft das System dabei eine
//! Ausnahme, und die empfangende App dürfte den Ordner ohnehin nicht lesen.
//! Der vorgesehene Weg ist ein `content://`-Verweis über einen FileProvider:
//! Damit bekommt die andere App genau für diese eine Datei Leserecht, sonst
//! für nichts. Der Provider steckt schon im erzeugten Android-Projekt
//! (`${applicationId}.fileprovider`); welche Ordner er herausgeben darf,
//! trägt der Build in `file_paths.xml` nach.
//!
//! Genau das erledigt diese Datei – für die PDF eines Belegs ebenso wie für
//! die heruntergeladene APK, die an den Paket-Installer geht.

/// Übergibt `path` an die zuständige App. `mime` sagt dem System, welche das
/// ist – etwa `application/pdf` oder `application/vnd.android.package-archive`.
#[tauri::command]
pub fn open_file_external(app: tauri::AppHandle, path: String, mime: String) -> Result<(), String> {
    open_impl(&app, &path, &mime)
}

#[cfg(not(target_os = "android"))]
fn open_impl(app: &tauri::AppHandle, path: &str, _mime: &str) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(path.to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "android")]
fn open_impl(_app: &tauri::AppHandle, path: &str, mime: &str) -> Result<(), String> {
    use jni::objects::{JObject, JString, JValue};

    /// Bricht ab, sobald auf Java-Seite eine Ausnahme offen steht. Ohne das
    /// bliebe sie hängen und der nächste JNI-Aufruf stürbe an ihr statt an
    /// der eigentlichen Ursache.
    fn check(env: &mut jni::JNIEnv, was: &str) -> Result<(), String> {
        if env.exception_check().unwrap_or(false) {
            let _ = env.exception_describe();
            let _ = env.exception_clear();
            return Err(format!("{was} fehlgeschlagen"));
        }
        Ok(())
    }

    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.map_err(|e| e.to_string())?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let context = unsafe { JObject::from_raw(ctx.context().cast()) };

    // new File(path)
    let jpath = env.new_string(path).map_err(|e| e.to_string())?;
    let file = env
        .new_object(
            "java/io/File",
            "(Ljava/lang/String;)V",
            &[JValue::Object(&jpath)],
        )
        .map_err(|e| e.to_string())?;
    check(&mut env, "Datei öffnen")?;

    // Die Autorität des Providers heißt wie das Paket plus „.fileprovider" –
    // so legt das erzeugte Android-Projekt sie an.
    let package = env
        .call_method(&context, "getPackageName", "()Ljava/lang/String;", &[])
        .map_err(|e| e.to_string())?
        .l()
        .map_err(|e| e.to_string())?;
    let package: String = env
        .get_string(&JString::from(package))
        .map_err(|e| e.to_string())?
        .into();
    let authority = env
        .new_string(format!("{package}.fileprovider"))
        .map_err(|e| e.to_string())?;

    // FileProvider.getUriForFile(context, authority, file)
    let uri = env
        .call_static_method(
            "androidx/core/content/FileProvider",
            "getUriForFile",
            "(Landroid/content/Context;Ljava/lang/String;Ljava/io/File;)Landroid/net/Uri;",
            &[
                JValue::Object(&context),
                JValue::Object(&authority),
                JValue::Object(&file),
            ],
        )
        .map_err(|e| e.to_string())?
        .l()
        .map_err(|e| e.to_string())?;
    check(&mut env, "Verweis auf die Datei erstellen")?;

    // new Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime)
    let action = env
        .new_string("android.intent.action.VIEW")
        .map_err(|e| e.to_string())?;
    let intent = env
        .new_object(
            "android/content/Intent",
            "(Ljava/lang/String;)V",
            &[JValue::Object(&action)],
        )
        .map_err(|e| e.to_string())?;
    let jmime = env.new_string(mime).map_err(|e| e.to_string())?;
    env.call_method(
        &intent,
        "setDataAndType",
        "(Landroid/net/Uri;Ljava/lang/String;)Landroid/content/Intent;",
        &[JValue::Object(&uri), JValue::Object(&jmime)],
    )
    .map_err(|e| e.to_string())?;

    // FLAG_GRANT_READ_URI_PERMISSION (1): Leserecht nur für diesen Verweis.
    // FLAG_ACTIVITY_NEW_TASK (0x10000000): Pflicht, weil der Aufruf nicht aus
    // einer Activity heraus kommt.
    for flag in [1i32, 0x1000_0000] {
        env.call_method(
            &intent,
            "addFlags",
            "(I)Landroid/content/Intent;",
            &[JValue::Int(flag)],
        )
        .map_err(|e| e.to_string())?;
    }

    env.call_method(
        &context,
        "startActivity",
        "(Landroid/content/Intent;)V",
        &[JValue::Object(&intent)],
    )
    .map_err(|e| e.to_string())?;
    check(&mut env, "App zum Öffnen finden")?;

    Ok(())
}
