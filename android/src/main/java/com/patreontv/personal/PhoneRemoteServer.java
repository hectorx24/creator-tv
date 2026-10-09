package com.patreontv.personal;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.webkit.WebView;
import org.json.JSONObject;

import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Secure local Wi-Fi phone remote server with PIN pairing.
 * Runs on port 8475 and allows controlling playback and D-pad navigation from any phone browser on the same Wi-Fi.
 */
public final class PhoneRemoteServer {
    public static final int PORT = 8475;
    private static volatile PhoneRemoteServer instance;
    private final Activity activity;
    private final WebView webView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private ServerSocket serverSocket;
    private volatile boolean running = false;
    private final String currentPin;
    private final Set<String> validTokens = Collections.newSetFromMap(new ConcurrentHashMap<String, Boolean>());
    private final Map<String, Integer> failedAttempts = new ConcurrentHashMap<>();

    private PhoneRemoteServer(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;

        SharedPreferences prefs = activity.getSharedPreferences("personal_remote", Context.MODE_PRIVATE);
        String pin = prefs.getString("pin", null);
        if (pin == null || pin.length() != 4) {
            pin = String.format(Locale.US, "%04d", new Random().nextInt(10000));
            prefs.edit().putString("pin", pin).apply();
        }
        this.currentPin = pin;
    }

    public static synchronized void start(Activity activity, WebView webView) {
        if (instance == null) {
            instance = new PhoneRemoteServer(activity, webView);
            instance.startServer();
        }
    }

    public static String getPin() {
        return instance != null ? instance.currentPin : "8472";
    }

