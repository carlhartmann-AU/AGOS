function App() {
  const [page, setPage] = useState(() => localStorage.getItem("agos.page") || "dashboard");
  const [tweaks, setTweaks] = useState(window.__TWEAKS__);

  useEffect(() => { localStorage.setItem("agos.page", page); }, [page]);

  useEffect(() => {
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.dataset.accent = tweaks.accent;
  }, [tweaks]);

  const counts = {
    pending:   window.AGOS_DATA.contentItems.filter(c => c.status === "pending").length,
    approvals: window.AGOS_DATA.approvals.filter(a => a.status === "pending").length,
    alerts:    window.AGOS_DATA.alerts.filter(a => a.sev !== "ok").length,
    agentsEsc: 3,
  };

  const crumbMap = {
    dashboard:    ["Plasmaide", "Mission control"],
    studio:       ["Plasmaide", "Content", "Studio"],
    approvals:    ["Plasmaide", "Approvals"],
    intelligence: ["Plasmaide", "Intelligence"],
    agents:       ["Plasmaide", "Agents"],
    financial:    ["Plasmaide", "Financial"],
    settings:     ["Plasmaide", "Settings"],
  };
  const crumbs = crumbMap[page];

  return (
    <div className="app" data-screen-label={page}>
      <Sidebar page={page} setPage={setPage} counts={counts}/>
      <main className="main">
        <div className="topbar">
          <div className="crumbs">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                <span className={i === crumbs.length - 1 ? "now" : ""}>{c}</span>
                {i < crumbs.length - 1 && <span className="sep">/</span>}
              </React.Fragment>
            ))}
          </div>
          <div className="topbar-right">
            <button className="btn ghost" style={{gap:8}}>
              <Icon name="search"/>
              <span style={{color:"var(--ink-4)"}}>Search</span>
              <span className="kbd mono">⌘K</span>
            </button>
            <button className="btn ghost"><Icon name="bell"/><span className="mono tnum" style={{fontSize:11, color:"var(--ink-3)"}}>{counts.alerts}</span></button>
            <div style={{width:1, height:20, background:"var(--line)"}}/>
            <div className="row" style={{gap:6}}>
              <div style={{width:22, height:22, borderRadius:"50%", background:"#3a4268", color:"#fff", display:"grid", placeItems:"center", fontSize:10, fontWeight:500}}>CH</div>
            </div>
          </div>
        </div>

        {page === "dashboard" && <DashboardPage tweaks={tweaks}/>}
        {page === "studio"    && <StudioPage    tweaks={tweaks}/>}
        {page === "approvals"    && <ApprovalsPage    tweaks={tweaks}/>}
        {page === "intelligence" && <IntelligencePage tweaks={tweaks}/>}
        {page === "agents"       && <AgentsPage       tweaks={tweaks}/>}
        {page === "financial"    && <FinancialPage    tweaks={tweaks}/>}
        {page === "settings"     && <SettingsPage     tweaks={tweaks}/>}
      </main>
      <TweaksPanel tweaks={tweaks} setTweaks={setTweaks}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
