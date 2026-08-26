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
//! für nichts.
//!
//! Ein FileProvider gibt allerdings nur Ordner heraus, die in seiner Liste
//! stehen (`file_paths.xml`). Das erzeugte Android-Projekt führt dort von
//! Haus aus den Zwischenspeicher (`cache-path`) – die Belege und die
//! heruntergeladene APK liegen aber im Datenordner. Statt sich darauf zu
//! verlassen, dass der Build die Liste erweitert hat, legt diese Datei eine
//! Kopie in den Zwischenspeicher und übergibt die. Das kostet einen
//! Kopiervorgang und funktioniert dafür mit der Liste, die ohnehin da ist.

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
mod android {
    use jni::objects::{JObject, JString, JValue};
    use jni::JNIEnv;

    /// Holt die Meldung einer offenen Java-Ausnahme und räumt sie weg.
    ///
    /// Ohne das bliebe von jedem Fehler nur „Java exception was raised" übrig –
    /// und die Ausnahme stünde weiter an, sodass der nächste Aufruf an ihr
    /// stirbt statt an seiner eigenen Ursache.
    pub fn java_error(env: &mut JNIEnv, was: &str) -> String {
        if !env.exception_check().unwrap_or(false) {
            return was.to_string();
        }
        let Ok(ex) = env.exception_occurred() else {
            let _ = env.exception_clear();
            return was.to_string();
        };
        let _ = env.exception_clear();
        // Bewusst Schritt für Schritt: `get_string` leiht sich den JString,
        // in einer Kette lebte der nicht lange genug.
        let Ok(value) = env.call_method(&ex, "toString", "()Ljava/lang/String;", &[]) else {
            return was.to_string();
        };
        let Ok(obj) = value.l() else { return was.to_string() };
        let jstr = JString::from(obj);
        let text = match env.get_string(&jstr) {
            Ok(s) => Some(String::from(s)),
            Err(_) => None,
        };
        match text {
            Some(t) => format!("{was}: {t}"),
            None => was.to_string(),
        }
    }

    /// `context.getCacheDir().getAbsolutePath()`
    pub fn cache_dir(env: &mut JNIEnv, context: &JObject) -> Result<String, String> {
        let dir = env
            .call_method(context, "getCacheDir", "()Ljava/io/File;", &[])
            .map_err(|_| java_error(env, "Zwischenspeicher finden"))?
            .l()
            .map_err(|e| e.to_string())?;
        let path = env
            .call_method(&dir, "getAbsolutePath", "()Ljava/lang/String;", &[])
            .map_err(|_| java_error(env, "Pfad des Zwischenspeichers lesen"))?
            .l()
            .map_err(|e| e.to_string())?;
        Ok(env
            .get_string(&JString::from(path))
            .map_err(|e| e.to_string())?
            .into())
    }

    /// `FileProvider.getUriForFile(context, "<paket>.fileprovider", new File(path))`
    pub fn content_uri<'a>(
        env: &mut JNIEnv<'a>,
        context: &JObject<'a>,
        path: &str,
    ) -> Result<JObject<'a>, String> {
        let jpath = env.new_string(path).map_err(|e| e.to_string())?;
        let file = env
            .new_object(
                "java/io/File",
                "(Ljava/lang/String;)V",
                &[JValue::Object(&jpath)],
            )
            .map_err(|_| java_error(env, "Datei öffnen"))?;

        let package = env
            .call_method(context, "getPackageName", "()Ljava/lang/String;", &[])
            .map_err(|_| java_error(env, "Paketnamen lesen"))?
            .l()
            .map_err(|e| e.to_string())?;
        let package: String = env
            .get_string(&JString::from(package))
            .map_err(|e| e.to_string())?
            .into();
        let authority = env
            .new_string(format!("{package}.fileprovider"))
            .map_err(|e| e.to_string())?;

        match env.call_static_method(
            "androidx/core/content/FileProvider",
            "getUriForFile",
            "(Landroid/content/Context;Ljava/lang/String;Ljava/io/File;)Landroid/net/Uri;",
            &[
                JValue::Object(context),
                JValue::Object(&authority),
                JValue::Object(&file),
            ],
        ) {
            Ok(value) => value.l().map_err(|e| e.to_string()),
            Err(_) => {
                // Fällt der Helfer aus (R8 wirft ihn weg, wenn ihn kein
                // Java-Code aufruft), bauen wir den Verweis selbst. Sein
                // Aufbau ist festgelegt:
                //     content://<paket>.fileprovider/<name des Ordners>/<pfad>
                // `my_cache_images` ist der Name, unter dem das erzeugte
                // Projekt den Zwischenspeicher freigibt – und dorthin haben
                // wir die Datei kopiert.
                let _ = java_error(env, "Helfer nicht verfügbar");
                let rest = path.rsplit_once("/cache/").map(|(_, r)| r).unwrap_or(path);
                fallback_uri(env, &package, rest)
            }
        }
    }

    /// `Uri.parse("content://<paket>.fileprovider/my_cache_images/<pfad>")`
    fn fallback_uri<'a>(
        env: &mut JNIEnv<'a>,
        package: &str,
        relativ: &str,
    ) -> Result<JObject<'a>, String> {
        let text = format!("content://{package}.fileprovider/my_cache_images/{relativ}");
        let jtext = env.new_string(&text).map_err(|e| e.to_string())?;
        env.call_static_method(
            "android/net/Uri",
            "parse",
            "(Ljava/lang/String;)Landroid/net/Uri;",
            &[JValue::Object(&jtext)],
        )
        .map_err(|_| java_error(env, "Verweis auf die Datei erstellen"))?
        .l()
        .map_err(|e| e.to_string())
    }
}

#[cfg(target_os = "android")]
fn open_impl(_app: &tauri::AppHandle, path: &str, mime: &str) -> Result<(), String> {
    use android::{cache_dir, content_uri, java_error};
    use jni::objects::{JObject, JValue};

    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.map_err(|e| e.to_string())?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let context = unsafe { JObject::from_raw(ctx.context().cast()) };

    // Kopie im Zwischenspeicher: Der steht in der Liste des FileProviders,
    // der Datenordner nicht unbedingt. Der Dateiname bleibt erhalten – bei
    // einer APK zeigt der Installer ihn an.
    let quelle = std::path::Path::new(path);
    let name = quelle
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "datei".to_string());
    let ordner = std::path::PathBuf::from(cache_dir(&mut env, &context)?).join("weitergabe");
    std::fs::create_dir_all(&ordner).map_err(|e| format!("Ordner anlegen: {e}"))?;
    let ziel = ordner.join(&name);
    std::fs::copy(quelle, &ziel).map_err(|e| format!("Datei kopieren: {e}"))?;

    let uri = content_uri(&mut env, &context, &ziel.to_string_lossy())?;

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
    .map_err(|_| java_error(&mut env, "Absicht zusammenstellen"))?;

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
    .map_err(|_| java_error(&mut env, "Keine App gefunden, die das öffnen kann"))?;

    Ok(())
}
