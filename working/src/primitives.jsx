// Primitive components
const { useState, useEffect, useMemo, useRef, useCallback } = React;

function Chip({ kind = "neutral", children, mono = true }) {
  const cls = `chip ${kind} ${mono ? "mono" : ""}`.trim();
  return <span className={cls}>{children}</span>;
}

function SevChip({ sev, children }) {
  const map = { ok: "ok", passed: "ok", warn: "warn", warnings: "warn", esc: "esc", escalated: "esc", bad: "bad", blocked: "bad" };
  const label = children || ({ ok: "PASSED", warn: "WARNING", esc: "ESCALATED", bad: "BLOCKED", passed: "PASSED", warnings: "WARNINGS", escalated: "ESCALATED", blocked: "BLOCKED" }[sev] || sev.toUpperCase());
  return <span className={`chip mono ${map[sev] || ""}`}><span className="dot"/>{label}</span>;
}

function StatusChip({ status }) {
  const map = {
    pending:  { k: "warn", l: "PENDING" },
    published:{ k: "ok",   l: "PUBLISHED" },
    escalated:{ k: "esc",  l: "ESCALATED" },
    draft:    { k: "",     l: "DRAFT" },
    blocked:  { k: "bad",  l: "BLOCKED" },
  };
  const m = map[status] || { k: "", l: status.toUpperCase() };
  return <span className={`chip mono ${m.k}`}><span className="dot"/>{m.l}</span>;
}

function TypeIco({ type }) {
  const map = { blog: "B", email: "E", social: "S", product: "P" };
  return <span className="type-ico mono">{map[type] || "•"}</span>;
}

function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

function Icon({ name, size = 14 }) {
  const s = size;
  const props = { width: s, height: s, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "dash":    return <svg {...props}><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>;
    case "studio":  return <svg {...props}><path d="M3 3h10v8H3z"/><path d="M3 7l3-2 3 3 4-4"/></svg>;
    case "approve": return <svg {...props}><path d="M3 8l3 3 7-7"/><path d="M3 13h10"/></svg>;
    case "settings":return <svg {...props}><circle cx="8" cy="8" r="2"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M3 13l2-2M11 5l2-2"/></svg>;
    case "refresh": return <svg {...props}><path d="M14 8a6 6 0 1 1-2-4.5"/><path d="M14 2v3h-3"/></svg>;
    case "search":  return <svg {...props}><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></svg>;
    case "bell":    return <svg {...props}><path d="M4 6a4 4 0 0 1 8 0v3l1 2H3l1-2z"/><path d="M7 13a1 1 0 0 0 2 0"/></svg>;
    case "chev":    return <svg {...props}><path d="M4 6l4 4 4-4"/></svg>;
    case "chevR":   return <svg {...props}><path d="M6 4l4 4-4 4"/></svg>;
    case "plus":    return <svg {...props}><path d="M8 3v10M3 8h10"/></svg>;
    case "filter":  return <svg {...props}><path d="M2 3h12l-4 5v5l-4-2V8z"/></svg>;
    case "up":      return <svg {...props}><path d="M4 10l4-4 4 4"/></svg>;
    case "down":    return <svg {...props}><path d="M4 6l4 4 4-4"/></svg>;
    case "x":       return <svg {...props}><path d="M4 4l8 8M12 4l-8 8"/></svg>;
    case "check":   return <svg {...props}><path d="M3 8l3 3 7-7"/></svg>;
    case "dots":    return <svg {...props}><circle cx="3" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="13" cy="8" r="1"/></svg>;
    case "link":    return <svg {...props}><path d="M7 9a3 3 0 0 1 0-4l2-2a3 3 0 0 1 4 4l-1 1"/><path d="M9 7a3 3 0 0 1 0 4l-2 2a3 3 0 0 1-4-4l1-1"/></svg>;
    case "doc":     return <svg {...props}><path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3"/></svg>;
    case "tag":     return <svg {...props}><path d="M2 8V2h6l6 6-6 6z"/><circle cx="5" cy="5" r="0.8" fill="currentColor"/></svg>;
    case "image":   return <svg {...props}><rect x="2" y="3" width="12" height="10" rx="1"/><circle cx="6" cy="7" r="1.2"/><path d="M14 11l-3-3-5 5"/></svg>;
    case "zap":     return <svg {...props}><path d="M9 1L3 9h4l-1 6 6-8H8z"/></svg>;
    case "chart":   return <svg {...props}><path d="M2 13h12"/><rect x="3" y="8" width="2" height="5"/><rect x="7" y="5" width="2" height="8"/><rect x="11" y="10" width="2" height="3"/></svg>;
    case "brain":   return <svg {...props}><path d="M5 3a2 2 0 0 0-2 2v1a2 2 0 0 0-1 1.7 2 2 0 0 0 1 1.8V11a2 2 0 0 0 2 2h1V3z"/><path d="M11 3a2 2 0 0 1 2 2v1a2 2 0 0 1 1 1.7 2 2 0 0 1-1 1.8V11a2 2 0 0 1-2 2h-1V3z"/></svg>;
    case "shield":  return <svg {...props}><path d="M8 1l6 2v5c0 3.5-2.5 6-6 7-3.5-1-6-3.5-6-7V3z"/></svg>;
    case "brush":   return <svg {...props}><path d="M14 2l-8 8 2 2 8-8z"/><path d="M4 14c-1 0-2-1-2-2 1 0 3-1 4 0s0 2-2 2z"/></svg>;
    default: return null;
  }
}

function formatMoney(v, cur) {
  const c = window.AGOS_DATA.currencies[cur];
  const val = v * c.rate;
  if (val >= 1000) return `${c.sym}${(val / 1000).toFixed(1)}k`;
  return `${c.sym}${val.toFixed(0)}`;
}
function formatNum(v) {
  if (v >= 1000) return (v / 1000).toFixed(1) + "k";
  return String(v);
}

function AgosGlyph({ size = 26, style = {} }) {
  const radius = Math.max(3, size * 0.22);
  const sats = [0, 60, 120, 180, 240, 300].map((deg, i) => {
    const r = (deg - 90) * Math.PI / 180;
    return <circle key={i} cx={12 + 7.5 * Math.cos(r)} cy={12 + 7.5 * Math.sin(r)} r="1.05" fill="#b7ccff"/>;
  });
  return (
    <div style={{
      width:size, height:size, borderRadius:radius,
      background:"linear-gradient(140deg,#2f6feb 0%,#0b1a3a 100%)",
      boxShadow:"inset 0 0 0 1px rgba(255,255,255,.14)",
      display:"grid", placeItems:"center", overflow:"hidden", flex:`0 0 ${size}px`,
      ...style,
    }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" style={{display:"block"}}>
        <circle cx="12" cy="12" r="7.5" stroke="rgba(255,255,255,.28)" strokeWidth="0.7" strokeDasharray="1.2 1.6"/>
        {sats}
        <circle cx="12" cy="12" r="3.2" fill="#fff"/>
        <circle cx="12" cy="12" r="1.3" fill="#2f6feb"/>
      </svg>
    </div>
  );
}

Object.assign(window, { Chip, SevChip, StatusChip, TypeIco, Seg, Icon, AgosGlyph, formatMoney, formatNum });
