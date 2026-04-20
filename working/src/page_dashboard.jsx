function KPITile({ label, value, unit, delta, spark, meta, loading, chartStyle }) {
  if (loading) {
    return (
      <div className="kpi-tile">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value"><div className="skel" style={{height:24, width:100, marginTop:4}}/></div>
        <div className="skel" style={{height:12, width:60, marginTop:6}}/>
        <div className="skel" style={{height:36, marginTop:8}}/>
      </div>
    );
  }
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  return (
    <div className="kpi-tile">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value tnum">
        {value}{unit && <span className="unit">{unit}</span>}
      </div>
      <div>
        <span className={`kpi-delta ${dir}`}>{arrow} {Math.abs(delta).toFixed(1)}%</span>
        <span className="kpi-meta mono">{meta}</span>
      </div>
      <div className="kpi-spark"><Sparkline data={spark} height={36} style={chartStyle}/></div>
    </div>
  );
}

function DashboardPage({ tweaks }) {
  const D = window.AGOS_DATA;
  const [win, setWin] = useState("7d");
  const [cur, setCur] = useState("AUD");
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState("18h ago");
  const [syncError, setSyncError] = useState(false);

  const base = D.kpisBase[win];
  const del = D.deltas[win];

  const handleRefresh = () => {
    setLoading(true);
    setSyncError(false);
    setTimeout(() => {
      setLoading(false);
      setLastSync("just now");
    }, 1400);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Mission control</h1>
          <div className="page-sub">Plasmaide · Growth telemetry across Shopify, DotDigital, Triple Whale, Xero and Gorgias.</div>
        </div>
        <div className="page-meta">
          <Chip kind={syncError ? "bad" : "ok"} mono>
            <span className="dot"/> LAST SYNC · {lastSync}
          </Chip>
          <button className="btn" onClick={handleRefresh} disabled={loading}>
            <Icon name="refresh"/> {loading ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </div>

      {syncError && (
        <div className="err-banner">
          <Icon name="x" size={14}/>
          <strong>Shopify sync failed</strong>
          <span className="mono">· api.shopify.com returned 503 · retry scheduled 02:14</span>
          <span className="spacer"/>
          <button className="btn">Retry now</button>
        </div>
      )}

      {/* Store performance */}
      <div className="section-head">
        <h2>Store performance <span className="desc">· kpi / trend · {win} · {cur}</span></h2>
        <div className="row">
          <Seg options={["24h","7d","30d","MTD"]} value={win} onChange={setWin}/>
          <Seg options={["AUD","USD","GBP","EUR"]} value={cur} onChange={setCur}/>
        </div>
      </div>

      <div className="kpi-grid mb-16">
        <KPITile label="Revenue"       value={formatMoney(base.revenue, cur)}             delta={del.revenue} spark={D.sparks.revenue[win]} meta={`vs prev ${win}`} loading={loading} chartStyle={tweaks.chartStyle}/>
        <KPITile label="Orders"        value={formatNum(base.orders)}                     delta={del.orders}  spark={D.sparks.orders[win]}  meta={`vs prev ${win}`} loading={loading} chartStyle={tweaks.chartStyle}/>
        <KPITile label="AOV"           value={formatMoney(base.aov, cur)}                 delta={del.aov}     spark={D.sparks.aov[win]}     meta={`vs prev ${win}`} loading={loading} chartStyle={tweaks.chartStyle}/>
        <KPITile label="New customers" value={formatNum(base.newCust)}                    delta={del.newCust} spark={D.sparks.newCust[win]} meta={`vs prev ${win}`} loading={loading} chartStyle={tweaks.chartStyle}/>
      </div>

      <div className="dash">
        <div className="dash-main">
          {/* Content pipeline */}
          <div>
            <div className="section-head">
              <h2>Content pipeline <span className="desc">· last 30 days</span></h2>
              <button className="btn ghost">View all<Icon name="chevR"/></button>
            </div>
            <div className="stat-row mb-12">
              <div className="stat-cell">
                <div className="stat-label">Generated</div>
                <div className="stat-value tnum">{D.contentStats.generated}</div>
                <div className="stat-sub">by 4 agents</div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Pending review</div>
                <div className="stat-value tnum" style={{color:"var(--warn)"}}>{D.contentStats.pending}</div>
                <div className="stat-sub">oldest · 14h</div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Published</div>
                <div className="stat-value tnum" style={{color:"var(--ok)"}}>{D.contentStats.published}</div>
                <div className="stat-sub">incl. 42 scheduled</div>
              </div>
              <div className="stat-cell">
                <div className="stat-label">Approval rate</div>
                <div className="stat-value tnum">{D.contentStats.approvalRate}<span className="kpi-meta" style={{fontSize:13}}>%</span></div>
                <div className="stat-sub">↑ 3.2% vs March</div>
              </div>
            </div>

            <div className="card">
              <div className="list-head">
                <div></div>
                <div>Title</div>
                <div>Type</div>
                <div>Status</div>
                <div>Words</div>
                <div></div>
              </div>
              <div className="list">
                {D.contentItems.map(it => (
                  <div key={it.id} className="list-row">
                    <TypeIco type={it.type}/>
                    <div className="stack" style={{minWidth:0}}>
                      <div className="title">{it.title}</div>
                      <div className="sub">{it.id} · {it.date}</div>
                    </div>
                    <div className="mono" style={{color:"var(--ink-3)", textTransform:"uppercase", fontSize:11}}>{it.type}</div>
                    <div><StatusChip status={it.status}/></div>
                    <div className="mono tnum" style={{color:"var(--ink-3)"}}>{it.words}</div>
                    <div style={{color:"var(--ink-5)"}}><Icon name="chevR"/></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="dash-side">
          <div className="card">
            <div className="card-head">
              <h3>Active alerts</h3>
              <span className="chip mono"><span className="dot"/>{D.alerts.length} open</span>
            </div>
            <div>
              {D.alerts.map(a => (
                <div key={a.id} className="alert-row">
                  <div className={`bar ${a.sev}`}/>
                  <div className="stack" style={{minWidth:0}}>
                    <div className="title">{a.title}</div>
                    <div className="meta">
                      <span className="mono">{a.source.toUpperCase()}</span>
                      <span>·</span>
                      <span className="mono">{a.age}</span>
                      <span>·</span>
                      <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:220}}>{a.detail}</span>
                    </div>
                  </div>
                  <div className="actions">
                    <button className="btn ghost" title="Dismiss"><Icon name="x"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Agent activity</h3>
              <span className="chip mono ok"><span className="dot"/>4 active</span>
            </div>
            <div style={{padding:"4px 0"}}>
              {[
                { n: "agent-writer-01", t: "Drafting blog · pine bark + sleep", p: 62 },
                { n: "agent-writer-02", t: "Email generation · May promo", p: 88 },
                { n: "agent-writer-03", t: "Social pack · 5 posts", p: 34 },
                { n: "agent-growth",    t: "Analysing Meta Ads creative 14", p: 71 },
              ].map((a, i) => (
                <div key={i} style={{padding:"10px 14px", borderBottom: i < 3 ? "1px solid var(--line-2)" : "0"}}>
                  <div className="row" style={{justifyContent:"space-between"}}>
                    <div className="mono" style={{fontSize:11, color:"var(--ink-2)"}}>{a.n}</div>
                    <div className="mono" style={{fontSize:10, color:"var(--ink-4)"}}>{a.p}%</div>
                  </div>
                  <div style={{fontSize:12, color:"var(--ink-3)", margin:"3px 0 6px"}}>{a.t}</div>
                  <div style={{height:3, background:"var(--line-2)", borderRadius:2, overflow:"hidden"}}>
                    <div style={{height:"100%", width:`${a.p}%`, background:"var(--accent)"}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.DashboardPage = DashboardPage;
