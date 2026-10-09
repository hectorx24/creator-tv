package com.patreontv.personal;

import android.app.*;
import android.content.*;
import android.media.*;
import android.media.session.*;
import android.os.*;
import org.json.JSONObject;

/** Platform player for direct Patreon audio; no dependency changes to the working original video engine. */
public final class NativeAudioService extends Service {
    private static final int NOTIFICATION = 2401;
    private static volatile String id = "", title = "", creator = "", artwork = "", failure = "";
    private static volatile long position, duration;
    private static volatile boolean playing;
    private MediaPlayer player;
    private MediaSession session;
    private AudioManager manager;
    private AudioFocusRequest focus;
    private boolean prepared, resumeAfterFocus;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        if (change == AudioManager.AUDIOFOCUS_GAIN) { if (resumeAfterFocus && prepared && player != null) { player.start(); resumeAfterFocus = false; publish(); } }
        else { resumeAfterFocus = change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT && playing; pause(); }
    };
    private final BroadcastReceiver noisy = new BroadcastReceiver() { @Override public void onReceive(Context c, Intent i) { pause(); } };
    private final Runnable tick = new Runnable() { public void run() { publish(); handler.postDelayed(this, 1000); } };
    public static String status() {
        try { return new JSONObject().put("id",id).put("title",title).put("creator",creator).put("artwork",artwork).put("position",position).put("duration",duration).put("playing",playing).put("error",failure).toString(); }
        catch (Exception e) { return "{}"; }
    }
    @Override public void onCreate() {
        super.onCreate(); manager = (AudioManager)getSystemService(AUDIO_SERVICE);
        AudioAttributes attrs = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attrs).setOnAudioFocusChangeListener(focusListener,handler).build();
        NotificationManager notifications = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        notifications.createNotificationChannel(new NotificationChannel("personal_audio", "Reproducción Patreon", NotificationManager.IMPORTANCE_LOW));
        session = new MediaSession(this,"PatreonPersonalAudio");
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { resume(); }
            @Override public void onPause() { resumeAfterFocus=false; pause(); }
            @Override public void onStop() { stopPlayback(); }
            @Override public void onSeekTo(long ms) { if (prepared && player != null) { player.seekTo((int)Math.max(0,Math.min(duration,ms))); publish(); } }
            @Override public void onSkipToNext() { seek(30000); }
            @Override public void onSkipToPrevious() { seek(-30000); }
        },handler);
        session.setActive(true);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy,new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(noisy,new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
        handler.post(tick);
    }
    private PendingIntent command(String action, int request) {
        return PendingIntent.getForegroundService(this,request,new Intent(this,NativeAudioService.class).setAction(action),PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private Notification notification() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        Notification.Builder n = new Notification.Builder(this,"personal_audio").setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title.isEmpty()?"Patreon TV Personal":title).setContentText(creator).setVisibility(Notification.VISIBILITY_PUBLIC)
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0,1))
            .addAction(new Notification.Action.Builder(playing?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,playing?"Pausar":"Reproducir",command("toggle",1)).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel,"Detener",command("stop",2)).build())
            .setOngoing(playing).setOnlyAlertOnce(true);
        if (launch != null) n.setContentIntent(PendingIntent.getActivity(this,0,launch,PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return n.build();
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION,notification());
        if (intent == null) { stopPlayback(); return START_NOT_STICKY; }
        String action=intent.getAction();
        if ("play".equals(action)) {
            save(); releasePlayer(); id=intent.getStringExtra("id"); title=intent.getStringExtra("title"); creator=intent.getStringExtra("creator"); artwork=intent.getStringExtra("artwork"); failure=""; position=0; duration=0;
            if (id==null) id=""; if (title==null) title=""; if (creator==null) creator=""; if (artwork==null) artwork="";
            try {
                player=new MediaPlayer(); player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
                player.setWakeMode(this,PowerManager.PARTIAL_WAKE_LOCK);
                player.setOnPreparedListener(p -> {
                    prepared=true; duration=p.getDuration();
                    long old=getSharedPreferences("personal_progress",0).getLong(id,0);
                    if(old>0&&old<duration-3000) p.seekTo((int)old);
                    MediaMetadata.Builder mb = new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,title).putString(MediaMetadata.METADATA_KEY_ARTIST,creator).putLong(MediaMetadata.METADATA_KEY_DURATION,duration);
                    if(!artwork.isEmpty()) { mb.putString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI,artwork).putString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI,artwork); }
                    session.setMetadata(mb.build());
                    loadArtworkBitmap(artwork);
                    resume();
                });
                player.setOnCompletionListener(p -> { position=0; getSharedPreferences("personal_progress",0).edit().putLong(id,0).apply(); prepared=false; releasePlayer(); playing=false; publish(); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); });
                player.setOnErrorListener((p,what,extra) -> { failure="playback"; playing=false; releasePlayer(); publish(); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return true; });
                player.setDataSource(intent.getStringExtra("url")); player.prepareAsync();
                MediaMetadata.Builder initMb = new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,title).putString(MediaMetadata.METADATA_KEY_ARTIST,creator);
                if(!artwork.isEmpty()) { initMb.putString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI,artwork).putString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI,artwork); }
                session.setMetadata(initMb.build());
            } catch(Exception e) { failure="source"; releasePlayer(); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); }
        } else if ("stop".equals(action)) stopPlayback();
        else if (player == null) stopPlayback();
        else if ("toggle".equals(action)) { resumeAfterFocus=false; if (playing) pause(); else resume(); }
        else if ("seek".equals(action)) seek(intent.getIntExtra("delta",0));
        else if ("seekTo".equals(action)) seekToPosition(intent.getIntExtra("position",0));
        return START_NOT_STICKY;
    }
    private void resume() { if(prepared&&player!=null&&manager.requestAudioFocus(focus)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { player.start(); publish(); } }
    private void pause() { if(prepared&&player!=null) { if(player.isPlaying()) player.pause(); publish(); } }
    private void seek(int delta) { if(prepared&&player!=null) { player.seekTo((int)Math.max(0,Math.min(duration,player.getCurrentPosition()+(long)delta))); publish(); } }
    private void seekToPosition(int targetMs) { if(prepared&&player!=null) { player.seekTo((int)Math.max(0,Math.min(duration,targetMs))); publish(); } }
    private void save() { if(!id.isEmpty()) getSharedPreferences("personal_progress",0).edit().putLong(id,position).apply(); }
    private void publish() {
        if(prepared&&player!=null) { try {position=player.getCurrentPosition();duration=player.getDuration();playing=player.isPlaying();} catch(IllegalStateException e){playing=false;} save(); }
        if(session!=null) session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_STOP|PlaybackState.ACTION_SEEK_TO|PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS)
            .setState(playing?PlaybackState.STATE_PLAYING:failure.isEmpty()?PlaybackState.STATE_PAUSED:PlaybackState.STATE_ERROR,position,playing?1f:0f).build());
        if(player!=null) ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION,notification());
    }
    private void releasePlayer() { prepared=false;playing=false;if(player!=null){player.release();player=null;} }
    private void stopPlayback() { save();releasePlayer();manager.abandonAudioFocusRequest(focus);id="";title="";creator="";artwork="";position=0;duration=0;stopForeground(STOP_FOREGROUND_REMOVE);stopSelf(); }
    private void loadArtworkBitmap(String urlStr) {
        if (urlStr == null || urlStr.isEmpty() || session == null) return;
        new Thread(() -> {
            try {
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) new java.net.URL(urlStr).openConnection();
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);
                conn.setDoInput(true);
                conn.connect();
                java.io.InputStream is = conn.getInputStream();
                android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeStream(is);
                if (bmp != null) {
                    handler.post(() -> {
                        try {
                            if (session != null && urlStr.equals(artwork)) {
                                MediaMetadata cur = session.getController().getMetadata();
                                MediaMetadata.Builder mb = cur != null ? new MediaMetadata.Builder(cur) : new MediaMetadata.Builder();
                                mb.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, bmp);
                                mb.putBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON, bmp);
                                session.setMetadata(mb.build());
                            }
                        } catch (Exception ignored) {}
                    });
                }
            } catch (Exception ignored) {}
        }).start();
    }
    @Override public void onTaskRemoved(Intent rootIntent) { if(!playing) stopPlayback(); }
    @Override public void onDestroy() { save();handler.removeCallbacksAndMessages(null);releasePlayer();manager.abandonAudioFocusRequest(focus);session.release();unregisterReceiver(noisy);super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
