function PersonalAudioDock() {
  const [state, setState] = J.useState(null), [open, setOpen] = J.useState(false);
  J.useEffect(() => {
    if (!window.PersonalAudio) return;
    const update = () => {
      try {
        const s = JSON.parse(PersonalAudio.status());
        if (s && s.id) setState(s);
        else setState(null);
      } catch {}
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  J.useEffect(() => {
    const key = e => {
      if (!e.defaultPrevented && state?.id && (e.key === "MediaPlayPause" || (e.ctrlKey && e.key === "p"))) {
        e.preventDefault();
        PersonalAudio.toggle();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [state?.id]);

  if (!state?.id) return null;

  const button = (text, fn) => Y.jsx("button", { className: "filter-btn", onClick: fn, children: text });

  const openPlayer = () => {
    if (typeof window.__restoreAudioView === "function") {
      window.__restoreAudioView();
    } else {
      setOpen(!open);
    }
  };

  return Y.jsxs("aside", {
    className: "audio-dock",
    "aria-label": "Mini-reproductor activo",
    children: [
      button((state.playing ? "♫ " : "❚❚ ") + (state.title || "Audio") + " · Abrir", openPlayer),
      button(state.playing ? "Pausar" : "Reproducir", () => PersonalAudio.toggle()),
      button("−10 s", () => PersonalAudio.seek(-10000)),
      button("＋30 s", () => PersonalAudio.seek(30000)),
      button("Detener", () => PersonalAudio.stop())
    ]
  });
}
