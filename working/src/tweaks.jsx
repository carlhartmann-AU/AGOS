function TweaksPanel({ tweaks, setTweaks }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === "__activate_edit_mode") setOpen(true);
      if (e.data?.type === "__deactivate_edit_mode") setOpen(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const update = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*"); } catch {}
  };

  if (!open) return null;

  return (
    <div className="tweaks-panel">
      <div className="hdr">
        <span>Tweaks</span>
        <button className="btn ghost" style={{height:20, padding:"0 6px"}} onClick={() => setOpen(false)}><Icon name="x"/></button>
      </div>
      <div className="grp">
        <div className="gl">Density</div>
        <div className="opts">
          {["compact","cozy","comfortable"].map(d => (
            <button key={d} className={tweaks.density === d ? "on" : ""} onClick={() => update("density", d)}>{d}</button>
          ))}
        </div>
      </div>
      <div className="grp">
        <div className="gl">Accent color</div>
        <div className="opts">
          {["blue","violet","green","amber"].map(a => (
            <button key={a} className={tweaks.accent === a ? "on" : ""} onClick={() => update("accent", a)}>{a}</button>
          ))}
        </div>
      </div>
      <div className="grp">
        <div className="gl">Chart style</div>
        <div className="opts">
          {["area","line","bars"].map(c => (
            <button key={c} className={tweaks.chartStyle === c ? "on" : ""} onClick={() => update("chartStyle", c)}>{c}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

window.TweaksPanel = TweaksPanel;