    public static String getLocalIpAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface iface = interfaces.nextElement();
                if (iface.isLoopback() || !iface.isUp()) continue;
                Enumeration<InetAddress> addresses = iface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception ignored) {}
        return "127.0.0.1";
    }

    public static String getRemoteInfoJson() {
        try {
            JSONObject obj = new JSONObject();
            obj.put("enabled", instance != null && instance.running);
            obj.put("ip", getLocalIpAddress());
            obj.put("port", PORT);
            obj.put("pin", getPin());
            obj.put("url", "http://" + getLocalIpAddress() + ":" + PORT);
            return obj.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    private void startServer() {
        if (running) return;
        running = true;
        executor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    serverSocket = new ServerSocket(PORT, 50, InetAddress.getByName("0.0.0.0"));
                    while (running && !serverSocket.isClosed()) {
                        try {
                            final Socket client = serverSocket.accept();
                            executor.execute(new Runnable() {
                                @Override
                                public void run() {
                                    handleClient(client);
                                }
                            });
                        } catch (SocketException se) {
                            break;
                        } catch (Exception ignored) {}
                    }
                } catch (Exception ignored) {
                } finally {
                    running = false;
                }
            }
        });
    }

    private void handleClient(Socket socket) {
        try {
            socket.setSoTimeout(5000);
            InputStream is = socket.getInputStream();
            OutputStream os = socket.getOutputStream();
            BufferedReader reader = new BufferedReader(new InputStreamReader(is, "UTF-8"));

            String requestLine = reader.readLine();
            if (requestLine == null) {
                socket.close();
                return;
            }

            String[] parts = requestLine.split(" ");
            if (parts.length < 2) {
                socket.close();
                return;
            }

            String method = parts[0];
            String pathWithQuery = parts[1];
            String path = pathWithQuery;
            String query = "";
            int qIndex = pathWithQuery.indexOf('?');
            if (qIndex != -1) {
                path = pathWithQuery.substring(0, qIndex);
                query = pathWithQuery.substring(qIndex + 1);
            }

            Map<String, String> headers = new HashMap<>();
            String line;
            int contentLength = 0;
            String cookieHeader = "";
            while ((line = reader.readLine()) != null && !line.isEmpty()) {
                int colon = line.indexOf(':');
                if (colon != -1) {
                    String name = line.substring(0, colon).trim().toLowerCase(Locale.US);
                    String val = line.substring(colon + 1).trim();
                    headers.put(name, val);
                    if ("content-length".equals(name)) {
                        try { contentLength = Integer.parseInt(val); } catch (Exception ignored) {}
                    } else if ("cookie".equals(name)) {
                        cookieHeader = val;
                    }
                }
            }

            String requestBody = "";
            if (contentLength > 0 && contentLength < 65536) {
                char[] buf = new char[contentLength];
                int read = 0;
                while (read < contentLength) {
                    int r = reader.read(buf, read, contentLength - read);
                    if (r == -1) break;
                    read += r;
                }
                requestBody = new String(buf, 0, read);
            }

            String clientIp = socket.getInetAddress().getHostAddress();
            String sessionToken = extractToken(cookieHeader, headers);

            if ("/".equals(path) || "/remote".equals(path)) {
                serveHtml(os, sessionToken != null && validTokens.contains(sessionToken));
            } else if ("/api/pair".equals(path)) {
                handlePair(os, clientIp, requestBody);
            } else if ("/api/status".equals(path)) {
                handleStatus(os, sessionToken);
            } else if ("/api/control".equals(path)) {
                handleControl(os, sessionToken, requestBody);
            } else {
                sendResponse(os, 404, "text/plain", "Not Found", null);
            }

            os.flush();
            socket.close();
        } catch (Exception ignored) {
            try { socket.close(); } catch (Exception ignored2) {}
        }
    }

    private String extractToken(String cookieHeader, Map<String, String> headers) {
        String auth = headers.get("x-auth-token");
        if (auth != null && !auth.isEmpty()) return auth;
        if (cookieHeader != null) {
            for (String pair : cookieHeader.split(";")) {
                String[] kv = pair.trim().split("=");
                if (kv.length == 2 && "remote_token".equals(kv[0].trim())) {
                    return kv[1].trim();
                }
            }
        }
        return null;
    }

    private void handlePair(OutputStream os, String clientIp, String body) throws IOException {
        int failed = failedAttempts.containsKey(clientIp) ? failedAttempts.get(clientIp) : 0;
        if (failed >= 10) {
            sendResponse(os, 429, "application/json", "{\"error\":\"Demasiados intentos fallidos. Espera un momento.\"}", null);
            return;
        }

        String inputPin = "";
        try {
            if (body.startsWith("{")) {
                JSONObject j = new JSONObject(body);
                inputPin = j.optString("pin", "");
            } else {
                for (String part : body.split("&")) {
                    String[] kv = part.split("=");
                    if (kv.length == 2 && "pin".equals(kv[0])) {
                        inputPin = URLDecoder.decode(kv[1], "UTF-8");
                    }
                }
            }
        } catch (Exception ignored) {}

        if (currentPin.equals(inputPin.trim())) {
            failedAttempts.remove(clientIp);
            String token = UUID.randomUUID().toString();
            validTokens.add(token);
            String cookie = "remote_token=" + token + "; Path=/; Max-Age=86400; SameSite=Lax";
            sendResponse(os, 200, "application/json", "{\"success\":true,\"token\":\"" + token + "\"}", cookie);
        } else {
            failedAttempts.put(clientIp, failed + 1);
            sendResponse(os, 401, "application/json", "{\"success\":false,\"error\":\"PIN incorrecto. Revisa la pantalla de la TV.\"}", null);
        }
    }

    private void handleStatus(OutputStream os, String sessionToken) throws IOException {
        if (sessionToken == null || !validTokens.contains(sessionToken)) {
            sendResponse(os, 401, "application/json", "{\"error\":\"No emparejado\"}", null);
            return;
        }
        String statusJson = NativeAudioService.status();
        sendResponse(os, 200, "application/json", statusJson, null);
    }

    private void handleControl(OutputStream os, String sessionToken, String body) throws IOException {
        if (sessionToken == null || !validTokens.contains(sessionToken)) {
            sendResponse(os, 401, "application/json", "{\"error\":\"No emparejado\"}", null);
            return;
        }

        try {
            JSONObject j = new JSONObject(body);
            String action = j.optString("action", "");

            if ("toggle".equals(action)) {
                sendServiceIntent("toggle", 0);
            } else if ("play".equals(action)) {
                sendServiceIntent("toggle", 0);
            } else if ("pause".equals(action)) {
                sendServiceIntent("toggle", 0);
            } else if ("seek".equals(action)) {
                int delta = j.optInt("delta", 0);
                sendServiceIntent("seek", delta);
            } else if ("seekTo".equals(action)) {
                int pos = j.optInt("position", 0);
                Intent i = new Intent(activity, NativeAudioService.class).setAction("seekTo").putExtra("position", pos);
                activity.startForegroundService(i);
            } else if ("stop".equals(action)) {
                sendServiceIntent("stop", 0);
            } else if ("key".equals(action)) {
                final int keyCode = j.optInt("keyCode", 0);
                if (keyCode > 0) {
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                activity.dispatchKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, keyCode));
                                activity.dispatchKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, keyCode));
                            } catch (Exception ignored) {}
                        }
                    });
                }
            }
            sendResponse(os, 200, "application/json", "{\"success\":true}", null);
        } catch (Exception e) {
            sendResponse(os, 400, "application/json", "{\"error\":\"Comando inválido\"}", null);
        }
    }

    private void sendServiceIntent(String action, int delta) {
        try {
            Intent i = new Intent(activity, NativeAudioService.class).setAction(action).putExtra("delta", delta);
            activity.startForegroundService(i);
        } catch (Exception ignored) {}
    }

    private void sendResponse(OutputStream os, int code, String mime, String content, String setCookie) throws IOException {
        byte[] bytes = content.getBytes("UTF-8");
        PrintWriter pw = new PrintWriter(new OutputStreamWriter(os, "UTF-8"));
        pw.print("HTTP/1.1 " + code + " " + (code == 200 ? "OK" : (code == 401 ? "Unauthorized" : "Error")) + "\r\n");
        pw.print("Content-Type: " + mime + "; charset=utf-8\r\n");
        pw.print("Content-Length: " + bytes.length + "\r\n");
        pw.print("Connection: close\r\n");
        if (setCookie != null) {
            pw.print("Set-Cookie: " + setCookie + "\r\n");
        }
        pw.print("\r\n");
        pw.flush();
        os.write(bytes);
        os.flush();
    }

    private void serveHtml(OutputStream os, boolean isAuth) throws IOException {
        String html = "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,user-scalable=no\">"
            + "<title>Patreon TV · Control Remoto</title><style>"
            + "*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif}"
            + "body{background:#0e0e11;color:#f6f3f2;display:flex;flex-direction:column;min-height:100vh;align-items:center;padding:16px}"
            + ".header{width:100%;max-width:400px;display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #232228}"
            + ".badge{font-size:12px;font-weight:700;color:#ec7969;text-transform:uppercase;letter-spacing:1px}"
            + ".card{width:100%;max-width:400px;background:#18171c;border-radius:20px;padding:20px;margin-top:16px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.5)}"
            + ".pin-input{width:160px;height:52px;font-size:28px;text-align:center;letter-spacing:8px;border-radius:12px;border:2px solid #36343f;background:#100f13;color:#fff;margin:16px auto;display:block}"
            + ".btn{background:#ec7969;color:#fff;border:none;padding:14px 28px;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;width:100%;transition:all .15s}"
            + ".btn:active{transform:scale(0.97);opacity:0.9}"
            + ".now-playing{display:flex;gap:14px;align-items:center;text-align:left;margin-bottom:16px}"
            + ".art{width:64px;height:64px;border-radius:12px;background:#2b2933;object-fit:cover;flex-shrink:0}"
            + ".title{font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
            + ".creator{font-size:13px;color:#a5a0a1;margin-top:2px}"
            + ".dpad{display:grid;grid-template-columns:repeat(3,72px);grid-template-rows:repeat(3,72px);gap:10px;justify-content:center;margin:24px 0}"
            + ".dpad-btn{background:#23222a;color:#f6f3f2;border:none;border-radius:16px;font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent}"
            + ".dpad-btn:active{background:#ec7969;color:#fff}"
            + ".dpad-ok{background:#363342;font-weight:700;font-size:15px}"
            + ".transport{display:flex;gap:12px;justify-content:center;align-items:center;margin-top:10px}"
            + ".trans-btn{background:#23222a;color:#f6f3f2;border:none;width:56px;height:56px;border-radius:28px;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer}"
            + ".trans-large{width:68px;height:68px;border-radius:34px;background:#ec7969;color:#fff;font-size:24px}"
            + ".progress-bar{height:6px;background:#2a2833;border-radius:3px;overflow:hidden;margin:12px 0}"
            + ".fill{height:100%;background:#ec7969;width:0%;transition:width .3s}"
            + "</style></head><body>"
            + "<div class=\"header\"><div><strong>Patreon TV</strong></div><div class=\"badge\">Móvil Wi-Fi</div></div>"
            + "<div id=\"pairScreen\" class=\"card\" style=\"display:" + (isAuth ? "none" : "block") + "\">"
            + "<h3>Vincular con tu TV</h3><p style=\"color:#a5a0a1;font-size:14px;margin-top:6px\">Ingresa el código PIN de 4 dígitos mostrado en tu pantalla:</p>"
            + "<input id=\"pinCode\" class=\"pin-input\" type=\"text\" maxlength=\"4\" inputmode=\"numeric\" placeholder=\"••••\">"
            + "<button class=\"btn\" onclick=\"pair()\">Conectar</button><div id=\"pairErr\" style=\"color:#ec7969;margin-top:10px;font-size:13px\"></div>"
            + "</div>"
            + "<div id=\"remoteScreen\" class=\"card\" style=\"display:" + (isAuth ? "block" : "none") + "\">"
            + "<div class=\"now-playing\"><img id=\"artImg\" class=\"art\" src=\"\"><div style=\"overflow:hidden\"><div id=\"trackTitle\" class=\"title\">Sin reproducción</div><div id=\"trackCreator\" class=\"creator\">Patreon TV</div></div></div>"
            + "<div class=\"progress-bar\"><div id=\"fill\" class=\"fill\"></div></div>"
            + "<div class=\"transport\">"
            + "<button class=\"trans-btn\" onclick=\"cmd('seek',-10000)\">−10s</button>"
            + "<button id=\"playBtn\" class=\"trans-btn trans-large\" onclick=\"cmd('toggle')\">▶</button>"
            + "<button class=\"trans-btn\" onclick=\"cmd('seek',30000)\">+30s</button>"
            + "</div>"
            + "<div class=\"dpad\">"
            + "<div></div><button class=\"dpad-btn\" onclick=\"key(19)\">▲</button><div></div>"
            + "<button class=\"dpad-btn\" onclick=\"key(21)\">◀</button><button class=\"dpad-btn dpad-ok\" onclick=\"key(23)\">OK</button><button class=\"dpad-btn\" onclick=\"key(22)\">▶</button>"
            + "<div></div><button class=\"dpad-btn\" onclick=\"key(20)\">▼</button><button class=\"dpad-btn\" onclick=\"key(4)\" title=\"Volver\">↩</button>"
            + "</div>"
            + "</div>"
            + "<script>"
            + "let timer=null;async function pair(){const pin=document.getElementById('pinCode').value;const res=await fetch('/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});const d=await res.json();if(d.success){document.getElementById('pairScreen').style.display='none';document.getElementById('remoteScreen').style.display='block';startPoll();}else{document.getElementById('pairErr').innerText=d.error||'Error';}}"
            + "async function cmd(action,val){await fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,delta:val})});update();}"
            + "async function key(keyCode){await fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'key',keyCode})});}"
            + "async function update(){try{const res=await fetch('/api/status');if(res.status===401){document.getElementById('remoteScreen').style.display='none';document.getElementById('pairScreen').style.display='block';return;}const s=await res.json();document.getElementById('trackTitle').innerText=s.title||'Patreon TV';document.getElementById('trackCreator').innerText=s.creator||'Modo TV';document.getElementById('playBtn').innerText=s.playing?'❚❚':'▶';if(s.artwork){document.getElementById('artImg').src=s.artwork;document.getElementById('artImg').style.display='block';}else{document.getElementById('artImg').style.display='none';}if(s.duration>0){document.getElementById('fill').style.width=((s.position/s.duration)*100)+'%';}else{document.getElementById('fill').style.width='0%';}}catch(e){}}"
            + "function startPoll(){update();if(timer)clearInterval(timer);timer=setInterval(update,1500);}"
            + (isAuth ? "startPoll();" : "")
            + "</script></body></html>";

        sendResponse(os, 200, "text/html", html, null);
    }
}
