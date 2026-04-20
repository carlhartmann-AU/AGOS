/* Marketing: dedicated /integrations page wrapper */

function IntegrationsPage({ go }) {
  return (
    <div>
      {/* HERO */}
      <section className="dark" style={{paddingTop:96, paddingBottom:48}}>
        <div className="wrap">
          <div className="section-eye"><span>INTEGRATIONS</span></div>
          <h2 style={{color:"#fff", fontSize:"clamp(36px,5vw,60px)", letterSpacing:"-0.03em", lineHeight:1.05, fontWeight:500, margin:"14px 0 18px", maxWidth:900, textWrap:"balance"}}>
            Plugs into the stack you already run.
          </h2>
          <p style={{fontSize:18, color:"var(--nav-ink)", maxWidth:680, margin:0, lineHeight:1.55}}>
            Shopify, your email platform, your attribution tool, your accounting. AGOS reads from them, reasons across them, and writes back through the approval queue. No data migration. No CSV exports. No new system of record.
          </p>
          <div style={{display:"flex", gap:10, marginTop:28, flexWrap:"wrap"}}>
            <a href="#" onClick={e=>e.preventDefault()} className="btn primary lg">Book a demo <Icon name="arrow"/></a>
            <a href="#" onClick={e=>e.preventDefault()} className="btn ghost lg">Request an integration</a>
          </div>
        </div>
      </section>

      {/* MAIN GRID + FLOW + BYO-LLM */}
      <IntegrationsSection/>

      <BigCTA/>
    </div>
  );
}

Object.assign(window, { IntegrationsPage });
