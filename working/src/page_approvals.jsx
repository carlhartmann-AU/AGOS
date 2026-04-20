function ApprovalsPage({ tweaks }) {
  const D = window.AGOS_DATA;
  const [queue, setQueue] = useState("content");
  const [sel, setSel] = useState("ap_501");
  const [filter, setFilter] = useState("all");

  const content = D.approvals.filter(a => a.kind === "content");
  const finance = D.approvals.filter(a => a.kind === "finance");
  const items = queue === "content" ? content : finance;
  const current = D.approvals.find(a => a.id === sel) || items[0];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Approvals</h1>
          <div className="page-sub">Queue of actions awaiting human sign-off · Steve is on-rotation this week.</div>
        </div>
        <div className="page-meta">
          <Chip kind="warn"><span className="dot"/> SLA · 4 items aging {'>'} 12h</Chip>
          <button className="btn ghost"><Icon name="filter"/> Filters</button>
          <button className="btn"><Icon name="check"/> Bulk approve</button>
        </div>
      </div>

      <div className="appr">
        <div className="appr-list">
          <div className="appr-tabs">
            <button className={`appr-tab ${queue === "content" ? "on" : ""}`} onClick={() => { setQueue("content"); setSel(content[0].id); }}>
              Content <span className="count mono">{content.length}</span>
            </button>
            <button className={`appr-tab ${queue === "finance" ? "on" : ""}`} onClick={() => { setQueue("finance"); setSel(finance[0].id); }}>
              Financial <span className="count mono">{finance.length}</span>
            </button>
          </div>
          <div className="appr-filters">
            {["all","pending","escalated","flagged"].map(f => (
              <button key={f} className={`chip mono ${filter === f ? "accent" : ""}`} onClick={() => setFilter(f)} style={{border: filter === f ? undefined : "1px solid var(--line-3)", cursor:"pointer"}}>
                {f.toUpperCase()}
              </button>
            ))}
            <span className="spacer"/>
            <span className="mono" style={{fontSize:10, color:"var(--ink-4)", alignSelf:"center"}}>sort: oldest ▾</span>
          </div>
          <div className="appr-queue">
            {items.map(it => {
              const sev = it.flags[0]?.sev;
              const typeLabel = it.type.toUpperCase();
              return (
                <div key={it.id} className={`appr-item ${sel === it.id ? "sel" : ""}`} onClick={() => setSel(it.id)}>
                  <div className="t">{it.title}</div>
                  <div className="r">
                    <span className="mono">{it.id}</span>
                    <span>·</span>
                    <span className="mono">{typeLabel}</span>
                    <span>·</span>
                    <span>{it.created}</span>
                  </div>
                  <div className="flags">
                    {it.flags.length === 0 ? (
                      <SevChip sev="ok">CLEAN</SevChip>
                    ) : it.flags.map((f, i) => (
                      <SevChip key={i} sev={f.sev}>{f.rule}</SevChip>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="appr-detail">
          {current && (
            <>
              <div className="appr-detail-head">
                <div>
                  <div className="mono" style={{fontSize:10, color:"var(--ink-4)", letterSpacing:"0.14em"}}>{current.type.toUpperCase()} · {current.id}</div>
                  <h2 style={{marginTop:4}}>{current.title}</h2>
                  <div className="appr-detail-meta">
                    <span>Created {current.created}</span>
                    <span>·</span>
                    <span>By {current.author}</span>
                    <span>·</span>
                    <span>{current.flags.length} flag{current.flags.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <div className="appr-actions">
                  <button className="btn danger"><Icon name="x"/> Reject</button>
                  <button className="btn">Request changes</button>
                  <button className="btn primary"><Icon name="check"/> Approve</button>
                </div>
              </div>

              <div className="appr-detail-body">
                <div>
                  <div className="detail-body-card">
                    <h4>Content preview</h4>
                    <div className="content" style={{whiteSpace:"pre-wrap", fontFamily: current.kind === "finance" ? "'Geist Mono', monospace" : "inherit", fontSize: current.kind === "finance" ? 12 : 13}}>
                      {current.body}
                    </div>
                  </div>

                  <div style={{marginTop:16}}>
                    <div className="section-head">
                      <h2>Why flagged <span className="desc">· {current.flags.length} rule{current.flags.length === 1 ? "" : "s"}</span></h2>
                    </div>
                    {current.flags.length === 0 ? (
                      <div className="empty">
                        <div className="glyph">✓</div>
                        <div className="h">No compliance flags</div>
                        <div>All enabled rule packs passed on this draft.</div>
                      </div>
                    ) : current.flags.map((f, i) => (
                      <div key={i} className="flag-row">
                        <div className="fh">
                          <div>
                            <div className="rn">{f.name}</div>
                            <div className="rule">{f.rule}</div>
                          </div>
                          <SevChip sev={f.sev}/>
                        </div>
                        <div className="snippet"><mark>{f.snippet}</mark></div>
                        <div className="fix">FIX · {f.suggestion}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="detail-body-card">
                    <h4>Metadata</h4>
                    <div className="content">
                      <div className="kv">
                        <div className="k">ID</div>      <div className="v mono">{current.id}</div>
                        <div className="k">Type</div>    <div className="v">{current.type}</div>
                        <div className="k">Author</div>  <div className="v mono">{current.author}</div>
                        <div className="k">Created</div> <div className="v">{current.created}</div>
                        <div className="k">Brand</div>   <div className="v">Plasmaide</div>
                        <div className="k">Region</div>  <div className="v">AU / US</div>
                        <div className="k">Status</div>  <div className="v"><StatusChip status={current.status}/></div>
                      </div>
                    </div>
                  </div>

                  <div className="detail-body-card" style={{marginTop:16}}>
                    <h4>Activity</h4>
                    <div className="content">
                      {[
                        { t: "Today 11:48", a: "agent-writer-03", m: "Draft generated" },
                        { t: "Today 11:49", a: "compliance", m: "TGA-001 triggered" },
                        { t: "Today 11:49", a: "compliance", m: "COPY-044 triggered" },
                        { t: "Today 11:49", a: "system", m: "Queued for approval" },
                      ].map((e, i) => (
                        <div key={i} className="row" style={{padding:"6px 0", borderBottom: i < 3 ? "1px solid var(--line-2)" : 0, fontSize:12}}>
                          <div className="mono" style={{color:"var(--ink-4)", fontSize:11, width:80}}>{e.t}</div>
                          <div className="mono" style={{color:"var(--ink-3)", fontSize:11, width:120}}>{e.a}</div>
                          <div style={{color:"var(--ink-2)"}}>{e.m}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.ApprovalsPage = ApprovalsPage;
