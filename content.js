(() => {
  const MIN_DURATION = 60;      // ignore videos shorter than this (ads, previews, short clips)
  const SAVE_INTERVAL = 5000;   // ms between saves while playing
  const END_MARGIN = 10;        // within this many seconds of the end = finished
  const REWIND = 2;             // resume a couple of seconds early for context
  const MAX_ENTRIES = 500;
  const BANNER_MS = 10000;      // how long the resume prompt stays up
  const PREFIX = "vr:";
  // Query params that identify *which* video a page shows (everything else is ignored)
  const KEEP_PARAMS = ["v", "id", "vid", "video", "videoId", "episode", "ep", "p"];
  const DEFAULTS = { blocked: [], askBeforeResume: true };

  let settings = { ...DEFAULTS };

  /* ---------- helpers ---------- */
  const norm = (h) => (h || "").replace(/^www\./, "").toLowerCase();
  const matches = (host, entry) => host === entry || host.endsWith("." + entry);
  const frameHost = norm(location.hostname);
  const topHost = (() => {
    try {
      const o = location.ancestorOrigins;
      if (o && o.length) return norm(new URL(o[o.length - 1]).hostname);
    } catch (_) {}
    return frameHost;
  })();
  const isBlocked = () =>
    settings.blocked.some((e) => matches(frameHost, e) || matches(topHost, e));

  const fmt = (s) => {
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
  };

  function pageKey() {
    const u = new URL(location.href);
    const kept = new URLSearchParams();
    for (const p of KEEP_PARAMS) if (u.searchParams.has(p)) kept.set(p, u.searchParams.get(p));
    const q = kept.toString();
    return PREFIX + u.origin + u.pathname + (q ? "?" + q : "");
  }

  function hasTimeParam() {
    const p = new URL(location.href).searchParams;
    return p.has("t") || p.has("start") || p.has("time_continue");
  }

  const isLong = (v) => isFinite(v.duration) && v.duration >= MIN_DURATION;

  async function loadSettings() {
    try {
      const { settings: s } = await chrome.storage.local.get("settings");
      settings = { ...DEFAULTS, ...(s || {}) };
    } catch (_) {}
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.settings) {
        settings = { ...DEFAULTS, ...(changes.settings.newValue || {}) };
        if (isBlocked()) removeBanner();
      }
    });
  } catch (_) {}

  async function prune() {
    try {
      const all = await chrome.storage.local.get(null);
      const keys = Object.keys(all).filter((k) => k.startsWith(PREFIX));
      if (keys.length <= MAX_ENTRIES) return;
      keys.sort((a, b) => all[a].ts - all[b].ts);
      await chrome.storage.local.remove(keys.slice(0, keys.length - MAX_ENTRIES));
    } catch (_) {}
  }

  /* ---------- resume banner (shadow DOM, so site CSS can't touch it) ---------- */
  let bannerHost = null;
  let bannerTimer = null;

  function removeBanner() {
    clearTimeout(bannerTimer);
    if (!bannerHost) return;
    const h = bannerHost;
    bannerHost = null;
    const card = h.__root && h.__root.querySelector(".card");
    if (card) {
      card.classList.add("out");
      setTimeout(() => h.remove(), 220);
    } else h.remove();
  }

  function showBanner(video, time, onDone) {
    removeBanner();
    const host = document.createElement("div");
    const r = video.getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left + 16, innerWidth - 310));
    const top = Math.max(12, Math.min(r.bottom - 78, innerHeight - 80));
    host.style.cssText =
      `all:initial;position:fixed;z-index:2147483647;left:${left}px;top:${top}px;`;
    const root = host.attachShadow({ mode: "closed" });
    host.__root = root;
    root.innerHTML = `
      <style>
        .card{position:relative;overflow:hidden;display:flex;align-items:center;gap:6px;
          padding:8px 8px 10px 14px;border-radius:14px;color:#eef0f7;
          font:13px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
          background:rgba(24,27,38,.82);backdrop-filter:blur(14px) saturate(1.4);
          -webkit-backdrop-filter:blur(14px) saturate(1.4);
          border:1px solid rgba(255,255,255,.1);box-shadow:0 12px 32px rgba(0,0,0,.38);
          animation:in .38s cubic-bezier(.2,.9,.25,1.12) both}
        .card.out{animation:out .2s ease forwards}
        @keyframes in{from{opacity:0;transform:translateY(10px) scale(.95)}to{opacity:1;transform:none}}
        @keyframes out{to{opacity:0;transform:translateY(6px) scale(.97)}}
        .txt{white-space:nowrap;margin-right:6px}
        .time{font-variant-numeric:tabular-nums;font-weight:650;color:#a9b4ff}
        button{all:unset;cursor:pointer;padding:7px 12px;border-radius:9px;font-weight:600;
          transition:background .15s,transform .12s}
        button:active{transform:scale(.95)}
        button:focus-visible{outline:2px solid #a9b4ff;outline-offset:1px}
        .go{background:#8794ff;color:#10131c}.go:hover{background:#a1abff}
        .no{color:#b9bfd0}.no:hover{background:rgba(255,255,255,.09)}
        .bar{position:absolute;left:0;bottom:0;height:2px;width:100%;background:#8794ff;
          transform-origin:left;animation:shrink ${BANNER_MS}ms linear forwards}
        @keyframes shrink{to{transform:scaleX(0)}}
        @media (prefers-reduced-motion:reduce){.card,.card.out{animation-duration:.01ms}}
      </style>
      <div class="card" role="dialog" aria-label="Resume video">
        <span class="txt">Continue from <span class="time">${fmt(time)}</span>?</span>
        <button class="go">Continue</button>
        <button class="no">Start over</button>
        <div class="bar"></div>
      </div>`;
    root.querySelector(".go").addEventListener("click", () => onDone("resume"));
    root.querySelector(".no").addEventListener("click", () => onDone("start"));
    (document.fullscreenElement || document.documentElement).appendChild(host);
    bannerHost = host;
    bannerTimer = setTimeout(() => onDone("timeout"), BANNER_MS);
  }

  /* ---------- per-video tracking ---------- */
  const seen = new WeakSet();
  const savers = new Set();

  function attach(v) {
    if (seen.has(v)) return;
    seen.add(v);

    let lastSave = 0;
    let restoredKey = null;
    let pending = false; // true while the resume prompt is waiting for an answer

    const decide = (choice, t) => {
      pending = false;
      removeBanner();
      if (choice === "resume") v.currentTime = Math.max(0, t - REWIND);
    };

    async function tryRestore() {
      if (!isLong(v) || isBlocked()) return;
      const key = pageKey();
      if (restoredKey === key) return;
      restoredKey = key;
      if (pending) { pending = false; removeBanner(); }
      if (hasTimeParam()) return; // respect explicit timestamps in the URL

      let data;
      try { data = (await chrome.storage.local.get(key))[key]; } catch (_) { return; }
      if (!data || data.t <= 3 || data.t >= v.duration - END_MARGIN || v.currentTime >= 5) return;

      if (!settings.askBeforeResume) {
        v.currentTime = Math.max(0, data.t - REWIND);
        return;
      }
      pending = true;
      showBanner(v, data.t, (choice) => decide(choice, data.t));
    }

    async function save(force) {
      if (pending || !isLong(v) || isBlocked()) return;
      const now = Date.now();
      if (!force && now - lastSave < SAVE_INTERVAL) return;
      const key = pageKey();
      try {
        if (v.ended || v.currentTime > v.duration - END_MARGIN) {
          await chrome.storage.local.remove(key);
          return;
        }
        if (v.currentTime < 3) return;
        lastSave = now;
        await chrome.storage.local.set({
          [key]: {
            t: v.currentTime,
            d: v.duration,
            ts: now,
            url: location.href,
            title: (window === top ? document.title : "") || location.hostname
          }
        });
        if (Math.random() < 0.05) prune();
      } catch (_) {
        // extension was reloaded/updated; ignore
      }
    }

    savers.add(save);
    v.addEventListener("loadedmetadata", tryRestore);
    v.addEventListener("durationchange", tryRestore);
    v.addEventListener("canplay", tryRestore);
    v.addEventListener("timeupdate", () => save(false));
    v.addEventListener("pause", () => save(true));
    v.addEventListener("ended", () => save(true));
    // If the user scrubs by hand while the prompt is up, they've made their choice
    v.addEventListener("seeked", () => {
      if (pending) { pending = false; removeBanner(); }
    });
    if (v.readyState >= 1) tryRestore();
  }

  function scan(root = document) {
    root.querySelectorAll("video").forEach(attach);
  }

  const flush = () => savers.forEach((s) => s(true));

  (async () => {
    await loadSettings();
    scan();
    new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.tagName === "VIDEO") attach(n);
          else if (n.querySelectorAll) scan(n);
        });
      }
    }).observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener("visibilitychange", () => document.hidden && flush());
    window.addEventListener("pagehide", flush);
  })();
})();
