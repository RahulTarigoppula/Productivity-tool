package com.rahul.productivity

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.webkit.WebView
import androidx.activity.result.ActivityResult
import androidx.appcompat.app.AppCompatActivity
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class PickArgs {
  var multiple: Boolean = false
  var mimeTypes: Array<String>? = null
}

@InvokeArg
class CreateArgs {
  var fileName: String = "Untitled.txt"
  var mimeType: String? = null
}

@InvokeArg
class UriArgs {
  lateinit var uri: String
}

/**
 * Documents through Android's own document picker (the Storage Access Framework).
 * Files picked here stay readable and writable after the app restarts (persisted permission),
 * so recent files and saving back work. Files shared with the app from other apps
 * ("Open with") are collected and handed to the interface when it asks.
 */
@TauriPlugin
class DocumentsPlugin(private val activity: Activity) : Plugin(activity) {
  private val opened = mutableListOf<String>()

  // Only one system picker at a time: Android keeps a single result callback, so a second picker
  // would leave the first request waiting forever. Our activity resumes only after a picker closes.
  @Volatile private var pickerOpen = false

  override fun onResume(activity: AppCompatActivity) {
    pickerOpen = false
  }

  override fun load(webView: WebView) {
    // Test builds in CI start the app with this flag to run its self-test (see tests/android-smoke.sh).
    if (activity.intent?.getBooleanExtra("productivity.selftest", false) == true) {
      // Tauri's app data folder on Android is the app's data folder itself.
      val dir = File(activity.dataDir, "selftest").apply { mkdirs() }
      File(dir, "RUN").writeText("1")
    }
    collect(activity.intent)
  }

  override fun onNewIntent(intent: Intent) {
    collect(intent)
  }

  private fun collect(intent: Intent?) {
    if (intent == null) return
    if (intent.action != Intent.ACTION_VIEW && intent.action != Intent.ACTION_EDIT && intent.action != Intent.ACTION_SEND) return
    val uri: Uri? = if (intent.action == Intent.ACTION_SEND) {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(Intent.EXTRA_STREAM)
    } else intent.data
    if (uri == null && intent.action == Intent.ACTION_SEND) {
      // Text shared from another app (no file): keep it as a new note in the app's own storage.
      val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
      if (text.length > 5_000_000) return
      val dir = File(activity.filesDir, "shared").apply { mkdirs() }
      val stamp = SimpleDateFormat("yyyy-MM-dd HH.mm.ss", Locale.US).format(Date())
      val f = File(dir, "Shared text $stamp.md")
      f.writeText(text)
      synchronized(opened) { opened.add(f.absolutePath) }
      intent.action = Intent.ACTION_MAIN
      return
    }
    if (uri == null || uri.scheme != "content") return
    // Never act on this app's own files on another app's behalf.
    if (uri.authority?.startsWith(activity.packageName) == true) return
    val s = uri.toString()
    synchronized(opened) { if (!opened.contains(s)) opened.add(s) }
    // Handled: do not hand the same file over again when the activity is recreated.
    intent.action = Intent.ACTION_MAIN
  }

  @Command
  fun pick(invoke: Invoke) {
    if (pickerOpen) return invoke.reject("A file picker is already open.")
    pickerOpen = true
    val args = invoke.parseArgs(PickArgs::class.java)
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
      args.mimeTypes?.takeIf { it.isNotEmpty() }?.let { putExtra(Intent.EXTRA_MIME_TYPES, it) }
      putExtra(Intent.EXTRA_ALLOW_MULTIPLE, args.multiple)
      addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
      )
    }
    startActivityForResult(invoke, intent, "pickResult")
  }

  @ActivityCallback
  fun pickResult(invoke: Invoke, result: ActivityResult) {
    pickerOpen = false
    val files = JSArray()
    val data = result.data
    if (result.resultCode == Activity.RESULT_OK && data != null) {
      val uris = mutableListOf<Uri>()
      val clip = data.clipData
      if (clip != null) for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri)
      else data.data?.let { uris.add(it) }
      for (u in uris) {
        persist(u)
        files.put(describe(u))
      }
    }
    val ret = JSObject()
    ret.put("files", files)
    invoke.resolve(ret)
  }

  @Command
  fun create(invoke: Invoke) {
    if (pickerOpen) return invoke.reject("A file picker is already open.")
    pickerOpen = true
    val args = invoke.parseArgs(CreateArgs::class.java)
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = args.mimeType ?: "application/octet-stream"
      putExtra(Intent.EXTRA_TITLE, args.fileName)
      addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
      )
    }
    startActivityForResult(invoke, intent, "createResult")
  }

  @ActivityCallback
  fun createResult(invoke: Invoke, result: ActivityResult) {
    pickerOpen = false
    val ret = JSObject()
    val u = result.data?.data
    if (result.resultCode == Activity.RESULT_OK && u != null) {
      persist(u)
      ret.put("file", describe(u))
    }
    invoke.resolve(ret)
  }

  @Command
  fun info(invoke: Invoke) {
    val args = invoke.parseArgs(UriArgs::class.java)
    invoke.resolve(describe(Uri.parse(args.uri)))
  }

  /** Files other apps asked this app to open since the last call. */
  @Command
  fun takeOpened(invoke: Invoke) {
    val files = JSArray()
    val list = synchronized(opened) { val l = opened.toList(); opened.clear(); l }
    for (s in list) {
      if (s.startsWith("/")) {
        // A note made from shared text, in the app's own storage.
        val f = File(s)
        val o = JSObject()
        o.put("uri", s); o.put("name", f.name); o.put("size", f.length()); o.put("modified", f.lastModified()); o.put("writable", true)
        files.put(o)
      } else files.put(describe(Uri.parse(s)))
    }
    val ret = JSObject()
    ret.put("files", files)
    invoke.resolve(ret)
  }

  private fun persist(u: Uri) {
    val resolver = activity.contentResolver
    try {
      resolver.takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    } catch (e: Exception) {
      try {
        resolver.takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      } catch (_: Exception) {
        // Not persistable (for example a file shared once by another app): usable for this session.
      }
    }
  }

  private fun describe(u: Uri): JSObject {
    val o = JSObject()
    o.put("uri", u.toString())
    var name: String? = null
    var size = -1L
    var modified = 0L
    var writable = false
    try {
      activity.contentResolver.query(u, null, null, null, null)?.use { c ->
        if (c.moveToFirst()) {
          val n = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          if (n >= 0 && !c.isNull(n)) name = c.getString(n)
          val s = c.getColumnIndex(OpenableColumns.SIZE)
          if (s >= 0 && !c.isNull(s)) size = c.getLong(s)
          val m = c.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
          if (m >= 0 && !c.isNull(m)) modified = c.getLong(m)
          val f = c.getColumnIndex(DocumentsContract.Document.COLUMN_FLAGS)
          if (f >= 0 && !c.isNull(f)) writable = (c.getInt(f) and DocumentsContract.Document.FLAG_SUPPORTS_WRITE) != 0
        }
      }
    } catch (_: Exception) {
      // The provider refused or the permission lapsed; report what is known.
    }
    // A file shared for viewing may be read-only for this app even if its provider supports writing.
    if (activity.checkCallingOrSelfUriPermission(u, Intent.FLAG_GRANT_WRITE_URI_PERMISSION) != PackageManager.PERMISSION_GRANTED) writable = false
    o.put("name", name ?: (u.lastPathSegment ?: "Document"))
    o.put("size", size)
    o.put("modified", modified)
    o.put("writable", writable)
    return o
  }
}
