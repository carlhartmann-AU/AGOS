function Sidebar({ page, setPage, counts }) {
  const items = [
    { key: "dashboard",    label: "Dashboard",       icon: "dash" },
    { key: "studio",       label: "Content Studio",  icon: "studio", count: counts.pending },
    { key: "approvals",    label: "Approvals",       icon: "approve", count: counts.approvals },
    { key: "intelligence", label: "Intelligence",    icon: "doc" },
    { key: "agents",       label: "Agents",          icon: "zap", count: counts.agentsEsc },
    { key: "financial",    label: "Financial",       icon: "chart" },
    { key: "settings",     label: "Settings",        icon: "settings" },
  ];
  return (
    <aside className="nav">
      <div className="nav-brand">
        <div className="nav-brand-top">
          <AgosGlyph size={22}/>
          <div style={{display:"flex",flexDirection:"column",lineHeight:1.1,gap:2}}>
            <span style={{fontSize:12,letterSpacing:"-0.01em",color:"#fff",fontWeight:500,textTransform:"none"}}>AGOS</span>
            <span style={{fontSize:9,letterSpacing:"0.14em",color:"var(--nav-ink-3)"}}>AUTONOMOUS GROWTH OS</span>
          </div>
        </div>
        <button className="brand-switcher">
          <div className="brand-mark">Pl</div>
          <div className="stack" style={{flex:1, minWidth:0}}>
            <div className="brand-name">Plasmaide</div>
            <div className="brand-sub mono">AU · PRIMARY BRAND</div>
          </div>
          <span className="caret"><Icon name="chev"/></span>
        </button>
      </div>

      <div className="nav-section-label">Workspace</div>
      <div className="nav-items">
        {items.map(it => (
          <button
            key={it.key}
            className={`nav-item ${page === it.key ? "active" : ""}`}
            onClick={() => setPage(it.key)}
          >
            <Icon name={it.icon}/> <span>{it.label}</span>
            {typeof it.count === "number" && it.count > 0 && <span className="count mono">{it.count}</span>}
          </button>
        ))}
      </div>

      <div className="nav-footer">
        <div className="nav-user">
          <div className="avatar">CH</div>
          <div className="stack" style={{flex:1, minWidth:0}}>
            <div style={{color:"#f0f2fa", fontSize:12}}>Carl Hartmann</div>
            <div style={{color:"var(--nav-ink-3)", fontSize:10}} className="mono">ADMIN · carl@plasmaide.com</div>
          </div>
        </div>
        <div className="nav-sync">
          <span>LAST SYNC · 18h ago</span>
          <span className="pulse"/>
        </div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
