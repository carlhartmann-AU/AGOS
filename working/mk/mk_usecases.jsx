function UseCases({ go }) {
  const cases = [
    {
      tag:"HEALTH & WELLNESS · AU",
      n:"Plasmaide",
      t:"TGA compliance built in — not bolted on.",
      d:"Plasmaide sells pine bark extract in Australia. Every claim, every blog, every Meta ad is subject to TGA advertising rules. Before AGOS, compliance was a 40-page Notion doc. Now it runs inline on every piece of content.",
      st:[{v:"0",l:"TGA violations"},{v:"2.4×",l:"content volume"},{v:"91%",l:"stack cost ↓"}],
      mock:"dash",
    },
    {
      tag:"FMCG · CPG",
      n:"Folle",
      t:"Multi-SKU, multi-channel, one operating system.",
      d:"Folle runs dozens of SKUs across skin, hair, and body categories. The Content Strategy agent maps the editorial calendar to launches. Customer Intel clusters cohorts by skin type. CFO tracks contribution margin per SKU so campaigns chase the right ones.",
      st:[{v:"42",l:"active SKUs"},{v:"8",l:"channels synced"},{v:"38%",l:"approval rate ↑"}],
      mock:"studio",
    },
    {
      tag:"MULTI-BRAND PORTFOLIOS",
      n:"Portfolio operators",
      t:"Run three brands with the team of one.",
      d:"If you own a portfolio — founder-led brands, acquired DTCs, an FMCG holding — AGOS is the shared spine. Each brand carries its own voice, rule packs, and approval rotation. Customer Intel can be shared across the portfolio (opt-in) without cross-contaminating content.",
      st:[{v:"3",l:"brands / seat"},{v:"1",l:"invoice"},{v:"0",l:"context switches"}],
      mock:"approvals",
    },
    {
      tag:"REGULATED INDUSTRIES",
      n:"Financial services · medtech · alcohol",
      t:"Rule packs for industries where a missed claim is a recall.",
      d:"If your category is governed by an acronym — FDA, TGA, ACCC, ASIC, APRA, AFS — you need compliance as infrastructure. AGOS ships rule packs you can version, audit, and export for your own counsel to review. Every flag has a rule ID.",
      st:[{v:"100%",l:"audit coverage"},{v:"14",l:"rule packs"},{v:"< 1s",l:"inline check"}],
      mock:"settings",
    },
  ];
  const renderMock = (k) => k==="dash"?<MockDashboard/>:k==="studio"?<MockStudio/>:k==="approvals"?<MockApprovals/>:<MockSettings/>;
  return (
    <div>
      <section className="dark" style={{paddingTop:96,paddingBottom:60}}>
        <div className="wrap">
          <h2 style={{color:"#fff",fontSize:"clamp(36px,5vw,60px)",letterSpacing:"-0.03em",lineHeight:1.05,fontWeight:500,margin:"14px 0 14px",maxWidth:820,textWrap:"balance"}}>Built for the brands we actually run.</h2>
          <p style={{fontSize:18,color:"var(--nav-ink)",maxWidth:640,margin:0,lineHeight:1.55}}>AGOS started as the internal ops layer for Plasmaide and Folle. It handles the hard categories because it had to.</p>
        </div>
      </section>

      <section style={{paddingTop:56}}>
        <div className="wrap">
          <div style={{display:"flex",flexDirection:"column",gap:48}}>
            {cases.map((c,i)=>(
              <Reveal key={i}>
                <div style={{border:"1px solid var(--line)",borderRadius:14,background:"var(--panel)",overflow:"hidden",display:"grid",gridTemplateColumns:i%2===0?"1fr 1.2fr":"1.2fr 1fr"}}>
                  {i%2===0 && (
                    <div style={{padding:"40px 40px",borderRight:"1px solid var(--line)",display:"flex",flexDirection:"column",gap:16,background:"var(--panel-2)"}}>
                      <span className="mono" style={{fontSize:11,letterSpacing:".12em",color:"var(--ink-3)",padding:"3px 9px",background:"var(--panel)",border:"1px solid var(--line-3)",borderRadius:10,width:"fit-content"}}>{c.tag}</span>
                      <div style={{fontSize:13,color:"var(--ink-4)",fontFamily:"'Geist Mono',monospace",letterSpacing:".08em",textTransform:"uppercase"}}>{c.n}</div>
                      <h3 style={{margin:0,fontSize:28,letterSpacing:"-0.025em",fontWeight:500,lineHeight:1.15,textWrap:"balance"}}>{c.t}</h3>
                      <p style={{margin:0,color:"var(--ink-3)",fontSize:14,lineHeight:1.6}}>{c.d}</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:12,paddingTop:18,borderTop:"1px dashed var(--line-3)"}}>
                        {c.st.map((s,j)=>(
                          <div key={j}>
                            <div className="tnum" style={{fontSize:24,letterSpacing:"-0.015em",fontWeight:500}}>{s.v}</div>
                            <div style={{fontSize:10,color:"var(--ink-4)",letterSpacing:".12em",textTransform:"uppercase",fontFamily:"'Geist Mono',monospace",marginTop:2}}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{padding:28,background:"#fff",display:"grid",placeItems:"center"}}>
                    <div style={{width:"100%",maxWidth:520}}>
                      {renderMock(c.mock)}
                    </div>
                  </div>
                  {i%2===1 && (
                    <div style={{padding:"40px 40px",borderLeft:"1px solid var(--line)",display:"flex",flexDirection:"column",gap:16,background:"var(--panel-2)"}}>
                      <span className="mono" style={{fontSize:11,letterSpacing:".12em",color:"var(--ink-3)",padding:"3px 9px",background:"var(--panel)",border:"1px solid var(--line-3)",borderRadius:10,width:"fit-content"}}>{c.tag}</span>
                      <div style={{fontSize:13,color:"var(--ink-4)",fontFamily:"'Geist Mono',monospace",letterSpacing:".08em",textTransform:"uppercase"}}>{c.n}</div>
                      <h3 style={{margin:0,fontSize:28,letterSpacing:"-0.025em",fontWeight:500,lineHeight:1.15,textWrap:"balance"}}>{c.t}</h3>
                      <p style={{margin:0,color:"var(--ink-3)",fontSize:14,lineHeight:1.6}}>{c.d}</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:12,paddingTop:18,borderTop:"1px dashed var(--line-3)"}}>
                        {c.st.map((s,j)=>(
                          <div key={j}>
                            <div className="tnum" style={{fontSize:24,letterSpacing:"-0.015em",fontWeight:500}}>{s.v}</div>
                            <div style={{fontSize:10,color:"var(--ink-4)",letterSpacing:".12em",textTransform:"uppercase",fontFamily:"'Geist Mono',monospace",marginTop:2}}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <BigCTA/>
    </div>
  );
}
Object.assign(window, { UseCases });
