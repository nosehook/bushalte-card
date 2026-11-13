/*
 * bushalte-card  v1.0.0
 * Lovelace card that shows a "Bus vertrektijden" stop as a Dutch bus stop sign (haltepaal):
 * blue head with bus pictogram, yellow name board, orange line panels with minutes + time,
 * a live departures panel and the pole.
 *
 *   type: custom:bushalte-card
 *   entity: sensor.bus_stop_utrecht_station_leidsche_rijn
 *   tiles:                       # optional, max 4 (default: automatic)
 *     - line: "73"
 *       direction: Zeist
 *   rows: 5                      # departures in the bottom panel
 *   show_pole: true
 */
(() => {
  const VERSION = "1.0.0";
  const TAG = "bushalte-card";
  const BAD = new Set(["unavailable", "unknown", undefined, null, ""]);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hm = (v) => { const p = String(v || "").split(":"); return p.length >= 2 ? Number(p[0]) * 60 + Number(p[1]) : null; };

  const T = {
    nl: { live: "Actuele vertrektijden", min: "min", now: "nu", cancelled: "uitgevallen", none: "Geen vertrekken",
      offline: "Geen gegevens", no_entity: "Kies een bushalte-sensor" },
    en: { live: "Live departures", min: "min", now: "now", cancelled: "cancelled", none: "No departures",
      offline: "No data", no_entity: "Choose a bus stop sensor" },
  };

  const BUS_SVG = `<svg viewBox="0 0 120 56" aria-hidden="true"><rect x="6" y="2" width="108" height="40" rx="6" fill="#111"/>
    <rect x="2" y="10" width="4" height="12" rx="2" fill="#111"/><rect x="114" y="10" width="4" height="12" rx="2" fill="#111"/>
    <g fill="#fff"><rect x="12" y="8" width="16" height="16" rx="1"/><rect x="31" y="8" width="16" height="16" rx="1"/>
    <rect x="50" y="8" width="16" height="16" rx="1"/><rect x="69" y="8" width="16" height="16" rx="1"/><rect x="88" y="8" width="20" height="22" rx="1"/></g>
    <circle cx="30" cy="44" r="9" fill="#111"/><circle cx="30" cy="44" r="4" fill="#fff"/>
    <circle cx="92" cy="44" r="9" fill="#111"/><circle cx="92" cy="44" r="4" fill="#fff"/></svg>`;

  const CSS = `
    :host { display:block; --bh-frame:#9aa0a6; --bh-blue1:#25409a; --bh-blue2:#1d3585; --bh-yellow:#f3cf4d;
      --bh-orange:#e3a21f; --bh-orange-dark:#c98b12; --bh-light:#f0c64c; --bh-ink:#1d1d1b; --bh-red:#b3170e; }
    [hidden] { display:none !important; }
    ha-card { padding:14px; container-type:inline-size; overflow:hidden; }
    .wrap { max-width:var(--bushalte-max-width, 420px); margin:0 auto; }
    .sign { background:var(--bh-frame); border-radius:18px; padding:7px; cursor:pointer;
      box-shadow:inset 0 2px 0 rgba(255,255,255,.35), 0 6px 14px rgba(0,0,0,.45); }
    .inner { border-radius:12px; overflow:hidden; background:#7d8389; display:flex; flex-direction:column; gap:4px; }
    .top { background:linear-gradient(180deg,var(--bh-blue1),var(--bh-blue2)); height:clamp(64px,22cqi,92px); display:grid; place-items:center; }
    .pict { background:#fff; border-radius:10px; width:42%; height:72%; display:grid; place-items:center; }
    .pict svg { width:80%; height:auto; }
    .name { background:var(--bh-yellow); font:500 clamp(18px,7.4cqi,30px)/1.1 Georgia,"Times New Roman",serif; color:var(--bh-ink);
      padding:9px 12px 8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .lines { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); background:var(--bh-orange); min-height:clamp(96px,29cqi,120px); }
    .ln { padding:7px 7px 6px; border-right:2px solid var(--bh-orange-dark); display:flex; flex-direction:column; gap:1px; color:var(--bh-ink); min-width:0; }
    .ln:last-child { border-right:none; }
    .ln.first { background:var(--bh-light); }
    .ln .no { font:700 clamp(18px,6.4cqi,26px)/1 Arial,Helvetica,sans-serif; }
    .ln .dir { font-size:clamp(9px,2.6cqi,11px); line-height:1.15; min-height:2.3em; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    .ln .min { font:700 clamp(15px,5cqi,20px)/1 Arial,Helvetica,sans-serif; margin-top:auto; }
    .ln .min small { font-size:.55em; font-weight:600; }
    .ln .at { font-size:clamp(9px,2.8cqi,11.5px); font-weight:600; opacity:.8; font-variant-numeric:tabular-nums; }
    .late { color:var(--bh-red); opacity:1 !important; }
    .ln.soon .min { animation:blink 1s steps(2) infinite; }
    .ln.empty .min, .ln.empty .at { visibility:hidden; }
    @keyframes blink { 50% { opacity:.25; } }
    .bottom { background:var(--bh-orange); padding:9px 11px 10px; color:var(--bh-ink); }
    .bh { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; opacity:.75; margin-bottom:5px;
      display:flex; justify-content:space-between; }
    .row { display:grid; grid-template-columns:34px minmax(0,1fr) auto 46px; gap:6px; align-items:center; font-size:clamp(11px,3.3cqi,13px);
      padding:3px 0; border-top:1px solid rgba(0,0,0,.12); }
    .row:first-of-type { border-top:none; }
    .badge { background:var(--bh-ink); color:var(--bh-yellow); font-weight:700; font-size:12px; border-radius:4px; text-align:center; padding:2px 0; width:30px; }
    .row .d { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .row .d small { opacity:.6; }
    .row .dl { color:var(--bh-red); font-weight:700; font-size:.85em; margin-left:4px; }
    .row .m { font-weight:700; text-align:right; white-space:nowrap; }
    .row .t { text-align:right; opacity:.8; font-variant-numeric:tabular-nums; }
    .row.x { text-decoration:line-through; opacity:.55; }
    .empty-msg { font-size:13px; opacity:.7; padding:4px 0; }
    .alert { background:var(--bh-ink); color:var(--bh-yellow); font-size:12px; padding:6px 8px; border-radius:6px; margin-top:7px; display:flex; gap:6px; }
    .bracket { height:14px; margin:-4px 8px 0; background:#8a9096; border-radius:0 0 10px 10px; }
    .pole { width:44px; height:var(--bushalte-pole-height, 90px); margin:0 auto; background:linear-gradient(90deg,#4b4f54,#7a7f85 40%,#55595e);
      border-left:1px solid #333; border-right:1px solid #333; }
    .warn { padding:8px; color:var(--error-color,#db4437); }
    .stale .lines, .stale .bottom { filter:saturate(.4); }
  `;

  class BushalteCard extends HTMLElement {
    static getStubConfig(hass) {
      const e = Object.keys(hass?.states || {}).find((id) => id.startsWith("sensor.bus_stop_"));
      return { entity: e || "" };
    }

    static getConfigForm() {
      const tile = (n) => [
        { name: `tile${n}_line`, selector: { text: {} } },
        { name: `tile${n}_direction`, selector: { text: {} } },
      ];
      return {
        schema: [
          { name: "entity", required: true, selector: { entity: { domain: "sensor", integration: "busvertrektijden" } } },
          { name: "name", selector: { text: {} } },
          { type: "grid", name: "", flatten: true, schema: [
            { name: "rows", selector: { number: { min: 0, max: 10, step: 1, mode: "box" } } },
            { name: "show_pole", selector: { boolean: {} } },
            { name: "show_trip", selector: { boolean: {} } },
            { name: "strip_city", selector: { boolean: {} } },
          ] },
          { type: "expandable", name: "", title: "Lijnvakken (leeg = automatisch)", icon: "mdi:bus-multiple", flatten: true, schema: [
            { type: "grid", name: "", flatten: true, schema: [...tile(1), ...tile(2), ...tile(3), ...tile(4)] },
            { name: "rows_follow_tiles", selector: { boolean: {} } },
          ] },
          { name: "language", selector: { select: { mode: "dropdown", options: [{ value: "nl", label: "Nederlands" }, { value: "en", label: "English" }] } } },
        ],
        computeLabel: (s) => ({
          entity: "Bushalte (sensor)", name: "Naam op het bord", rows: "Regels vertrektijden", show_pole: "Paal tonen",
          show_trip: "Routenaam tonen (bijv. U-link)", strip_city: "Plaatsnaam weglaten", rows_follow_tiles: "Onderpaneel alleen voor gekozen lijnvakken",
          language: "Taal",
          tile1_line: "Vak 1 \u2014 lijn", tile1_direction: "Vak 1 \u2014 richting", tile2_line: "Vak 2 \u2014 lijn", tile2_direction: "Vak 2 \u2014 richting",
          tile3_line: "Vak 3 \u2014 lijn", tile3_direction: "Vak 3 \u2014 richting", tile4_line: "Vak 4 \u2014 lijn", tile4_direction: "Vak 4 \u2014 richting",
        }[s.name] ?? s.name),
        computeHelper: (s) => ({
          name: "Leeg = haltenaam uit de sensor.",
          tile1_direction: "Bestemming zoals op de bus, bijv. Zeist. Leeg = alle richtingen van die lijn.",
          rows_follow_tiles: "Aan: alleen vertrekken van de lijnen/richtingen in de vakken.",
        }[s.name]),
      };
    }

    setConfig(config) {
      if (!config) throw new Error("Invalid configuration");
      this._config = { rows: 5, show_pole: true, show_trip: true, strip_city: true, rows_follow_tiles: true, language: "nl", ...config };
      this._lang = String(this._config.language).startsWith("en") ? "en" : "nl";
      this._last = null;
      if (this._hass) this._render();
    }
    set hass(hass) { this._hass = hass; this._render(); }
    connectedCallback() { this._tick = setInterval(() => { this._last = null; this._render(); }, 15000); }
    disconnectedCallback() { clearInterval(this._tick); }
    getCardSize() { return this._config?.show_pole ? 9 : 7; }
    getGridOptions() { return { columns: 6, rows: "auto", min_columns: 4 }; }
    t(k) { return T[this._lang][k] ?? k; }

    _tiles() {
      const c = this._config;
      let tiles = Array.isArray(c.tiles) ? c.tiles.slice(0, 4) : [];
      if (!tiles.length) {
        for (let n = 1; n <= 4; n++) {
          const line = c[`tile${n}_line`], dir = c[`tile${n}_direction`];
          if (line || dir) tiles.push({ line: line ? String(line) : "", direction: dir || "" });
        }
      }
      return tiles.map((x) => ({ line: String(x.line ?? "").trim(), direction: String(x.direction ?? "").trim() }));
    }

    _departures(st) {
      const a = st.attributes || {};
      const base = Date.parse(a.fetched_at || st.last_updated) || Date.now();
      const now = Date.now();
      return (a.stops || []).map((s) => {
        const exp = s.expected_at ? Date.parse(s.expected_at) : base + Number(s.seconds || 0) * 1000;
        let delay = s.delay_minutes;
        if (delay == null) {
          const d = hm(s.computed_time) - hm(s.departure_time);
          delay = isNaN(d) ? 0 : d < -720 ? d + 1440 : d > 720 ? d - 1440 : d;
        }
        return { line: String(s.bus_number ?? ""), dir: s.name || "", trip: s.trip_name, time: s.computed_time || "",
          exp, mins: Math.max(0, Math.floor((exp - now) / 60000)), delay, cancelled: !!s.cancelled, alerts: s.alerts || [] };
      }).filter((d) => d.exp > now - 30000).sort((x, y) => x.exp - y.exp);
    }

    _match(d, tile) {
      return (!tile.line || d.line.toLowerCase() === tile.line.toLowerCase())
        && (!tile.direction || d.dir.toLowerCase() === tile.direction.toLowerCase());
    }

    _render() {
      if (!this._config || !this._hass) return;
      if (!this.shadowRoot) {
        this.attachShadow({ mode: "open" });
        this.shadowRoot.addEventListener("click", () => {
          if (this._config.entity) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: this._config.entity } }));
        });
      }
      const c = this._config, st = this._hass.states[c.entity];
      let html;
      if (!c.entity) html = `<div class="warn">${this.t("no_entity")}</div>`;
      else if (!st) html = `<div class="warn">${esc(c.entity)}?</div>`;
      else html = this._sign(st);
      if (html !== this._last) {
        this.shadowRoot.innerHTML = `<style>${CSS}</style><ha-card><div class="wrap">${html}</div></ha-card>`;
        this._last = html;
      }
    }

    _sign(st) {
      const c = this._config, a = st.attributes || {}, t = (k) => this.t(k);
      let name = c.name || String(a.friendly_name || "").replace(/^.*\bBushalte\s+/i, "");
      if (!c.name && c.strip_city && name.includes(",")) name = name.split(",").slice(1).join(",").trim();
      const offline = BAD.has(st.state);
      const deps = offline ? [] : this._departures(st);
      const live = deps.filter((d) => !d.cancelled);

      // line panels
      let tiles = this._tiles();
      const auto = !tiles.length;
      if (auto) {
        const seen = new Set();
        for (const d of live) { const k = `${d.line}|${d.dir}`; if (!seen.has(k)) { seen.add(k); tiles.push({ line: d.line, direction: d.dir }); } if (tiles.length === 4) break; }
      }
      const cells = [];
      for (let i = 0; i < 4; i++) {
        const tile = tiles[i];
        if (!tile) { cells.push(`<div class="ln empty${i === 0 ? " first" : ""}"></div>`); continue; }
        const d = live.find((x) => this._match(x, tile));
        const minTxt = d ? (d.mins === 0 ? t("now") : `${d.mins}<small> ${t("min")}</small>`) : "";
        cells.push(`<div class="ln${i === 0 ? " first" : ""}${d && d.mins <= 1 ? " soon" : ""}${d ? "" : " empty"}">
          <div class="no">${esc(tile.line || d?.line || "")}</div><div class="dir">${esc(tile.direction || d?.dir || "")}</div>
          <div class="min">${minTxt}</div><div class="at${d && d.delay > 0 ? " late" : ""}">${d ? esc(d.time) + (d.delay > 0 ? ` +${d.delay}` : "") : ""}</div></div>`);
      }

      // bottom panel
      const rowsN = Number(c.rows ?? 5);
      const pool = !auto && c.rows_follow_tiles ? deps.filter((d) => tiles.some((tl) => this._match(d, tl))) : deps;
      const rows = pool.slice(0, rowsN).map((d) => `<div class="row${d.cancelled ? " x" : ""}"><span class="badge">${esc(d.line)}</span>
        <span class="d">${esc(d.dir)}${d.cancelled ? ` \u2014 ${t("cancelled")}` : ""}${c.show_trip && d.trip && !d.cancelled ? ` <small>${esc(d.trip)}</small>` : ""}${!d.cancelled && d.delay > 0 ? `<span class="dl">+${d.delay}</span>` : ""}</span>
        <span class="m">${d.mins === 0 ? t("now") : `${d.mins} ${t("min")}`}</span><span class="t">${esc(d.time)}</span></div>`).join("");
      const alerts = [...new Set([...(a.alerts || []), ...pool.slice(0, rowsN).flatMap((d) => d.alerts)])];
      const clock = new Date().toLocaleTimeString(this._hass.locale?.language || "nl", { hour: "2-digit", minute: "2-digit" });
      const title = !auto && c.rows_follow_tiles && tiles.length === 1 ? `${tiles[0].line}${tiles[0].direction ? " \u2192 " + tiles[0].direction : ""}` : t("live");
      const bottom = rowsN > 0 || alerts.length ? `<div class="bottom"><div class="bh"><span>${esc(title)}</span><span>${offline ? t("offline") : clock}</span></div>
        ${rowsN > 0 ? rows || `<div class="empty-msg">${offline ? t("offline") : t("none")}</div>` : ""}
        ${alerts.map((x) => `<div class="alert">\u26A0 <span>${esc(x)}</span></div>`).join("")}</div>` : "";

      return `<div class="sign${offline ? " stale" : ""}"><div class="inner">
          <div class="top"><div class="pict">${BUS_SVG}</div></div>
          <div class="name">${esc(name)}</div>
          <div class="lines">${cells.join("")}</div>
          ${bottom}
        </div></div>
        ${c.show_pole ? '<div class="bracket"></div><div class="pole"></div>' : ""}`;
    }
  }

  if (!customElements.get(TAG)) {
    customElements.define(TAG, BushalteCard);
    window.customCards = window.customCards || [];
    window.customCards.push({ type: TAG, name: "Bushalte Card",
      description: "Bus vertrektijden as a Dutch bus stop sign with live departures.", preview: true });
    console.info(`%c BUSHALTE-CARD %c v${VERSION} `, "background:#1d3585;color:#fff", "background:#f3cf4d;color:#1d1d1b");
  }
})();
