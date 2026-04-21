function Home({ go }) {
  const agents = [
    {k:"Digital COO",ic:"brain",core:true,x:44,y:42,tag:"ORCH"},
    {k:"Content Strategy",ic:"brush",x:12,y:12,tag:"CNT-01"},
    {k:"Campaign Execution",ic:"zap",x:52,y:6,tag:"CMP-02"},
    {k:"Compliance",ic:"shield",x:80,y:14,tag:"CMP-03"},
    {k:"Performance Analytics",ic:"chart",x:88,y:44,tag:"ANL-04"},
    {k:"CFO",ic:"coin",x:80,y:76,tag:"FIN-05"},
    {k:"Web Designer",ic:"brush",x:52,y:84,tag:"WEB-06"},
    {k:"B2B Outreach",ic:"mail",x:14,y:78,tag:"B2B-07"},
    {k:"Review Harvester",ic:"star",x:2,y:46,tag:"REV-08"},
    {k:"Customer Intel",ic:"people",x:28,y:60,tag:"INT-09"},
    {k:"Customer Service",ic:"chat",x:68,y:60,tag:"SRV-10"},
    {k:"Intelligence",ic:"spark",x:28,y:24,tag:"SIG-11"},
  ];
  return (
    <div>
      {/* HERO */}
      <section className="hero" style={{borderTop:0}}>
        <div className="grid-bg"/>
        <div className="wrap inner">
          <h1 className="display" style={{marginTop:0}}>Your entire eCommerce team, <em>autonomous.</em></h1>
          <p className="sub-lead">AGOS replaces the $8–20K / month stack of fragmented tools, freelancers, and agencies with a single operating system — twelve specialized AI agents coordinated by a digital COO, with humans in the loop where it matters.</p>
          <div className="hero-cta">
            <a href="#contact" onClick={e=>{e.preventDefault();go("contact");}} className="btn primary lg">Start 14-day free trial <Icon name="arrow"/></a>
            <a href="#features" onClick={e=>{e.preventDefault();go("features");}} className="btn ghost lg">See how it works</a>
          </div>
          <Reveal>
            <div className="hero-canvas">
              <div className="chrome">
                <div className="dot"/><div className="dot"/><div className="dot"/>
                <div className="url">dashboard</div>
              </div>
              <div style={{padding:20,background:"linear-gradient(180deg,#0e142a,#0b1020)"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <MockDashboard/>
                  <MockApprovals/>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PROBLEM / SOLUTION */}
      <section>
        <div className="wrap">
          <div className="section-head">
            <h2>DTC brands are drowning in a stack that wasn't designed to work together.</h2>
            <p>Eight tools, three freelancers, one overworked marketing manager, and nobody sees the whole picture. Every handoff loses context. Every campaign launches late. Compliance is a Google Doc someone forgets to check.</p>
          </div>
          <div className="ps-grid">
            <Reveal><div className="ps-card bad">
              <h3>Before AGOS</h3>
              <p className="big">A patchwork of SaaS + humans, glued together by Slack and hope.</p>
              <ul>
                <li><span className="mk"><Icon name="x"/></span>Jasper for copy, Klaviyo for email, Triple Whale for analytics — none of them talk.</li>
                <li><span className="mk"><Icon name="x"/></span>Compliance review happens in a 14-page Notion doc. Sometimes.</li>
                <li><span className="mk"><Icon name="x"/></span>Weekly "what's the plan" sync eats 90 minutes. Plans change next day.</li>
                <li><span className="mk"><Icon name="x"/></span>Freelance writer ghosts mid-launch. Campaign slips two weeks.</li>
                <li><span className="mk"><Icon name="x"/></span>Ad performance is a screenshot pasted into a Monday board.</li>
              </ul>
              <div className="foot"><span>$8,000 – $20,000 / mo</span><span>6–14 tools</span></div>
            </div></Reveal>
            <Reveal delay={120}><div className="ps-card good">
              <h3>With AGOS</h3>
              <p className="big">Twelve specialist agents, one digital COO, one dashboard — and you still press approve.</p>
              <ul>
                <li><span className="mk"><Icon name="check"/></span>Content Engine writes. Compliance Agent checks. You approve. It publishes.</li>
                <li><span className="mk"><Icon name="check"/></span>Rule packs for TGA, ACCC, FDA — installed, versioned, always-on.</li>
                <li><span className="mk"><Icon name="check"/></span>The digital COO agent drafts next week's plan from this week's data.</li>
                <li><span className="mk"><Icon name="check"/></span>Campaigns ship on the schedule agents actually own.</li>
                <li><span className="mk"><Icon name="check"/></span>Performance is a live pulse, not a Monday-morning summary.</li>
              </ul>
              <div className="foot"><span>$199 – $499 / mo</span><span>1 system</span></div>
            </div></Reveal>
          </div>
        </div>
      </section>

      {/* STACK REPLACEMENT */}
      <section className="dark">
        <div className="wrap">
          <div className="section-head">
            <h2 style={{color:"#fff"}}>Every line item on your payroll, consolidated.</h2>
            <p>We mapped the roles that show up in almost every DTC team we audited — the humans in the seats doing the repetitive work. Here's what one AGOS workspace absorbs:</p>
          </div>
          <div className="stack-tbl">
            <div className="row">
              <div className="hd">Role</div>
              <div className="hd">Typical cost</div>
              <div className="hd" style={{textAlign:"center"}}></div>
              <div className="hd">AGOS agent that replaces it</div>
            </div>
            {[
              {t:"Junior copywriter",ic:"✎",cost:"$4,000 – $6,500 / mo",rep:"Content Strategy + Execution",tag:"CNT-01"},
              {t:"Email marketing manager",ic:"@",cost:"$5,500 – $9,000 / mo",rep:"Campaign Execution",tag:"CMP-02"},
              {t:"Growth / performance analyst",ic:"%",cost:"$6,000 – $11,000 / mo",rep:"Performance Analytics",tag:"ANL-04"},
              {t:"CX / support lead",ic:"☎",cost:"$4,500 – $7,500 / mo",rep:"Customer Service",tag:"SRV-10"},
              {t:"Freelance brand writer",ic:"✎",cost:"$2,000 – $5,000 / mo",rep:"Content + Compliance",tag:"CNT + CMP"},
              {t:"eCommerce manager",ic:"M",cost:"$5,000 – $10,000 / mo",rep:"Digital COO agent",tag:"ORCH"},
              {t:"Compliance / regulatory reviewer",ic:"§",cost:"$1,000 – $3,000 / mo",rep:"Compliance Agent",tag:"CMP-03"},
            ].map((r,i)=>(
              <div className="row" key={i} style={{background:"#fff",color:"var(--ink)"}}>
                <div className="tool-name"><span className="tool-ico">{r.ic}</span>{r.t}</div>
                <div className="cost">{r.cost}</div>
                <div className="arrow"><Icon name="arrow" size={18}/></div>
                <div className="replaces">{r.rep}</div>
              </div>
            ))}
          </div>
          <div className="stack-foot">
            <div className="totals">
              <div><div className="lab">Your stack today</div><div className="val tnum">$8,000 – $20,000<small>/ mo</small></div></div>
              <span className="savings mono">6–8 ROLES</span>
            </div>
            <div className="totals agos">
              <div><div className="lab">AGOS</div><div className="val tnum">$199 – $499<small>/ mo</small></div></div>
              <span className="savings mono">▼ UP TO 97%</span>
            </div>
          </div>
        </div>
      </section>

      {/* AGENT DIAGRAM */}
      <section>
        <div className="wrap">
          <div className="section-head">
            <h2>Twelve specialists. One digital COO. No handoff loss.</h2>
            <p>Every agent has a narrow remit, a dedicated toolchain, and a shared memory of the brand. The digital COO agent routes work, resolves conflicts, and surfaces what needs a human.</p>
          </div>
          <Reveal>
            <div className="agent-viz">
              <div className="grid-bg"/>
              <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox="0 0 100 71" preserveAspectRatio="none">
                {agents.filter(a=>!a.core).map((a,i)=>(
                  <line key={i} x1="52" y1="46" x2={a.x+7} y2={a.y+4} stroke="rgba(183,204,255,.15)" strokeWidth="0.15" strokeDasharray="0.8 0.8"/>
                ))}
              </svg>
              {agents.map((a,i)=>(
                <div key={i} className={`agent-node ${a.core?"core":""}`} style={{left:`${a.x}%`,top:`${a.y}%`}}>
                  <span className="ico"><Icon name={a.ic} size={12}/></span>
                  <div style={{display:"flex",flexDirection:"column",gap:1,minWidth:0}}>
                    <span className="name">{a.k}</span>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* PRODUCT SCREENSHOTS */}
      <section style={{background:"var(--panel-2)"}}>
        <div className="wrap">
          <div className="section-head">
            <h2>This isn't a pitch deck. It's the product.</h2>
            <p>Actual screens from AGOS running on an online retailer today. No mockups, no "coming soon" asterisks.</p>
          </div>
          <div className="ss-showcase three">
            <Reveal><div className="ss-card">
              <div className="ss-head">
                <div><h4>Mission Control</h4><p>Revenue pulse, content pipeline, alerts — one glance.</p></div>
              </div>
              <div className="ss-body"><MockDashboard/></div>
            </div></Reveal>
            <Reveal delay={80}><div className="ss-card">
              <div className="ss-head">
                <div><h4>Approvals</h4><p>Split view. AI flag on the left, your decision on the right.</p></div>
              </div>
              <div className="ss-body"><MockApprovals/></div>
            </div></Reveal>
            <Reveal delay={160}><div className="ss-card">
              <div className="ss-head">
                <div><h4>Compliance</h4><p>Rule packs for TGA, ACCC, brand voice — versioned, always-on.</p></div>
              </div>
              <div className="ss-body"><MockSettings/></div>
            </div></Reveal>
          </div>
          <div style={{textAlign:"center",marginTop:28}}>
            <a href="#" className="btn ghost-dark lg">Open the interactive demo <Icon name="arrow"/></a>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section>
        <div className="wrap">
          <div className="section-head">
            <h2>Brands powered by AGOS today.</h2>
            <p>From founder-led health brands to multi-SKU CPG portfolios. All running on the same operating system.</p>
          </div>
          <div className="logos">
            {[
              {n:"PLASMAIDE", on:true},
              {n:"LYRE'S", on:true},
              {n:"FOLLE", on:true},
              {n:"YOUR BRAND", on:false},
              {n:"YOUR BRAND", on:false},
            ].map((c,i)=>(
              <div className="cell" key={i} style={c.on?null:{opacity:.35,borderStyle:"dashed"}}>{c.n}</div>
            ))}
          </div>
          <div className="testi-grid">
            <Reveal><div className="testi">
              <div className="quote">"We cut our marketing SaaS bill by 91% and shipped twice the content in the first month. The compliance agent caught two TGA claims our old freelancer missed."</div>
              <div className="auth"><div className="av">SA</div><div><div className="n">Steve Allende</div><div className="r">Founder · Plasmaide</div></div></div>
              <div className="meta"><span className="up">↑ 2.4× output</span><span>91% stack reduction</span></div>
            </div></Reveal>
            <Reveal delay={80}><div className="testi">
              <div className="quote">"I used to spend my Mondays chasing five freelancers. Now I spend them reviewing approvals and actually thinking about the business."</div>
              <div className="auth"><div className="av">DQ</div><div><div className="n">Danica Quilty</div><div className="r">Head of Ecommerce · Lyre's</div></div></div>
              <div className="meta"><span className="up">↑ 6h / week back</span><span>2× increase in ROAS</span></div>
            </div></Reveal>
            <Reveal delay={160}><div className="testi">
              <div className="quote">"The human-in-the-loop design is the difference. Other AI tools ship slop. AGOS ships what I actually would've approved."</div>
              <div className="auth"><div className="av">CC</div><div><div className="n">Courtney Crewe-Brown</div><div className="r">Founder · Folle</div></div></div>
              <div className="meta"><span className="up">↑ 38% approval rate</span><span>100% accuracy in health claims</span></div>
            </div></Reveal>
          </div>
        </div>
      </section>

      <BigCTA/>
    </div>
  );
}
Object.assign(window, { Home });
