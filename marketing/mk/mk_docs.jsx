function Docs({ go }) {
  return (
    <div>
      {/* HERO */}
      <section className="dark" style={{paddingTop:88, paddingBottom:48}}>
        <div className="wrap">
          <div className="eyebrow" style={{marginBottom:18}}>
            <span className="dot"/>
            <span>DOCS · GETTING STARTED</span>
            <span className="pill">v1.0</span>
          </div>
          <h1 style={{color:"#fff",fontSize:"clamp(36px,5vw,60px)",letterSpacing:"-0.03em",lineHeight:1.05,fontWeight:500,margin:"8px 0 18px",maxWidth:920,textWrap:"balance"}}>From sign-up to your first agent-generated campaign — in 30 minutes.</h1>
          <p style={{fontSize:18,color:"var(--nav-ink)",maxWidth:680,margin:0,lineHeight:1.55}}>No migration. No onboarding call required. Connect Shopify, paste your brand voice, press generate. You'll have a reviewable draft before coffee goes cold.</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:28}}>
            <a href="#contact" onClick={e=>{e.preventDefault();go("contact");}} className="btn primary lg">Start free trial <Icon name="arrow"/></a>
            <a href="#features" onClick={e=>{e.preventDefault();go("features");}} className="btn ghost lg">See how it works</a>
          </div>
        </div>
      </section>

      {/* 30-MIN CALLOUT */}
      <section style={{paddingTop:56, paddingBottom:24}}>
        <div className="wrap">
          <div className="docs-callout">
            <div className="dc-big mono">30</div>
            <div className="dc-unit mono">MIN</div>
            <div className="dc-body">
              <div className="dc-title">From landing page to first reviewable draft</div>
              <p>We timed it across 14 pilot brands. Median is 27 minutes. The only thing that takes longer than five minutes is pasting your brand voice guide — and that's a one-time step.</p>
              <div className="dc-legend">
                <span><span className="dc-sw" style={{background:"var(--accent)"}}/>Set-up (once)</span>
                <span><span className="dc-sw" style={{background:"var(--ok)"}}/>Generate (every time)</span>
              </div>
            </div>
            <div className="dc-bar">
              {[
                {l:"Sign up",t:"2m",c:"var(--accent)"},
                {l:"Connect Shopify",t:"4m",c:"var(--accent)"},
                {l:"Brand voice",t:"14m",c:"var(--accent)"},
                {l:"Install rule packs",t:"3m",c:"var(--accent)"},
                {l:"First generation",t:"4m",c:"var(--ok)"},
                {l:"Review & approve",t:"3m",c:"var(--ok)"},
              ].map((s,i)=>(
                <div key={i} className="dc-seg" style={{flex:parseInt(s.t),background:s.c}} title={`${s.l} · ${s.t}`}>
                  <span className="dc-seg-label mono">{s.l}</span>
                  <span className="dc-seg-time mono">{s.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4-STEP FLOW */}
      <section style={{paddingTop:48}}>
        <div className="wrap">
          <div className="section-head">
            <h2>Four steps. Every brand. Same order.</h2>
            <p>The only real work you do is in step 3 — writing your brand voice once, so the Content Engine stops sounding like a generic AI tool and starts sounding like you.</p>
          </div>
          <div className="docs-steps">
            {[
              {
                n:"01", t:"Sign up", time:"2 min",
                d:"Create a workspace. One seat is enough to start — invite the team later. No card required for the 14-day trial.",
                tag:"You",
                kind:"human",
              },
              {
                n:"02", t:"Connect Shopify", time:"4 min",
                d:"OAuth flow into Shopify. We read products, collections, inventory, and historical order data. Read-only by default; you elect what the Campaign agent can publish to.",
                tag:"Integration",
                kind:"auto",
              },
              {
                n:"03", t:"Set brand voice", time:"14 min",
                d:"Paste your voice guide, or fill our template. The Content Strategy agent builds a vector profile from your website, past emails, and top-performing posts. You review and sign off.",
                tag:"You + Agent",
                kind:"mixed",
              },
              {
                n:"04", t:"First generation", time:"10 min",
                d:"Open Studio, pick a template, press Generate. Compliance scans in-line. You review, apply suggested fixes, submit to approvals. Agents take it from there.",
                tag:"Agent → You → Publish",
                kind:"mixed",
              },
            ].map((s,i)=>(
              <Reveal key={i} delay={i*60}>
                <div className={`docs-step kind-${s.kind}`}>
                  <div className="ds-head">
                    <div className="ds-n mono">STEP {s.n}</div>
                    <div className={`ds-tag mono kind-${s.kind}`}>{s.kind==="human"?"◐":s.kind==="auto"?"⟶":"◉"} {s.tag}</div>
                    <div className="ds-time mono">{s.time}</div>
                  </div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ANNOTATED STUDIO */}
      <section style={{background:"var(--panel-2)"}}>
        <div className="wrap">
          <div className="section-head">
            <h2>Where you'll spend most of your time.</h2>
            <p>Content Studio is the one screen that replaces Jasper, Copy.ai, your compliance doc, and the Slack thread where you send drafts to the freelancer. Here's what you're looking at.</p>
          </div>
          <div className="docs-annot">
            <div className="docs-annot-img">
              <div className="mock" style={{padding:0}}>
                <div className="mock-head">PLASMAIDE · STUDIO · /content</div>
                <div style={{padding:14,background:"#fff",display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  {/* composer */}
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <div className="annot-marker" data-n="A" style={{top:4,left:-10}}>A</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:4}}>
                      {["Blog","Email","Social","Product"].map((t,i)=>(
                        <div key={i} style={{padding:"8px 6px",border:"1px solid var(--line)",borderRadius:4,background:i===0?"var(--accent-bg)":"#fff",borderColor:i===0?"var(--accent)":"var(--line)",textAlign:"center",fontSize:11,fontWeight:500,color:i===0?"var(--accent)":"var(--ink-2)"}}>{t}</div>
                      ))}
                    </div>
                    <div style={{fontSize:9,letterSpacing:".1em",color:"var(--ink-4)",marginTop:4}}>TEMPLATE</div>
                    <div style={{padding:"6px 8px",border:"1px solid var(--line-3)",borderRadius:4,fontSize:11,background:"#fff",fontFamily:"'Geist Mono',monospace",color:"var(--ink-2)"}}>long-form-educational</div>
                    <div style={{fontSize:9,letterSpacing:".1em",color:"var(--ink-4)",marginTop:2}}>BRIEF</div>
                    <div style={{padding:"8px",border:"1px solid var(--line-3)",borderRadius:4,fontSize:10.5,background:"#fff",color:"var(--ink-3)",lineHeight:1.4,height:60,overflow:"hidden"}}>Educational blog, 800–1200 words. Focus on procyanidins and endothelial function. Reference PLM-2024-07. Avoid therapeutic claims…</div>
                  </div>
                  {/* preview */}
                  <div style={{display:"flex",flexDirection:"column",gap:6,position:"relative"}}>
                    <div className="annot-marker" data-n="B" style={{top:4,right:-10,left:"auto"}}>B</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",border:"1px solid var(--line)",borderRadius:4,background:"linear-gradient(180deg,#fff,var(--panel-2))",fontSize:10,position:"relative"}}>
                      <span style={{width:4,height:16,background:"var(--warn)",position:"absolute",left:0,top:6,borderRadius:2}}/>
                      <span style={{padding:"1px 6px",background:"var(--warn)",color:"#fff",borderRadius:8,fontSize:9,fontFamily:"'Geist Mono',monospace"}}>● 2 WARNINGS</span>
                      <span style={{fontFamily:"'Geist Mono',monospace",color:"var(--warn)",fontSize:9,padding:"1px 5px",border:"1px solid var(--warn)",borderRadius:8}}>TGA-001</span>
                      <span style={{fontFamily:"'Geist Mono',monospace",color:"var(--warn)",fontSize:9,padding:"1px 5px",border:"1px solid var(--warn)",borderRadius:8}}>COPY-044</span>
                      <span style={{marginLeft:"auto",fontFamily:"'Geist Mono',monospace",color:"var(--ink-4)",fontSize:9}}>342ms</span>
                    </div>
                    <div className="annot-marker" data-n="C" style={{top:60,right:-10,left:"auto"}}>C</div>
                    <div style={{padding:10,border:"1px solid var(--line)",borderRadius:4,background:"#fff",fontSize:10.5,lineHeight:1.5,color:"var(--ink-2)",flex:1}}>
                      <div style={{fontSize:8,letterSpacing:".08em",color:"var(--ink-4)",marginBottom:2}}>LONG-FORM · EDUCATIONAL</div>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:3,letterSpacing:"-0.01em"}}>Pine Bark's Role in Circulatory Health</div>
                      <div style={{color:"var(--ink-4)",fontSize:9,fontFamily:"'Geist Mono',monospace",marginBottom:6}}>APR 20 · 8 MIN · BY PLASMAIDE</div>
                      <p style={{margin:"0 0 4px",fontSize:10}}>Pine bark extract from French maritime pine has been studied since the late 1980s…</p>
                      <p style={{margin:"0 0 4px",fontSize:10}}>A growing body of research suggests standardised pine bark extract <span style={{background:"var(--warn-bg)",borderBottom:"1.5px solid var(--warn)",padding:"0 2px",color:"var(--ink)"}}>may help reduce chronic inflammation by up to 32%<span style={{marginLeft:3,padding:"0 3px",background:"var(--warn)",color:"#fff",fontSize:8,fontFamily:"'Geist Mono',monospace",borderRadius:2,verticalAlign:1}}>TGA-001</span></span>.</p>
                      <p style={{margin:"0",fontSize:10}}>The extract is used in our Daily capsule, which contains 150mg per serve — aligned with the dosages used in the <span style={{background:"var(--warn-bg)",borderBottom:"1.5px solid var(--warn)",padding:"0 2px"}}>strongest peer-reviewed trials<span style={{marginLeft:3,padding:"0 3px",background:"var(--warn)",color:"#fff",fontSize:8,fontFamily:"'Geist Mono',monospace",borderRadius:2,verticalAlign:1}}>COPY-044</span></span>.</p>
                    </div>
                    <div className="annot-marker" data-n="D" style={{bottom:4,right:-10,left:"auto"}}>D</div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 8px",border:"1px solid var(--line)",borderRadius:4,background:"#fff",fontSize:9}}>
                      <span style={{color:"var(--warn)",fontWeight:500,fontFamily:"'Geist Mono',monospace"}}>● READY · 2 WARNINGS</span>
                      <span style={{padding:"3px 8px",background:"var(--accent)",color:"#fff",borderRadius:3,fontWeight:500}}>Submit for approval ⌘⏎</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="docs-annot-legend">
              {[
                {n:"A",t:"Composer",d:"Pick content type, pick template, write the brief. The writer agent reads brand voice + SKU facts + current calendar priorities before it drafts."},
                {n:"B",t:"Live compliance bar",d:"Runs TGA, ACCC, and your brand-voice pack on every keystroke. Scan time stays under 400ms. Click a rule code to jump to the flagged phrase."},
                {n:"C",t:"Preview with inline flags",d:"The exact rendered output. Flagged phrases are yellow-underlined and clickable — tap any to see rule context, why it fired, and a suggested fix you can apply in one click."},
                {n:"D",t:"Submit bar",d:"Status + word count + submit. ⌘⏎ ships it to the approvals queue. The compliance agent's notes travel with the draft, so your reviewer sees the same context you did."},
              ].map(l=>(
                <div key={l.n} className="dal-row">
                  <span className="dal-marker mono">{l.n}</span>
                  <div>
                    <div className="dal-t">{l.t}</div>
                    <p className="dal-d">{l.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHAT'S NEXT */}
      <section>
        <div className="wrap">
          <div className="section-head">
            <h2>After your first generation.</h2>
            <p>The first 30 minutes get you to a reviewable draft. The next 30 days are where the real compounding happens — as agents learn your calendar, catalogue, and customers.</p>
          </div>
          <div className="docs-next">
            {[
              {n:"Week 1",t:"Baseline",d:"Agents shadow-run on last 90 days of data. CFO agent establishes CAC/LTV baselines. Intelligence agent seeds competitor watch."},
              {n:"Week 2",t:"First campaign",d:"Campaign Execution ships its first full send with your approval. Review Harvester begins triage on existing Okendo / Trustpilot backlog."},
              {n:"Week 3",t:"Calendar ownership",d:"Digital COO drafts next two weeks from signals. You review the plan, not the execution. Meeting time collapses."},
              {n:"Week 4+",t:"Compounding",d:"Customer Intel clusters mature. Content Strategy sees which topics actually convert. Brand voice tightens as more approved drafts train the profile."},
            ].map((w,i)=>(
              <div key={i} className="docs-next-card">
                <div className="dnc-n mono">{w.n}</div>
                <h4>{w.t}</h4>
                <p>{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <BigCTA/>
    </div>
  );
}
Object.assign(window, { Docs });
