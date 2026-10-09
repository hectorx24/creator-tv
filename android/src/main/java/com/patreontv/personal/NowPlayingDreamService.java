package com.patreontv.personal;

import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.service.dreams.DreamService;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.widget.*;
import org.json.JSONObject;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Native Android TV DreamService (screensaver) displaying current Now Playing metadata or ambient clock. */
public final class NowPlayingDreamService extends DreamService {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView titleView;
    private TextView creatorView;
    private TextView timeView;
    private ImageView artView;
    private ProgressBar progressBar;
    private LinearLayout cardLayout;
    private String lastArtworkUrl = "";
    private Bitmap cachedBitmap = null;
    private int driftX = 0, driftY = 0;

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            updateUi();
            handler.postDelayed(this, 1000);
        }
    };

    private final Runnable burnInDrift = new Runnable() {
        @Override
        public void run() {
            // Anti-burn-in subtle translation (shifts within +/- 16px)
            driftX = (int) ((Math.random() - 0.5) * 32);
            driftY = (int) ((Math.random() - 0.5) * 32);
            if (cardLayout != null) {
                cardLayout.setTranslationX(driftX);
                cardLayout.setTranslationY(driftY);
            }
            handler.postDelayed(this, 30000);
        }
    };

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false);
        setFullscreen(true);

        Context ctx = this;
        FrameLayout root = new FrameLayout(ctx);
        root.setBackgroundColor(Color.parseColor("#0a0a0c"));

        cardLayout = new LinearLayout(ctx);
        cardLayout.setOrientation(LinearLayout.VERTICAL);
        cardLayout.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
        );
        cardLayout.setLayoutParams(cardLp);

        // Artwork image
        artView = new ImageView(ctx);
        int artSize = dp(240);
        LinearLayout.LayoutParams artLp = new LinearLayout.LayoutParams(artSize, artSize);
        artLp.bottomMargin = dp(24);
        artView.setLayoutParams(artLp);
        artView.setScaleType(ImageView.ScaleType.CENTER_CROP);
        GradientDrawable artBg = new GradientDrawable();
        artBg.setColor(Color.parseColor("#1c1a1c"));
        artBg.setCornerRadius(dp(24));
        artView.setBackground(artBg);
        artView.setClipToOutline(true);
        cardLayout.addView(artView);

        // Title
        titleView = new TextView(ctx);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
        titleView.setTextColor(Color.parseColor("#f6f3f2"));
        titleView.setTypeface(Typeface.DEFAULT_BOLD);
        titleView.setGravity(Gravity.CENTER);
        titleView.setMaxLines(2);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(dp(540), LinearLayout.LayoutParams.WRAP_CONTENT);
        titleView.setLayoutParams(titleLp);
        cardLayout.addView(titleView);

        // Creator
        creatorView = new TextView(ctx);
        creatorView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        creatorView.setTextColor(Color.parseColor("#ec7969"));
        creatorView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams creatorLp = new LinearLayout.LayoutParams(dp(540), LinearLayout.LayoutParams.WRAP_CONTENT);
        creatorLp.topMargin = dp(8);
        creatorView.setLayoutParams(creatorLp);
        cardLayout.addView(creatorView);

        // Time and state
        timeView = new TextView(ctx);
        timeView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        timeView.setTextColor(Color.parseColor("#a5a0a1"));
        timeView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams timeLp = new LinearLayout.LayoutParams(dp(540), LinearLayout.LayoutParams.WRAP_CONTENT);
        timeLp.topMargin = dp(12);
        timeView.setLayoutParams(timeLp);
        cardLayout.addView(timeView);

        // Progress bar
        progressBar = new ProgressBar(ctx, null, android.R.attr.progressBarStyleHorizontal);
        LinearLayout.LayoutParams progLp = new LinearLayout.LayoutParams(dp(360), dp(6));
        progLp.topMargin = dp(16);
        progressBar.setLayoutParams(progLp);
        progressBar.setMax(100);
        cardLayout.addView(progressBar);

        root.addView(cardLayout);
        setContentView(root);
    }

    @Override
    public void onDreamingStarted() {
        super.onDreamingStarted();
        updateUi();
        handler.post(ticker);
        handler.post(burnInDrift);
    }

    @Override
    public void onDreamingStopped() {
        super.onDreamingStopped();
        handler.removeCallbacksAndMessages(null);
        if (cachedBitmap != null && !cachedBitmap.isRecycled()) {
            cachedBitmap.recycle();
            cachedBitmap = null;
        }
    }

    private void updateUi() {
        try {
            String json = NativeAudioBridge.getLastStatus();
            if (json == null || json.isEmpty()) json = NativeAudioService.status();
            JSONObject st = new JSONObject(json);
            boolean isPlaying = st.optBoolean("playing", false);
            String title = st.optString("title", "");
            String creator = st.optString("creator", "");
            long pos = st.optLong("position", 0);
            long dur = st.optLong("duration", 0);

            String artwork = st.optString("artwork", "");
            if (!artwork.equals(lastArtworkUrl)) {
                lastArtworkUrl = artwork;
                loadArtwork(artwork);
            }

            if (title.isEmpty()) {
                titleView.setText("Patreon TV");
                creatorView.setText("Modo Ambiente");
                timeView.setText("Sin reproducción activa");
                progressBar.setVisibility(View.GONE);
                artView.setImageResource(android.R.drawable.ic_media_play);
            } else {
                titleView.setText(title);
                creatorView.setText(creator);
                progressBar.setVisibility(View.VISIBLE);
                if (dur > 0) {
                    progressBar.setProgress((int) Math.min(100, (pos * 100) / dur));
                    timeView.setText((isPlaying ? "▶ Reproduciendo · " : "❚❚ En pausa · ") + formatTime(pos) + " / " + formatTime(dur));
                } else {
                    progressBar.setProgress(0);
                    timeView.setText(isPlaying ? "▶ Reproduciendo" : "❚❚ En pausa");
                }
            }
        } catch (Exception e) {
            titleView.setText("Patreon TV");
            creatorView.setText("Modo Reposo");
            progressBar.setVisibility(View.GONE);
        }
    }

    private void loadArtwork(final String urlStr) {
        if (urlStr == null || urlStr.isEmpty()) {
            artView.setImageResource(android.R.drawable.ic_media_play);
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
                    conn.setConnectTimeout(4000);
                    conn.setReadTimeout(4000);
                    conn.connect();
                    InputStream is = conn.getInputStream();
                    final Bitmap bmp = BitmapFactory.decodeStream(is);
                    if (bmp != null) {
                        handler.post(new Runnable() {
                            @Override
                            public void run() {
                                if (urlStr.equals(lastArtworkUrl) && artView != null) {
                                    if (cachedBitmap != null && !cachedBitmap.isRecycled()) {
                                        cachedBitmap.recycle();
                                    }
                                    cachedBitmap = bmp;
                                    artView.setImageBitmap(bmp);
                                }
                            }
                        });
                    }
                } catch (Exception e) {
                    handler.post(new Runnable() {
                        @Override
                        public void run() {
                            if (urlStr.equals(lastArtworkUrl) && artView != null) {
                                artView.setImageResource(android.R.drawable.ic_media_play);
                            }
                        }
                    });
                }
            }
        }).start();
    }

    private String formatTime(long ms) {
        long s = Math.max(0, ms / 1000);
        long m = s / 60;
        long sec = s % 60;
        return m + ":" + (sec < 10 ? "0" : "") + sec;
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }
}
