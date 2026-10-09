# Creator TV — Android Native Layer

This directory contains the original Android native Java components powering **Creator TV** on Google TV and Android TV devices.

## Native Components Overview

1. **`NativeAudioBridge.java`**
   - Implements the `@JavascriptInterface` bridge bound to `window.PersonalAudio`.
   - Manages communication between the web frontend and Android's native audio pipeline.
   - **Custom TV Keyboard Adapter & IME Suppression:** Implements `dispatchRemoteOk()` and configures `WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM` to suppress Android's system soft-keyboard ("type from phone" overlay) on TV input fields while cleanly forwarding remote `OK` (`KEYCODE_DPAD_CENTER`, `KEYCODE_ENTER`) to the custom on-screen TV keyboard.

2. **`NativeAudioService.java`**
   - Android `Service` handling robust background playback using `MediaPlayer` and `MediaSessionCompat`.
   - Retains audio playback even when users navigate out of the full player or browse other sections.
   - Handles audio focus changes (ducking/pausing) when other system sounds occur.

3. **`PhoneRemoteServer.java`**
   - Lightweight embedded local server providing a companion phone remote control web interface.
   - Allows users to control navigation, playback, and text entry from any smartphone connected to the same Wi-Fi network.

4. **`CatalogExtension.java`**
   - Handles JSON serialization, feed normalization, taxonomy classification (video, audio, text), and pagination cursor handling for creator media feeds.

5. **`NowPlayingDreamService.java`**
   - Android TV Daydream (screensaver) service that displays artwork, title, and playback status for background-playing audio when the TV enters ambient mode.

## Security & Privacy Note
No user credentials, auth tokens, session cookies, or proprietary signing keys are stored in this repository. All sensitive configuration is injected via local build environment variables.
