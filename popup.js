const $ = (s) => document.querySelector(s);
const list = $("#list");
const empty = $("#empty");
const search = $("#search");
const siteSwitch = $("#siteSwitch");
const askSwitch = $("#askSwitch");
const DEFAULTS = { blocked: [], askBeforeResume: true };

let settings = { ...DEFAULTS };
let entries = [];
let query = "";
let host = null;

/* ---------- helpers ---------- */
const norm = (h) => h.replace(/^www\./, "").toLowerCase();
const matches = (h, e) => h === e || h.endsWith("." + e);
const hostOf = (url) => { try { return norm(new URL(url).hostname); } catch { return ""; } };
const cleanTitle = (t) => (t || "").replace(/^\(\d+\)\s*/, "").trim();

const fmt = (s) => {
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
};

const ago = (ts) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const hue = (str) => {
  let n = 0;
  for (const c of str) n = (n * 31 + c.charCodeAt(0)) % 360;
  return n;
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const X_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

/* ---------- data ---------- */
async function load() {
  const all = await chrome.storage.local.get(null);
  settings = { ...DEFAULTS, ...(all.settings || {}) };
  entries = Object.entries(all)
    .filter(([k]) => k.startsWith("vr:"))
    .map(([key, d]) => ({ key, ...d, host: hostOf(d.url) }))
    .sort((a, b) => b.ts - a.ts);
}
const saveSettings = () => chrome.storage.local.set({ settings });

/* ---------- list ---------- */
function visible() {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) => cleanTitle(e.title).toLowerCase().includes(q) || e.host.includes(q) || (e.url || "").toLowerCase().includes(q)
  );
}

function updateEmpty(count) {
  if (count) { empty.hidden = true; return; }
  empty.hidden = false;
  const hasAny = entries.length > 0;
  empty.querySelector(".e-title").textContent = hasAny ? "No matches" : "Nothing saved yet";
  empty.querySelector(".e-text").textContent = hasAny
    ? `Nothing found for “${query.trim()}”.`
    : "Watch a video for a minute and it will show up here.";
}

function buildRow(e, i, animate) {
  const li = el("li", "row" + (animate ? " enter" : ""));
  li.style.setProperty("--i", Math.min(i, 8));

  const a = el("a", "main");
  a.href = e.url;
  a.addEventListener("click", (ev) => {
    ev.preventDefault();
    chrome.tabs.create({ url: e.url });
  });

  const avatar = el("span", "avatar", (e.host[0] || "?").toUpperCase());
  avatar.style.setProperty("--h", hue(e.host));

  const body = el("span", "body");
  const title = el("span", "title", cleanTitle(e.title) || e.host);
  title.title = e.url;

  const sub = el("span", "sub");
  sub.append(el("span", "l", `${e.host}, ${ago(e.ts)}`), el("span", "t", `${fmt(e.t)} / ${fmt(e.d)}`));

  const track = el("span", "track");
  const fill = el("span", "fill");
  fill.style.setProperty("--p", Math.max(0.02, Math.min(1, e.t / e.d)));
  track.appendChild(fill);

  body.append(title, sub, track);
  a.append(avatar, body);

  const del = el("button", "del");
  del.setAttribute("aria-label", "Remove from history");
  del.innerHTML = X_ICON;
  del.addEventListener("click", () => removeRow(li, e));

  li.append(a, del);
  return li;
}

function render(animate) {
  const items = visible();
  list.textContent = "";
  items.forEach((e, i) => list.appendChild(buildRow(e, i, animate)));
  updateEmpty(items.length);
}

function removeRow(li, e) {
  li.style.height = li.offsetHeight + "px";
  void li.offsetHeight; // commit the explicit height so the collapse can transition
  li.classList.add("removing");
  setTimeout(async () => {
    await chrome.storage.local.remove(e.key);
    entries = entries.filter((x) => x.key !== e.key);
    li.remove();
    updateEmpty(visible().length);
  }, 260);
}

/* ---------- footer controls ---------- */
const setSwitch = (btn, on) => btn.setAttribute("aria-checked", String(on));

function applySiteUI() {
  const label = $("#siteLabel");
  if (!host) {
    label.textContent = "Tracking unavailable";
    $("#siteHost").textContent = "Open a regular web page to use this";
    siteSwitch.disabled = true;
    setSwitch(siteSwitch, false);
    return;
  }
  const tracked = !settings.blocked.some((e) => matches(host, e));
  label.textContent = tracked ? "Tracking this site" : "Paused on this site";
  $("#siteHost").textContent = host;
  setSwitch(siteSwitch, tracked);
}

siteSwitch.addEventListener("click", async () => {
  if (!host) return;
  const tracked = siteSwitch.getAttribute("aria-checked") === "true";
  settings.blocked = tracked
    ? [...new Set([...settings.blocked, host])]
    : settings.blocked.filter((e) => !matches(host, e));
  await saveSettings();
  applySiteUI();
});

askSwitch.addEventListener("click", async () => {
  settings.askBeforeResume = askSwitch.getAttribute("aria-checked") !== "true";
  setSwitch(askSwitch, settings.askBeforeResume);
  await saveSettings();
});

const gear = $("#gear");
gear.addEventListener("click", () => {
  const open = $("#panel").classList.toggle("open");
  gear.setAttribute("aria-expanded", String(open));
});

const clearBtn = $("#clear");
let clearTimer;
clearBtn.addEventListener("click", async () => {
  if (!clearBtn.classList.contains("confirm")) {
    clearBtn.classList.add("confirm");
    clearBtn.textContent = "Click again to confirm";
    clearTimer = setTimeout(() => {
      clearBtn.classList.remove("confirm");
      clearBtn.textContent = "Clear all history";
    }, 3000);
    return;
  }
  clearTimeout(clearTimer);
  clearBtn.classList.remove("confirm");
  clearBtn.textContent = "Clear all history";
  await chrome.storage.local.remove(entries.map((e) => e.key));
  entries = [];
  render(false);
});

/* ---------- search ---------- */
search.addEventListener("input", () => {
  query = search.value;
  render(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== search) {
    e.preventDefault();
    search.focus();
  }
});

/* ---------- init ---------- */
(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const u = new URL(tab.url);
    if (/^https?:$/.test(u.protocol)) host = norm(u.hostname);
  } catch (_) {}
  await load();
  setSwitch(askSwitch, settings.askBeforeResume);
  applySiteUI();
  render(true);
})();
