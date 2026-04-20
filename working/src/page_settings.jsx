function SettingsPage({ tweaks }) {
  const D = window.AGOS_DATA;
  const [tab, setTab] = useState("compliance");
  const [rules, setRules] = useState(D.rulePacks);
  const [sev, setSev] = useState({
    warn: "auto_fix",
    esc:  "escalate",
    bad:  "block",
  });

  const toggleRule = (key) => {
    setRules(r => r.map(x => x.key === key ? { ...x, on: !x.on } : x));
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-sub">Configure brand, compliance rule packs, integrations and team access.</div>
        </div>
        <div className="page-meta">
          <button className="brand-switcher" style={{background:"var(--panel)", border:"1px solid var(--line-3)", color:"var(--ink)"}}>
            <div className="brand-mark">Pl</div>
            <div className="stack">
              <div style={{color:"var(--ink)", fontSize:13}}>Plasmaide</div>
              <div className="mono" style={{color:"var(--ink-4)", fontSize:10}}>AU · PRIMARY</div>
            </div>
            <span style={{color:"var(--ink-4)", marginLeft:6}}><Icon name="chev"/></span>
          </button>
        </div>
      </div>

      <div className="set-tabs">
        {["compliance","integrations","team","brand"].map(t => (
          <button key={t} className={`set-tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "compliance" && (
        <div style={{display:"grid", gridTemplateColumns:"1fr 360px", gap:20}}>
          <div>
            <div className="section-head">
              <h2>Rule packs <span className="desc">· applied in order · stops at first block</span></h2>
              <button className="btn"><Icon name="plus"/> Custom rule</button>
            </div>
            <div className="card">
              {rules.map(r => (
                <div key={r.key} className="rule-row">
                  <div>
                    <div className="rname">{r.name}</div>
                    <div className="rdesc">{r.desc}</div>
                    <div className="tags">
                      {r.tags.map(t => <span key={t} className="chip mono" style={{height:18, fontSize:10}}>{t}</span>)}
                    </div>
                  </div>
                  <button className="btn ghost">Configure</button>
                  <label className="switch">
                    <input type="checkbox" checked={r.on} onChange={() => toggleRule(r.key)}/>
                    <span className="slider"/>
                  </label>
                </div>
              ))}
            </div>

            <div className="section-head" style={{marginTop:24}}>
              <h2>Severity actions <span className="desc">· what to do when a rule triggers</span></h2>
            </div>
            <div className="sev-matrix">
              <div className="hd">Severity</div>
              <div className="hd">Auto-fix</div>
              <div className="hd">Escalate</div>
              <div className="hd">Block</div>

              {[
                { k: "warn", lab: "Minor",    opts: [["auto_fix","AUTO"], ["escalate","ESC"], ["block","BLOCK"]] },
                { k: "esc",  lab: "Major",    opts: [["auto_fix","AUTO"], ["escalate","ESC"], ["block","BLOCK"]] },
                { k: "bad",  lab: "Critical", opts: [["auto_fix","AUTO"], ["escalate","ESC"], ["block","BLOCK"]] },
              ].map(row => (
                <React.Fragment key={row.k}>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <SevChip sev={row.k}>{row.lab.toUpperCase()}</SevChip>
                  </div>
                  {["auto_fix","escalate","block"].map(opt => (
                    <div key={opt} className="opt">
                      <button className={sev[row.k] === opt ? "on" : ""} onClick={() => setSev(s => ({...s, [row.k]: opt}))}>
                        {sev[row.k] === opt ? "✓ " : ""}{opt.toUpperCase()}
                      </button>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div>
            <div className="card">
              <div className="card-head"><h3>This week</h3><span className="chip mono"><span className="dot"/>8 installed rules</span></div>
              <div className="card-body">
                {[
                  { rule: "supplements/therapeutic-claim", count: 8,  sev: "esc" },
                  { rule: "marketing/absolutes",            count: 6, sev: "warn" },
                  { rule: "supplements/cosmetic-claim",     count: 4, sev: "bad" },
                  { rule: "marketing/guarantee",            count: 3, sev: "warn" },
                  { rule: "brand_voice/superlatives",       count: 3, sev: "warn" },
                ].map((r, i) => (
                  <div key={i} className="row" style={{padding:"8px 0", borderBottom: i < 4 ? "1px solid var(--line-2)" : 0, justifyContent:"space-between"}}>
                    <div className="row" style={{gap:10}}>
                      <SevChip sev={r.sev}/>
                      <span className="mono" style={{fontSize:12}}>{r.rule}</span>
                    </div>
                    <div className="mono tnum" style={{color:"var(--ink-3)", fontSize:12}}>{r.count}×</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{marginTop:16}}>
              <div className="card-head"><h3>Pack coverage</h3></div>
              <div className="card-body">
                <div className="mono" style={{fontSize:11, color:"var(--ink-3)", lineHeight:1.8}}>
                  <div className="row" style={{justifyContent:"space-between"}}><span>health_supplements_au</span><span className="tnum" style={{color:"var(--ok)"}}>3 / 3 rules</span></div>
                  <div className="row" style={{justifyContent:"space-between"}}><span>general_marketing</span><span className="tnum" style={{color:"var(--ok)"}}>4 / 4 rules</span></div>
                  <div className="row" style={{justifyContent:"space-between"}}><span>brand_voice</span><span className="tnum" style={{color:"var(--ok)"}}>1 / 1 rule</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "integrations" && <IntegrationsTab/>}

      {tab === "team" && (
        <div style={{maxWidth:840}}>
          <div className="section-head">
            <h2>Members <span className="desc">· {D.team.length} total · 2 human · 2 agents</span></h2>
            <button className="btn"><Icon name="plus"/> Invite</button>
          </div>
          <div className="card">
            {D.team.map((m, i) => (
              <div key={i} className="team-row">
                <div className="avatar-md" style={{background: m.role === "System" ? "var(--accent)" : "#3a4268"}}>{m.initials}</div>
                <div>
                  <div style={{fontWeight:500}}>{m.name}</div>
                  <div className="mono" style={{fontSize:11, color:"var(--ink-4)", marginTop:2}}>{m.email} · {m.tag}</div>
                </div>
                <SevChip sev={m.role === "Admin" ? "esc" : m.role === "Approver" ? "warn" : "ok"}>{m.role.toUpperCase()}</SevChip>
                <button className="btn ghost"><Icon name="dots"/></button>
              </div>
            ))}
          </div>

          <div className="card" style={{marginTop:20}}>
            <div className="card-head"><h3>Rotation schedule</h3></div>
            <div className="card-body">
              <div className="mono" style={{fontSize:12, color:"var(--ink-3)", lineHeight:2}}>
                <div className="row" style={{justifyContent:"space-between"}}><span>APPROVER · THIS WEEK</span><span style={{color:"var(--ink)"}}>Steve Whitby</span></div>
                <div className="row" style={{justifyContent:"space-between"}}><span>APPROVER · NEXT WEEK</span><span style={{color:"var(--ink)"}}>Carl Hartmann</span></div>
                <div className="row" style={{justifyContent:"space-between"}}><span>SLA · FIRST RESPONSE</span><span style={{color:"var(--ink)"}}>4 hours</span></div>
                <div className="row" style={{justifyContent:"space-between"}}><span>SLA · RESOLUTION</span><span style={{color:"var(--ink)"}}>24 hours</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "brand" && (
        <div style={{maxWidth:720}}>
          <div className="card">
            <div className="card-head"><h3>Brand</h3><span className="chip mono">2 total · 1 live</span></div>
            <div>
              {[
                { n: "Plasmaide", s: "AU · live · pine bark supplement", on: true, pr: "PRIMARY" },
                { n: "Folle",     s: "GB · pre-launch · target Q3",       on: false, pr: "STAGING" },
              ].map((b, i) => (
                <div key={i} className="integration-row">
                  <div className="integration-logo" style={{background: b.on ? "linear-gradient(140deg, #2f6feb 0%, #0b1a3a 100%)" : "var(--line-2)", color: b.on ? "#fff" : "var(--ink-3)"}}>
                    {b.n.slice(0,2)}
                  </div>
                  <div>
                    <div className="n">{b.n}</div>
                    <div className="s">{b.s}</div>
                  </div>
                  <Chip kind={b.on ? "ok" : ""}>{b.pr}</Chip>
                  <button className="btn">{b.on ? "Manage" : "Activate"}</button>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{marginTop:16}}>
            <div className="card-head"><h3>Plasmaide details</h3></div>
            <div className="card-body">
              <div className="kv">
                <div className="k">Domain</div>    <div className="v mono">plasmaide.com</div>
                <div className="k">Locale</div>    <div className="v">en-AU · en-US</div>
                <div className="k">Currency</div>  <div className="v">AUD (primary) · USD · GBP · EUR</div>
                <div className="k">Regulator</div> <div className="v">TGA (AU) · FDA (US)</div>
                <div className="k">Category</div>  <div className="v">Health supplement · standalone SKU</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.SettingsPage = SettingsPage;
