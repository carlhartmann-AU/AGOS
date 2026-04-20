// Financial page — placeholder (Phase 3, CFO agent)

function FinancialPage({ tweaks }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Financial</h1>
          <div className="page-sub">P&L, unit economics, and financial approval queue · powered by the CFO agent.</div>
        </div>
        <div className="page-meta">
          <Chip mono><span className="dot"/> PHASE 3</Chip>
          <button className="btn"><Icon name="doc"/> Roadmap</button>
        </div>
      </div>

      <div className="phase-banner">
        <div className="phase-ico"><Icon name="zap" size={18}/></div>
        <div className="stack" style={{flex:1}}>
          <div style={{fontSize:14, fontWeight:500, color:"var(--ink)"}}>Coming in Phase 3 · CFO Agent</div>
          <div style={{fontSize:12, color:"var(--ink-3)", marginTop:3}}>
            Connects to Xero and Shopify. Reconciles spend against marketing actions. Flags moves that breach policy before they ship.
          </div>
        </div>
        <div className="row" style={{gap:6}}>
          <button className="btn">Request early access</button>
          <button className="btn primary">Notify me</button>
        </div>
      </div>

      <div className="section-head">
        <h2>What this page will contain</h2>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, opacity:0.55}}>
        {/* P&L card (stub) */}
        <div className="card">
          <div className="card-head">
            <h3>Profit & Loss · MTD</h3>
            <span className="chip mono"><span className="dot"/>PLACEHOLDER</span>
          </div>
          <div className="card-body">
            <div className="kv" style={{gridTemplateColumns:"140px 1fr 80px", rowGap:8, fontSize:12}}>
              <div className="k">Revenue</div>        <div className="v mono tnum">AU$ ——,———</div>  <div className="mono" style={{color:"var(--ink-4)",textAlign:"right"}}>—.—%</div>
              <div className="k">COGS</div>           <div className="v mono tnum">AU$ ——,———</div>  <div className="mono" style={{color:"var(--ink-4)",textAlign:"right"}}>—.—%</div>
              <div className="k">Gross profit</div>   <div className="v mono tnum">AU$ ——,———</div>  <div className="mono" style={{color:"var(--ink-4)",textAlign:"right"}}>—.—%</div>
              <div className="k">Ad spend</div>       <div className="v mono tnum">AU$ ——,———</div>  <div className="mono" style={{color:"var(--ink-4)",textAlign:"right"}}>—.—%</div>
              <div className="k">Operating income</div><div className="v mono tnum">AU$ ——,———</div> <div className="mono" style={{color:"var(--ink-4)",textAlign:"right"}}>—.—%</div>
            </div>
          </div>
        </div>

        {/* Unit economics (stub) */}
        <div className="card">
          <div className="card-head">
            <h3>Unit economics</h3>
            <span className="chip mono"><span className="dot"/>PLACEHOLDER</span>
          </div>
          <div className="card-body">
            <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0, textAlign:"left"}}>
              {[
                { l: "CAC",      v: "AU$——" },
                { l: "LTV",      v: "AU$——" },
                { l: "LTV:CAC",  v: "—.—x" },
                { l: "Payback",  v: "—.— mo" },
              ].map((x, i) => (
                <div key={i} style={{padding:"12px 14px", borderRight: i < 3 ? "1px solid var(--line)" : 0}}>
                  <div className="mono" style={{fontSize:10, letterSpacing:".12em", textTransform:"uppercase", color:"var(--ink-4)"}}>{x.l}</div>
                  <div className="tnum" style={{fontSize:20, fontWeight:500, color:"var(--ink-3)", marginTop:4}}>{x.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Xero sync (stub) */}
        <div className="card">
          <div className="card-head">
            <h3>Xero sync</h3>
            <span className="chip mono"><span className="dot"/>NOT CONNECTED</span>
          </div>
          <div className="card-body">
            <div className="mono" style={{fontSize:11, color:"var(--ink-4)", lineHeight:1.8}}>
              <div className="row" style={{justifyContent:"space-between"}}><span>LAST SYNC</span><span>—</span></div>
              <div className="row" style={{justifyContent:"space-between"}}><span>INVOICES</span><span>—</span></div>
              <div className="row" style={{justifyContent:"space-between"}}><span>BILLS</span><span>—</span></div>
              <div className="row" style={{justifyContent:"space-between"}}><span>RECONCILIATION</span><span>—</span></div>
            </div>
          </div>
        </div>

        {/* Approval queue (stub) */}
        <div className="card">
          <div className="card-head">
            <h3>Financial approvals</h3>
            <span className="chip mono"><span className="dot"/>PLACEHOLDER</span>
          </div>
          <div className="card-body" style={{padding:0}}>
            {[
              { t: "Budget reallocation · Meta → Google", sub: "AU$1,200 · exceeds AU$1,000 policy cap" },
              { t: "Campaign launch · Autumn Taper",      sub: "AU$3,400 planned · awaiting CFO sign-off" },
              { t: "Agency retainer renewal",              sub: "AU$2,800 / mo · quarterly review due" },
            ].map((x, i) => (
              <div key={i} style={{padding:"10px 14px", borderBottom: i < 2 ? "1px solid var(--line-2)" : 0, fontSize:12}}>
                <div style={{fontWeight:500, color:"var(--ink-3)"}}>{x.t}</div>
                <div className="mono" style={{fontSize:11, color:"var(--ink-4)", marginTop:2}}>{x.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.FinancialPage = FinancialPage;
