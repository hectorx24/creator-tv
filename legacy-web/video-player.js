// Immersive TV Video Player matching patreon_tv_design_reference.html
function Zk({ video: r, onBack }) {
  const videoRef = J.useRef(null);
  const hlsRef = J.useRef(null);
  const [playing, setPlaying] = J.useState(true);
  const [currentTime, setCurrentTime] = J.useState(0);
  const [duration, setDuration] = J.useState(0);
  const [showControls, setShowControls] = J.useState(true);
  const hideTimer = J.useRef(null);

  const resetHideTimer = J.useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  const formatTime = s => {
    if (!isFinite(s) || s < 0) return "0:00";
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    const mStr = String(m).padStart(h > 0 ? 2 : 1, "0"), sStr = String(sec).padStart(2, "0");
    return h > 0 ? `${h}:${mStr}:${sStr}` : `${mStr}:${sStr}`;
  };

  J.useEffect(() => {
    const video = videoRef.current;
    if (!video || r.type === "embed") return;

    const saved = Number(localStorage.getItem("personal-progress:" + r.postId) || 0);
    const startPos = (r.postId && saved > 5) ? saved : -1;

    if (r.type === "hls" && typeof wt !== "undefined" && wt.isSupported()) {
      const hls = new wt({
        enableWorker: false,
        lowLatencyMode: false,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        maxBufferSize: 25 * 1000 * 1000,
        backBufferLength: 15,
        startPosition: startPos,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 4,
        manifestLoadingMaxRetry: 4
      });
      hls.loadSource(r.url);
      hls.attachMedia(video);
      hls.on(wt.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      let mediaErrors = 0;
      hls.on(wt.Events.ERROR, (event, data) => {
        if (data.fatal) {
          if (data.type === wt.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === wt.ErrorTypes.MEDIA_ERROR && mediaErrors++ < 2) {
            hls.recoverMediaError();
          } else {
            hls.destroy();
          }
        }
      });
      hlsRef.current = hls;
    } else {
      video.src = r.url;
      if (startPos > 0) {
        video.addEventListener("loadedmetadata", () => {
          if (startPos < (video.duration || Infinity) - 5) video.currentTime = startPos;
        }, { once: true });
      }
      video.play().catch(() => {});
    }

    resetHideTimer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [r.url, r.type, r.postId, resetHideTimer]);

  J.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      setCurrentTime(video.currentTime);
      if (r.postId && (!video.__lastSave || Date.now() - video.__lastSave > 4000)) {
        try {
          localStorage.setItem("personal-progress:" + r.postId, String(video.currentTime));
          video.__lastSave = Date.now();
        } catch {}
      }
    };
    const onDur = () => setDuration(video.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      try { localStorage.removeItem("personal-progress:" + r.postId); } catch {}
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onDur);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnd);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onDur);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnd);
    };
  }, [r.postId]);

  const togglePlay = J.useCallback(() => {
    const video = videoRef.current;
    if (video) {
      if (video.paused) { video.play().catch(() => {}); }
      else { video.pause(); }
      resetHideTimer();
    }
  }, [resetHideTimer]);

  J.useEffect(() => {
    const handleKey = evt => {
      const video = videoRef.current;
      if (!video) return;

      resetHideTimer();

      // Enter / DPAD_CENTER / PlayPause toggles
      if (evt.key === "Select" || evt.keyCode === 23 || evt.key === "Enter" || evt.key === "MediaPlayPause" || evt.key === " ") {
        evt.preventDefault();
        evt.stopImmediatePropagation();
        togglePlay();
        return;
      }

      // Left / Right seeks on timeline
      if (evt.key === "ArrowLeft" || evt.key === "ArrowRight") {
        evt.preventDefault();
        evt.stopImmediatePropagation();
        const dur = video.duration || duration || 0;
        const delta = evt.key === "ArrowLeft" ? -10 : 30;
        video.currentTime = Math.max(0, Math.min(dur, video.currentTime + delta));
        setCurrentTime(video.currentTime);
        return;
      }

      // Back / Escape returns to library
      if (evt.key === "Escape" || evt.key === "Backspace") {
        evt.preventDefault();
        evt.stopImmediatePropagation();
        if (typeof onBack === "function") onBack();
        return;
      }
    };

    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [onBack, duration, resetHideTimer, togglePlay]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (r.type === "embed") {
    return Y.jsx("div", {
      className: "video-view",
      children: Y.jsx("iframe", { src: r.url, allow: "autoplay; fullscreen", allowFullScreen: true, title: r.title })
    });
  }

  const iconPlay = Y.jsx("svg", { className: "icon", viewBox: "0 0 24 24", children: Y.jsx("path", { d: "M7 4 20 12 7 20Z" }) });
  const iconPause = Y.jsxs("svg", { className: "icon", viewBox: "0 0 24 24", children: [Y.jsx("path", { d: "M6 5h4v14H6z" }), Y.jsx("path", { d: "M14 5h4v14h-4z" })] });
  const iconClose = Y.jsx("svg", { className: "icon", viewBox: "0 0 24 24", children: Y.jsx("path", { d: "M18 6 6 18M6 6l12 12" }) });

  return Y.jsxs("div", {
    className: "video-view" + (showControls ? "" : " controls-hidden"),
    onMouseMove: resetHideTimer,
    children: [
      Y.jsx("video", { ref: videoRef, playsInline: true, onClick: togglePlay }),
      Y.jsx("div", { className: "video-chip", children: "PATREON TV · VÍDEO" }),
      Y.jsx("button", {
        className: "icon-btn video-close",
        onClick: onBack,
        "aria-label": "Volver a biblioteca",
        children: iconClose
      }),
      Y.jsxs("div", {
        className: "video-controls",
        children: [
          Y.jsx("h2", { children: r.title }),
          Y.jsx("div", { className: "muted small", children: r.creator || "Patreon" }),
          Y.jsxs("div", {
            className: "transport",
            children: [
              Y.jsx("button", {
                className: "play-large",
                onClick: togglePlay,
                "aria-label": playing ? "Pausar" : "Reproducir",
                children: playing ? iconPause : iconPlay
              }),
              Y.jsx("span", { className: "muted small", children: "Controles discretos · vídeo a pantalla completa" })
            ]
          }),
          Y.jsx("input", {
            className: "seek",
            type: "range",
            min: 0,
            max: duration || 1,
            value: currentTime,
            style: { "--progress": `${progressPercent}%` },
            onChange: e => {
              const v = Number(e.target.value);
              const vid = videoRef.current;
              if (vid) vid.currentTime = v;
              setCurrentTime(v);
              resetHideTimer();
            },
            "aria-label": "Adelantar o retroceder vídeo"
          }),
          Y.jsxs("div", {
            className: "times",
            children: [
              Y.jsx("span", { children: formatTime(currentTime) }),
              Y.jsx("span", { children: formatTime(duration) })
            ]
          })
        ]
      })
    ]
  });
}
