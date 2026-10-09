package com.patreontv.personal;

import android.app.Activity;
import android.content.*;
import android.view.inputmethod.InputMethodManager;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.*;
import org.json.JSONObject;
import java.net.URI;

/** Narrow playback bridge and custom TV keyboard remote adapter. No cookie, file, account, or network-reading API is exposed to JavaScript. */
public final class NativeAudioBridge {
    private final Activity activity;
    private final WebView view;
    private final Context context;

    private NativeAudioBridge(Activity a, WebView v) {
        activity = a;
        view = v;
        context = a.getApplicationContext();
    }

    public static void install(Activity activity, WebView view) {
        view.addJavascriptInterface(new NativeAudioBridge(activity, view), "PersonalAudio");
        // Ensure the window allows the native Google TV / Android TV input method (IME) to show.
        activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM);
        try {
            PhoneRemoteServer.start(activity, view);
        } catch (Exception ignored) {}
    }

    /** No-op: Allow native Android WebView to handle remote OK and invoke the native IME. */
    public static boolean dispatchRemoteOk(WebView view, KeyEvent event) {
        return false;
    }

    @JavascriptInterface
    public void showKeyboard() {
        if (activity != null && view != null) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    view.requestFocus();
                    InputMethodManager imm = (InputMethodManager) activity.getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        imm.showSoftInput(view, 0);
                    }
                }
            });
        }
    }

    @JavascriptInterface
    public void moveTaskToBack() {
        if (activity != null) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    activity.moveTaskToBack(true);
                }
            });
        }
    }

    @JavascriptInterface
    public void hideKeyboard() {
        if (activity != null && view != null) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    InputMethodManager imm = (InputMethodManager) activity.getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        imm.hideSoftInputFromWindow(view.getWindowToken(), 0);
                    }
                }
            });
        }
    }

    @JavascriptInterface
    public boolean play(String raw) {
        try {
            if (raw == null || raw.length() > 32000) return false;
            JSONObject j = new JSONObject(raw);
            String url = j.getString("url");
            if (url.startsWith("/api/proxy/")) url = "http://localhost:8474" + url;
            URI uri = new URI(url);
            if (!("https".equals(uri.getScheme()) && uri.getHost() != null || "http".equals(uri.getScheme()) && "localhost".equals(uri.getHost()) && uri.getPort() == 8474) || uri.getUserInfo() != null) return false;
            Intent i = intent("play").putExtra("url", url).putExtra("id", j.getString("id"))
                .putExtra("title", j.optString("title")).putExtra("creator", j.optString("creator"))
                .putExtra("artwork", j.optString("artwork", ""));
            context.startForegroundService(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Intent intent(String action) {
        return new Intent(context, NativeAudioService.class).setAction(action);
    }

    private void send(String action, int delta) {
        try {
            context.startForegroundService(intent(action).putExtra("delta", delta));
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public void toggle() {
        send("toggle", 0);
    }

    @JavascriptInterface
    public void seek(int delta) {
        send("seek", Math.max(-300000, Math.min(300000, delta)));
    }

    @JavascriptInterface
    public void seekTo(int positionMs) {
        try {
            context.startForegroundService(intent("seekTo").putExtra("position", Math.max(0, positionMs)));
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public void stop() {
        send("stop", 0);
    }

    @JavascriptInterface
    public boolean playTrack(String raw) {
        return play(raw);
    }

    @JavascriptInterface
    public void togglePlay() {
        toggle();
    }

    @JavascriptInterface
    public void playVideo(String raw) {
        try {
            if (raw == null) return;
            JSONObject j = new JSONObject(raw);
            String url = j.optString("url", "");
            if (url.startsWith("/api/proxy/")) url = "http://localhost:8474" + url;
            Intent i = intent("play").putExtra("url", url).putExtra("id", j.optString("id", "video"))
                .putExtra("title", j.optString("title", "Vídeo")).putExtra("creator", j.optString("creator", ""))
                .putExtra("artwork", j.optString("artwork", ""));
            context.startForegroundService(i);
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public void previewScreensaver() {
        // Trigger DreamService or show preview notification
        try {
            send("toggle", 0);
        } catch (Exception ignored) {}
    }

    public static String getLastStatus() {
        return NativeAudioService.status();
    }

    @JavascriptInterface
    public String getRemoteInfo() {
        return PhoneRemoteServer.getRemoteInfoJson();
    }

    @JavascriptInterface
    public String status() {
        return NativeAudioService.status();
    }
}
