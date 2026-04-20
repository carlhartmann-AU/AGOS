function Features({ go }) {
  const agents = [
    {ic:"brain",n:"Digital COO",d:"Plans the week from last week's data. Routes work. Surfaces what needs a human.",tag:"ORCH"},
    {ic:"brush",n:"Content Strategy",d:"Maps editorial calendar against SKU launches, seasons, and topic authority gaps.",tag:"CNT-01"},
    {ic:"zap",n:"Campaign Execution",d:"Ships email, SMS, and social. Respects send-time guardrails and brand voice.",tag:"CMP-02"},
    {ic:"shield",n:"Compliance",d:"Runs rule packs (TGA, ACCC, FDA, brand). Flags at Warning, Escalate, Block severities.",tag:"CMP-03"},
    {ic:"chart",n:"Performance Analytics",d:"Unifies Shopify, Meta, Google, Klaviyo into one pulse. Replaces Triple Whale.",tag:"ANL-04"},
    {ic:"coin",n:"CFO",d:"CAC, LTV, payback, contribution margin by SKU. The numbers that actually matter.",tag:"FIN-05"},
    {ic:"brush",n:"Web Designer",d:"PDP variants, landing page tests, hero swaps. Ships to staging, you click merge.",tag:"WEB-06"},
    {ic:"mail",n:"B2B Outreach",d:"Wholesale, media, influencer lists. Drafts the pitch. Never sends without you.",tag:"B2B-07"},
    {ic:"star",n:"Review Harvester",d:"Monitors reviews across Okendo, Trustpilot, Amazon. Triages and drafts replies.",tag:"REV-08"},
    {ic:"people",n:"Customer Intel",d:"Clusters cohorts by LTV, skin type, repeat pattern. Feeds Campaign agent.",tag:"INT-09"},
    {ic:"chat",n:"Customer Service",d:"Handles tier-1 support across email + chat. Escalates what needs you.",tag:"SRV-10"},
    {ic:"spark",n:"Intelligence",d:"Scans competitor launches, ingredient trends, regulatory changes. Weekly digest.",tag:"SIG-11"},
  ];
  return (
    <div>
      <section className="dark" style={{paddingTop:96}}>
        <div className="wrap">
          <h2 style={{color:"#fff",fontSize:"clamp(36px,5vw,60px)",letterSpacing:"-0.03em",lineHeight:1.05,fontWeight:500,margin:"14px 0 18px",maxWidth:880,textWrap:"balance"}}>AI generates. Compliance checks. You approve. It publishes.</h2>
          <p style={{fontSize:18,color:"var(--nav-ink)",maxWidth:640,margin:0,lineHeight:1.55}}>Four steps, same every time. No agent ever ships to your customers without a human signoff on anything that carries brand or legal risk.</p>
        </div>
      </section>

      {/* FLOW */}
      <section style={{paddingTop:48}}>
        <div className="wrap">
          <div className="flow">
            {[
              {n:"01",t:"Generate",d:"The Content Engine drafts across formats — blog, email, social, PDP — using your brand voice, SKU facts, and calendar priorities.",tag:"Content Engine",agent:"agent"},
              {n:"02",t:"Compliance check",d:"Rule packs run inline. TGA, ACCC, cosmetic claims, brand voice. Flags at Warning, Escalate, or Block severity.",tag:"Compliance Agent",agent:"agent"},
              {n:"03",t:"Human approves",d:"Your queue, your call. Inline suggested fixes. Bulk approve clean items, click into the flagged ones.",tag:"You · in the loop",agent:"human"},
              {n:"04",t:"Auto-publish",d:"Approved content ships to Shopify, Klaviyo, Meta, Gorgias macros — wherever it belongs. Campaign Execution handles the distribution.",tag:"Campaign Execution",agent:"agent"},
            ].map((s,i)=>(
              <div key={i} className="flow-step">
                <div className="n">STEP {s.n}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
                <div className={`agent ${s.agent==="human"?"human":""}`}>{s.agent==="human"?"◐":"◉"} {s.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPLIANCE + APPROVALS SHOWCASE */}
      <section style={{background:"var(--panel-2)"}}>
        <div className="wrap">
          <div className="section-head">
          <h2>Rule packs on the left. Approvals queue on the right.</h2>
            <p>Compliance is not a document someone forgets to read. It's a versioned, installed rule pack that runs on every piece of content before it reaches your queue.</p>
          </div>
          <div className="ss-showcase">
            <Reveal><div className="ss-card">
              <div className="ss-head">
                <div><h4>Rule packs · Settings</h4><p>Install packs for your jurisdiction. Toggle, version, and audit.</p></div>
                <span className="mono">/settings</span>
              </div>
              <div className="ss-body" style={{padding:20}}><MockSettings/></div>
            </div></Reveal>
            <Reveal delay={80}><div className="ss-card">
              <div className="ss-head">
                <div><h4>Approvals · split view</h4><p>Flag on the left, content on the right. One click decision.</p></div>
                <span className="mono">/approvals</span>
              </div>
              <div className="ss-body" style={{padding:20}}><MockApprovals/></div>
            </div></Reveal>
          </div>
        </div>
      </section>

      {/* 12 AGENTS */}
      <section>
        <div className="wrap">
          <div className="section-head">
          <h2>Each one has a narrow remit and a shared memory of your brand.</h2>
            <p>Agents are boring in isolation and extraordinary together. That's the design.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
            {agents.map((a,i)=>(
              <div key={i} style={{border:"1px solid var(--line)",borderRadius:10,padding:22,background:"var(--panel)",display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:7,background:"var(--accent-bg)",color:"var(--accent)",display:"grid",placeItems:"center",border:"1px solid var(--accent-line)"}}>
                    <Icon name={a.ic} size={16}/>
                  </div>
                  <div style={{fontSize:15,fontWeight:500,letterSpacing:"-0.01em",flex:1}}>{a.n}</div>
                </div>
                <p style={{margin:0,fontSize:13,color:"var(--ink-3)",lineHeight:1.55}}>{a.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <IntegrationsSection/>

      {/* MULTI-BRAND */}
      <section className="dark">
        <div className="wrap">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:48,alignItems:"center"}}>
            <div>
          <h2 style={{color:"#fff",fontSize:"clamp(30px,4vw,44px)",letterSpacing:"-0.025em",lineHeight:1.05,fontWeight:500,margin:"14px 0 14px"}}>Multiple brands, one login.</h2>
              <p style={{fontSize:16,color:"var(--nav-ink)",lineHeight:1.6,marginBottom:18}}>Switch brands from the sidebar lockup. Each brand carries its own voice, calendar, compliance packs, and approval rotation. One bill. One team. Zero context-swapping.</p>
              <ul style={{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column",gap:10,color:"var(--nav-ink)"}}>
                <li style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{color:"#6dd9a7",marginTop:2}}><Icon name="check"/></span><span>Per-brand rule packs, voice, and topic authority graph</span></li>
                <li style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{color:"#6dd9a7",marginTop:2}}><Icon name="check"/></span><span>Shared customer-intel across a brand portfolio (opt-in)</span></li>
                <li style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{color:"#6dd9a7",marginTop:2}}><Icon name="check"/></span><span>Role-based approval per brand</span></li>
              </ul>
            </div>
            <Reveal><div style={{border:"1px solid var(--nav-line)",borderRadius:12,background:"#0b1020",padding:14,boxShadow:"0 40px 80px -30px rgba(0,0,0,.6)"}}>
              <div style={{background:"#fff",borderRadius:8,overflow:"hidden"}}>
                <MockDashboard/>
              </div>
            </div></Reveal>
          </div>
        </div>
      </section>

      <BigCTA/>
    </div>
  );
}
Object.assign(window, { Features });
