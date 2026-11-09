# HANDOFF — Creator TV (Patreon TV Personal) · actualizado 2026-11-08

## Estado real
- Dispositivo: Chromecast HD (Android 14) en `<tv-ip>` — ADB inalámbrico, el puerto cambia (ver *Depuración inalámbrica* en la tele). Ya está vinculado con este PC.
- Instalado: **4.2** (`versionCode 27`, nombre «Creator TV»). Punto de restauración: `backups/device/installed-4.1.apk` (sha256 `2d2c41f4…`) + tag git `restore-2026-11-08`.
- Rama de trabajo: `improve/integral-2026-11`.

## Cómo compilar e instalar (reproducible)
```bash
bash integrated/repack.sh <versionCode> <versionName>     # p.ej. 17 4.2-rc4
adb connect <tv-ip>:<puerto>
adb -s <tv-ip>:<puerto> install -r integrated/output/CreatorTV-<versionName>.apk   # -r conserva la sesión
```
`repack.sh` parte de la APK 4.1 instalada (smali/res intactos), sustituye `assets/www` (build de `v0-vvvv`) y `classes4.dex` (Java de `integrated/src/java`). Misma firma debug → actualiza sin desinstalar.
Pruebas: `cd v0-vvvv && npm test` (nav + capítulos + ProseMirror: 14; DOM/layout: 59, usa Chrome instalado).

## Arquitectura (corta)
- `v0-vvvv/` React 19 + Vite + Tailwind + Motion → WebView local `127.0.0.1:8474` (NanoHTTPD del APK base).
- Java propio (`integrated/src/java/com/patreontv/personal`): `NativeAudioService` (MediaPlayer + MediaSession + FGS), `NativeAudioBridge` (`window.PersonalAudio`), `CatalogExtension` (hooks del catálogo), `PhoneRemoteServer` (:8475, control desde el móvil), `NowPlayingDreamService`.
- Smali original: `PatreonApi.getPosts()` llama a `CatalogExtension.posts/enrich`.

## Hallazgos clave (no repetir investigación)
1. **Cuerpo de posts**: la lista de Patreon devuelve `content=null`; el endpoint `/api/posts/{id}` también, el cuerpo real está en **`content_json_string`** (ProseMirror). Se pide bajo demanda: `PersonalAudio.postBody(id)` → `window.__ctvPostBody(json)`; el frontend convierte ProseMirror→HTML (`integration/post-body.ts`).
2. **Audio en segundo plano**: con HOME, BACK y salvapantallas sigue sonando (verificado). En **standby** Google TV (`com.google.android.katniss`) pausa la sesión y la vuelve a pausar cada vez que se reanuda; con HDMI apagado no hay salida → se respeta (no pelear).
3. **Salvapantallas**: la Activity base ponía `FLAG_KEEP_SCREEN_ON` siempre. Ahora se limpia y solo se activa mientras un vídeo reproduce (`setKeepAwake`).
4. **AirPods/auriculares**: el WebView no crea MediaSession; el botón llega como tecla. PLAY_PAUSE alterna; PLAY/PAUSE (126/127) se respetan por separado.
5. **Login/BACK**: BACK en Creadores hacía logout inmediato → ahora sale de la app; cerrar sesión pide confirmación con foco en *Cancelar*.

## Funciones verificadas en la tele (capturas en scratch, no en repo)
Intro con logo que se forma sin parpadeo de Login · foco inicial en contenido · Publicaciones con cuerpo completo (negritas, párrafos) y scroll con mando · vídeo: portada hasta primer fotograma, reanudación, línea de tiempo Expressive, 14 capítulos detectados, menú ⚙ (capítulos/atenuar/oscurecer), PLAY_PAUSE · coverflow tipo álbum · pantalla no retenida fuera de vídeo.

## Pendiente / no verificado
- Atenuación automática (45 s / 4 min en pausa) y selección de capítulo con OK: implementado, sin verificar en tele.
- Confirmar que el salvapantallas entra tras el tiempo configurado (solo se verificó que la app ya no retiene la pantalla).
- Sonidos de UI: implementados (WebAudio), no se puede verificar audibilidad por ADB.
- Paginación: solo primera página (20 posts) por creador.
- Diálogo de cerrar sesión, lector con imágenes/enlaces y estado bloqueado: implementados, sin caso real probado.
- Cast Connect: no necesario (control desde el móvil vía PhoneRemoteServer y MediaSession del audio).

## «Reproduciendo» en el panel de Google TV / salvapantallas (investigado 2026-11-08, no repetir)
- La sesión de audio es correcta (activa, PLAYING, flags=3, sessionActivity, metadatos, igual que Spotify) y `mediashell` (Cast) la lee.
- REA de `com.google.android.apps.tv.launcherx` (`coreservices/nowplaying/NowPlayingListener`, filtro `gdj` caso 9 + tabla `glm.a`): el launcher solo muestra la tarjeta «now playing» si el **SHA-256 del package** está en una lista fija de 1000 apps socias. Comprobado: Spotify/Amazon Music/YouTube Music sí; Creator TV, Netflix, YouTube, Jellyfin, SmartTube, Plex no.
- Conclusión: imposible sin suplantar el package de otra app (descartado). Alternativas: `NowPlayingDreamService` propio y el control desde el móvil (PhoneRemoteServer :8475).
