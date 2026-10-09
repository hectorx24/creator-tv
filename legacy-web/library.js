// Clean Television Experience with Horizontal Immersive Carousel matching patreon_tv_design_reference.html
function WR({ campaign, onSelect, onBack }) {
  const [posts, setPosts] = J.useState([]);
  const [cursor, setCursor] = J.useState(null);
  const [busy, setBusy] = J.useState(false);
  const [error, setError] = J.useState("");
  const [category, setCategory] = J.useState("latest"); // 'latest' | 'video' | 'audio' | 'text'
  const [index, setIndex] = J.useState(0);
  const [view, setView] = J.useState("browse"); // 'browse' | 'audio' | 'search' | 'reader'
  const [query, setQuery] = J.useState("");
  const [audioDetail, setAudioDetail] = J.useState(null);
  const [audioState, setAudioState] = J.useState({ position: 0, duration: 1, playing: false });
  const [readerDetail, setReaderDetail] = J.useState(null);

  const cacheKey = "library:" + campaign.id;
  const cache = window.__personalLibrary || (window.__personalLibrary = {});
  const loading = J.useRef(false);
  const mounted = J.useRef(true);

  const kind = p => {
    if (/audio/i.test(p.postType || p.mimeType || "") || /\.(mp3|m4a|aac|ogg|wav)(?:[?#]|$)/i.test(p.mediaUrl || "")) return "Audio";
    if (p.videoType && p.videoType !== "none") return "Vídeo";
    if (/video/i.test(p.postType || "")) return "Vídeo";
    return "Texto";
  };

  const plain = html => new DOMParser().parseFromString(html || "", "text/html").body.textContent || "";
  const cleanText = str => {
    if (!str || str === "null" || str === "undefined") return "";
    const t = plain(str).trim();
    return (t === "null" || t === "undefined" || !t) ? "" : t;
  };

  const load = async (next, reset = false) => {
    if (loading.current) return;
    loading.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}/posts?videoOnly=false${next ? "&cursor=" + encodeURIComponent(next) : ""}`);
      if (!response.ok) throw new Error(response.status === 401 ? "Tu sesión venció." : "No se pudo cargar el catálogo.");
      const page = await response.json();
      if (!mounted.current) return;
      setCursor(page.nextCursor || null);
      setPosts(old => {
        const merged = [...(reset ? [] : old), ...(page.posts || [])].filter((p, i, all) => all.findIndex(x => x.id === p.id) === i)
          .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
        cache[cacheKey] = { posts: merged, cursor: page.nextCursor || null, category, index };
        return merged;
      });
    } catch (e) {
      if (mounted.current) setError(e.message || "Error de conexión");
    } finally {
      loading.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  J.useEffect(() => {
    mounted.current = true;
    const old = cache[cacheKey];
    if (old) {
      setPosts(old.posts);
      setCursor(old.cursor);
      setCategory(old.category || "latest");
      setIndex(old.index || 0);
    } else {
      load(null);
    }
    return () => { mounted.current = false; };
  }, [campaign.id]);

  // One-time restoration when returning to the app
  J.useEffect(() => {
    if (!window.PersonalAudio) return;
    try {
      const prev = sessionStorage.getItem("personal_view");
      const dismissed = sessionStorage.getItem("personal_view_dismissed");
      const st = JSON.parse(PersonalAudio.status());
      if (st && st.id && (prev === "audio" || (st.playing && !dismissed))) {
        setAudioDetail({
          id: st.id,
          title: st.title || "Episodio de audio",
          thumbnailUrl: st.artwork || "",
          creator: st.creator || campaign?.name || "Patreon"
        });
        setView("audio");
      }
    } catch {}
  }, []);

  // Audio background state poller
  J.useEffect(() => {
    if (!window.PersonalAudio) return;
    const poll = () => {
      try {
        const state = JSON.parse(PersonalAudio.status());
        if (state) {
          setAudioState(state);
          if (state.id) {
            const restored = {
              id: state.id,
              title: state.title || "Episodio de audio",
              thumbnailUrl: state.artwork || "",
              creator: state.creator || campaign?.name || "Patreon"
            };
            window.__restoreAudioView = () => {
              setAudioDetail(restored);
              setView("audio");
              try { sessionStorage.setItem("personal_view", "audio"); sessionStorage.removeItem("personal_view_dismissed"); } catch {}
            };
          }
        }
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 600);
    return () => clearInterval(timer);
  }, [campaign?.name]);

  // Filtered list based on category
  const list = J.useMemo(() => {
    if (category === "latest") return posts;
    if (category === "video") return posts.filter(p => kind(p) === "Vídeo");
    if (category === "audio") return posts.filter(p => kind(p) === "Audio");
    if (category === "text") return posts.filter(p => kind(p) === "Texto");
    return posts;
  }, [posts, category]);

  // Lazy load next page when approaching end of carousel
  J.useEffect(() => {
    if (cursor && !busy && list.length > 0 && index >= list.length - 2) {
      load(cursor);
    }
  }, [index, list.length, cursor, busy]);

  const move = delta => {
    if (!list.length) return;
    setIndex(old => {
      const next = ((old + delta) % list.length + list.length) % list.length;
      return next;
    });
  };

  // Direct episode opening without intermediate detail screens
  const openItem = async p => {
    if (!p) return;
    setError("");
    const type = kind(p);

    if (type === "Texto") {
      setReaderDetail(p);
      setView("reader");
      return;
    }

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(p.id)}/video`);
      if (!response.ok) throw new Error("Este contenido no ofrece archivo reproducible.");
      const media = await response.json();
      media.postId = p.id;

      if (type === "Audio" && window.PersonalAudio && media.type !== "embed") {
        const ok = PersonalAudio.play(JSON.stringify({
          id: p.id,
          url: media.url,
          title: p.title,
          creator: campaign.name,
          artwork: p.thumbnailUrl || ""
        }));
        if (!ok) throw new Error("No se pudo iniciar el reproductor de audio.");
        setAudioDetail(p);
        try { sessionStorage.setItem("personal_view", "audio"); sessionStorage.removeItem("personal_view_dismissed"); } catch {}
        setView("audio");
      } else {
        window.PersonalAudio?.stop();
        onSelect(p, media); // Direct video launch
      }
    } catch (e) {
      setError(e.message);
    }
  };

  // Keyboard navigation
  J.useEffect(() => {
    const handleKey = e => {
      const isInput = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");

      // Back / Escape
      if (e.key === "Escape" || (e.key === "Backspace" && !isInput)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (view === "search") { setView("browse"); setQuery(""); return; }
        if (view === "audio") {
          try { sessionStorage.setItem("personal_view", "browse"); sessionStorage.setItem("personal_view_dismissed", "true"); } catch {}
          setView("browse");
          return;
        }
        if (view === "reader") { setView("browse"); return; }
        if (category !== "latest") { setCategory("latest"); setIndex(0); return; }
        onBack();
        return;
      }

      // Inside Search Input: allow native typing, Backspace, arrows
      if (view === "search" && isInput) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          document.querySelector(".search-results .result")?.focus();
        }
        return;
      }

      // Inside Search Results:
      if (view === "search" && !isInput) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          document.getElementById("searchInput")?.focus();
          return;
        }
      }

      // In Browse View:
      if (view === "browse") {
        const active = document.activeElement;
        const isTab = active && active.classList.contains("tab");
        const isTop = active && (active.classList.contains("back-label") || active.classList.contains("icon-btn"));

        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          if (isTab) {
            e.preventDefault();
            const tabs = [...document.querySelectorAll(".tabs .tab")];
            const idx = tabs.indexOf(active);
            const nextIdx = e.key === "ArrowRight" ? Math.min(tabs.length - 1, idx + 1) : Math.max(0, idx - 1);
            tabs[nextIdx]?.focus();
            tabs[nextIdx]?.click();
            return;
          }
          if (isTop) {
            e.preventDefault();
            const topBtns = [...document.querySelectorAll(".top button")];
            const idx = topBtns.indexOf(active);
            const nextIdx = e.key === "ArrowRight" ? Math.min(topBtns.length - 1, idx + 1) : Math.max(0, idx - 1);
            topBtns[nextIdx]?.focus();
            return;
          }
          // Carousel horizontal sliding
          e.preventDefault();
          move(e.key === "ArrowLeft" ? -1 : 1);
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (isTab) {
            document.querySelector(".top .back-label")?.focus();
          } else {
            document.querySelector(`.tabs .tab[aria-selected="true"]`)?.focus();
          }
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (isTop) {
            document.querySelector(`.tabs .tab[aria-selected="true"]`)?.focus();
          } else {
            document.getElementById("openEpisode")?.focus();
          }
          return;
        }

        // Enter / DPAD_CENTER / Select
        if (e.key === "Enter" || e.key === "Select" || e.keyCode === 13 || e.keyCode === 23) {
          if (!active || active === document.body || active.classList.contains("feature") || active.classList.contains("adjacent")) {
            e.preventDefault();
            openItem(list[index]);
            return;
          }
        }
      }

      // In Audio View:
      if (view === "audio") {
        if (e.key === " " || e.key === "MediaPlayPause") {
          e.preventDefault();
          PersonalAudio.toggle();
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          PersonalAudio.seek(-10000);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          PersonalAudio.seek(10000);
          return;
        }
        if (e.key === "Enter" || e.key === "Select" || e.keyCode === 13 || e.keyCode === 23) {
          const active = document.activeElement;
          if (active && active.id === "audioPlay") {
            e.preventDefault();
            PersonalAudio.toggle();
            return;
          }
        }
      }
    };

    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [view, category, index, list, onBack]);

  const clock = ms => {
    const s = Math.max(0, Math.floor((ms || 0) / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  };

  const formatDate = p => p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "";

  // Common SVG Icons
  const iconPlay = Y.jsx("svg", { className: "icon", viewBox: "0 0 24 24", style: { fill: "currentColor", stroke: "none" }, children: Y.jsx("path", { d: "M7 4.8c0-.8.9-1.3 1.6-.9l11 7.2c.6.4.6 1.4 0 1.8l-11 7.2c-.7.4-1.6-.1-1.6-.9V4.8Z" }) });
  const iconPause = Y.jsxs("svg", { className: "icon", viewBox: "0 0 24 24", style: { fill: "currentColor", stroke: "none" }, children: [Y.jsx("path", { d: "M6 5h4v14H6z" }), Y.jsx("path", { d: "M14 5h4v14h-4z" })] });
  const iconSearch = Y.jsxs("svg", { className: "icon", viewBox: "0 0 24 24", children: [Y.jsx("circle", { cx: 11, cy: 11, r: 7 }), Y.jsx("path", { d: "m16.5 16.5 4.5 4.5" })] });

  // 1. Audio Screen View
  const activeAudio = audioDetail || (audioState.id ? { id: audioState.id, title: audioState.title, thumbnailUrl: audioState.artwork, creator: audioState.creator } : null);
  if (view === "audio" && activeAudio) {
    const pos = audioState.position || 0;
    const dur = audioState.duration || 1;
    const progress = Math.min(100, Math.max(0, (pos / dur) * 100));

    return Y.jsxs("section", {
      className: "view active",
      id: "audio",
      "aria-label": "Reproductor de audio",
      children: [
        Y.jsxs("header", {
          className: "top",
          children: [
            Y.jsx("button", {
              className: "back-label",
              onClick: () => {
                try { sessionStorage.setItem("personal_view", "browse"); sessionStorage.setItem("personal_view_dismissed", "true"); } catch {}
                setView("browse");
              },
              children: "← Biblioteca"
            }),
            Y.jsx("span", { className: "muted small", children: "Reproduciendo audio" })
          ]
        }),
        Y.jsx("div", {
          className: "player-shell",
          children: Y.jsxs("div", {
            className: "audio-main",
            children: [
              activeAudio.thumbnailUrl ? Y.jsx("img", { className: "audio-cover", src: activeAudio.thumbnailUrl, alt: "" }) :
                Y.jsx("div", { className: "art audio-cover fallback purple" }),
              Y.jsxs("div", {
                className: "audio-info",
                children: [
                  Y.jsx("div", { className: "eyebrow", children: "PODCAST" }),
                  Y.jsx("h1", { id: "audioTitle", children: activeAudio.title }),
                  Y.jsx("p", { id: "audioCreator", children: activeAudio.creator || campaign.name }),
                  Y.jsxs("div", {
                    className: "media-controls",
                    children: [
                      Y.jsx("input", {
                        className: "seek",
                        id: "audioSeek",
                        type: "range",
                        min: 0,
                        max: dur,
                        value: pos,
                        style: { "--progress": `${progress}%` },
                        onChange: e => window.PersonalAudio?.seekTo?.(Number(e.target.value)),
                        "aria-label": "Línea de tiempo de audio"
                      }),
                      Y.jsxs("div", {
                        className: "times",
                        children: [
                          Y.jsx("span", { id: "audioElapsed", children: clock(pos) }),
                          Y.jsx("span", { id: "audioTotal", children: clock(dur) })
                        ]
                      }),
                      Y.jsxs("div", {
                        className: "transport",
                        children: [
                          Y.jsx("button", {
                            className: "icon-btn",
                            id: "audioMinus",
                            onClick: () => PersonalAudio.seek(-10000),
                            "aria-label": "Retroceder 10 segundos",
                            children: Y.jsxs("svg", { className: "icon", viewBox: "0 0 24 24", children: [Y.jsx("path", { d: "M4 11a8 8 0 1 1 1 5" }), Y.jsx("path", { d: "M4 5v6h6" }), Y.jsx("text", { x: "8.5", y: "15", fontSize: "7", stroke: "none", fill: "currentColor", children: "10" })] })
                          }),
                          Y.jsx("button", {
                            className: "play-large",
                            id: "audioPlay",
                            onClick: () => PersonalAudio.toggle(),
                            "aria-label": audioState.playing ? "Pausar" : "Reproducir",
                            children: audioState.playing ? iconPause : iconPlay
                          }),
                          Y.jsx("button", {
                            className: "icon-btn",
                            id: "audioPlus",
                            onClick: () => PersonalAudio.seek(10000),
                            "aria-label": "Adelantar 10 segundos",
                            children: Y.jsxs("svg", { className: "icon", viewBox: "0 0 24 24", children: [Y.jsx("path", { d: "M20 11a8 8 0 1 0-1 5" }), Y.jsx("path", { d: "M20 5v6h-6" }), Y.jsx("text", { x: "8.5", y: "15", fontSize: "7", stroke: "none", fill: "currentColor", children: "10" })] })
                          })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        }),
        Y.jsxs("footer", {
          className: "footer",
          children: [
            Y.jsx("span", { children: "← → Buscar posición · OK Reproducir/Pausar" }),
            Y.jsx("span", { children: "Patreon TV Personal" })
          ]
        })
      ]
    });
  }

  // 2. Text Reader View
  if (view === "reader" && readerDetail) {
    const textContent = cleanText(readerDetail.description);
    return Y.jsxs("section", {
      className: "view active",
      id: "reader",
      "aria-label": "Lector de texto",
      children: [
        Y.jsxs("header", {
          className: "top",
          children: [
            Y.jsx("button", { className: "back-label", onClick: () => setView("browse"), children: "← Biblioteca" }),
            Y.jsx("span", { className: "muted small", children: "Artículo" })
          ]
        }),
        Y.jsxs("div", {
          className: "text-reader",
          tabIndex: 0,
          children: [
            Y.jsx("div", { className: "eyebrow", children: `Publicación · ${campaign.name}` }),
            Y.jsx("h1", { id: "readerTitle", children: readerDetail.title }),
            Y.jsx("div", { className: "body-text", children: textContent || "Esta publicación no contiene texto adicional." })
          ]
        }),
        Y.jsxs("footer", {
          className: "footer",
          children: [
            Y.jsx("span", { children: "↑ ↓ Leer · Esc Volver" }),
            Y.jsx("span", { children: formatDate(readerDetail) })
          ]
        })
      ]
    });
  }

  // 3. Search View
  if (view === "search") {
    const filteredSearch = query ? posts.filter(p => (p.title + " " + campaign.name).toLowerCase().includes(query.toLowerCase())) : [];

    return Y.jsxs("section", {
      className: "view active",
      id: "search",
      "aria-label": "Búsqueda",
      children: [
        Y.jsxs("header", {
          className: "top",
          children: [
            Y.jsxs("div", { className: "brand", children: [Y.jsx("span", { className: "brand-mark", children: "P" }), "Patreon TV"] }),
            Y.jsx("button", { className: "back-label", onClick: () => { setView("browse"); setQuery(""); }, children: "← Volver a biblioteca" })
          ]
        }),
        Y.jsxs("div", {
          className: "search-area",
          children: [
            Y.jsx("div", { className: "eyebrow", children: "Biblioteca" }),
            Y.jsx("h1", { children: "¿Qué quieres encontrar?" }),
            Y.jsxs("label", {
              className: "search-wrap",
              children: [
                iconSearch,
                Y.jsx("input", {
                  id: "searchInput",
                  type: "search",
                  placeholder: "Buscar episodios...",
                  autoComplete: "off",
                  autoFocus: true,
                  value: query,
                  onChange: e => setQuery(e.target.value),
                  onFocus: () => window.PersonalAudio?.showKeyboard?.(),
                  onBlur: () => window.PersonalAudio?.hideKeyboard?.(),
                  "aria-label": "Buscar episodios"
                })
              ]
            }),
            Y.jsx("div", {
              className: "search-results",
              id: "searchResults",
              children: filteredSearch.map(item => Y.jsxs("button", {
                key: item.id,
                className: "result",
                onClick: () => openItem(item),
                children: [
                  Y.jsx("small", { children: kind(item) }),
                  Y.jsx("span", { children: item.title })
                ]
              }))
            })
          ]
        })
      ]
    });
  }

  // 4. Primary Browse View: Immersive Horizontal Carousel
  const count = list.length;
  const safeIndex = count > 0 ? ((index % count) + count) % count : 0;
  const current = list[safeIndex] || null;
  const prev = count > 1 ? list[(safeIndex - 1 + count) % count] : null;
  const next = count > 1 ? list[(safeIndex + 1) % count] : null;

  const sectionTitles = {
    latest: "Últimos episodios",
    video: "Explorar vídeos",
    audio: "Escuchar podcasts",
    text: "Leer publicaciones"
  };

  return Y.jsxs("section", {
    className: "view active",
    id: "browse",
    "aria-label": "Explorar contenido",
    children: [
      Y.jsxs("header", {
        className: "top",
        children: [
          Y.jsxs("div", { className: "brand", children: [Y.jsx("span", { className: "brand-mark", children: "P" }), "Patreon TV"] }),
          Y.jsxs("div", {
            className: "right",
            children: [
              Y.jsxs("button", {
                className: "back-label",
                id: "creatorSwitch",
                onClick: onBack,
                children: [`Creador: ${campaign.name} `, Y.jsx("span", { "aria-hidden": "true", children: "⌄" })]
              }),
              Y.jsx("button", {
                className: "icon-btn",
                id: "goSearch",
                onClick: () => setView("search"),
                "aria-label": "Buscar",
                children: iconSearch
              })
            ]
          })
        ]
      }),
      Y.jsxs("nav", {
        className: "tabs",
        id: "tabs",
        "aria-label": "Tipo de contenido",
        children: [
          Y.jsx("button", { className: `tab ${category === "latest" ? "active" : ""}`, "aria-selected": category === "latest", onClick: () => { setCategory("latest"); setIndex(0); }, children: "Últimos" }),
          Y.jsx("button", { className: `tab ${category === "video" ? "active" : ""}`, "aria-selected": category === "video", onClick: () => { setCategory("video"); setIndex(0); }, children: "Vídeos" }),
          Y.jsx("button", { className: `tab ${category === "audio" ? "active" : ""}`, "aria-selected": category === "audio", onClick: () => { setCategory("audio"); setIndex(0); }, children: "Audio" }),
          Y.jsx("button", { className: `tab ${category === "text" ? "active" : ""}`, "aria-selected": category === "text", onClick: () => { setCategory("text"); setIndex(0); }, children: "Texto" })
        ]
      }),
      Y.jsxs("div", {
        className: "section-head",
        children: [
          Y.jsxs("div", {
            children: [
              Y.jsx("div", { className: "eyebrow", children: "Biblioteca personal" }),
              Y.jsx("h1", { id: "sectionTitle", children: sectionTitles[category] || "Episodios" })
            ]
          }),
          Y.jsx("span", {
            className: "muted small",
            id: "itemNumber",
            children: count ? `${String(safeIndex + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}` : "00 / 00"
          })
        ]
      }),
      current ? Y.jsxs("main", {
        className: "carousel-stage",
        children: [
          prev && Y.jsxs("button", {
            className: "adjacent prev-card",
            onClick: () => move(-1),
            "aria-label": "Episodio anterior",
            children: [
              prev.thumbnailUrl ? Y.jsx("img", { className: "art", src: prev.thumbnailUrl, alt: "" }) :
                Y.jsx("div", { className: "art fallback purple" }),
              Y.jsx("div", { className: "shade" }),
              Y.jsx("span", { children: prev.title })
            ]
          }),
          Y.jsxs("article", {
            key: current.id,
            className: "feature",
            id: "feature",
            tabIndex: 0,
            children: [
              current.thumbnailUrl ? Y.jsx("img", { className: "art", src: current.thumbnailUrl, alt: "" }) :
                Y.jsx("div", { className: "art fallback gold" }),
              Y.jsxs("div", {
                className: "feature-body",
                children: [
                  Y.jsx("div", { className: "eyebrow", id: "episodeMeta", children: `${kind(current).toUpperCase()}${current.publishedAt ? " · " + formatDate(current) : ""}` }),
                  Y.jsx("h2", { id: "episodeTitle", children: current.title }),
                  Y.jsx("p", { id: "episodeCreator", children: campaign.name }),
                  cleanText(current.description) && Y.jsx("p", { className: "desc", id: "episodeDesc", children: cleanText(current.description) }),
                  Y.jsx("div", {
                    className: "actions",
                    children: Y.jsxs("button", {
                      id: "openEpisode",
                      className: "primary",
                      onClick: () => openItem(current),
                      children: [
                        iconPlay,
                        Y.jsx("span", { children: kind(current) === "Texto" ? "Leer publicación" : "Reproducir" })
                      ]
                    })
                  }),
                  error && Y.jsx("p", { style: { color: "var(--accent)", marginTop: "8px", fontSize: "13px" }, children: error })
                ]
              })
            ]
          }),
          next && Y.jsxs("button", {
            className: "adjacent next-card",
            onClick: () => move(1),
            "aria-label": "Episodio siguiente",
            children: [
              next.thumbnailUrl ? Y.jsx("img", { className: "art", src: next.thumbnailUrl, alt: "" }) :
                Y.jsx("div", { className: "art fallback green" }),
              Y.jsx("div", { className: "shade" }),
              Y.jsx("span", { children: next.title })
            ]
          })
        ]
      }) : Y.jsx("div", {
        style: { textAlign: "center", padding: "60px 20px", color: "var(--muted)", flex: 1 },
        children: busy ? "Cargando contenido…" : "No hay publicaciones disponibles en esta categoría."
      }),
      Y.jsxs("footer", {
        className: "footer",
        children: [
          Y.jsx("span", { children: "← → Explorar · OK Abrir" }),
          Y.jsx("div", {
            className: "dots",
            id: "dots",
            children: list.slice(0, 10).map((_, i) => Y.jsx("span", { key: i, className: `dot ${i === (safeIndex % 10) ? "on" : ""}` }))
          }),
          Y.jsx("span", { children: "Patreon TV Personal" })
        ]
      })
    ]
  });
}
