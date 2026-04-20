/* Marketing: Integrations section inside Features page
 * Shows full grid with status chips + data flow diagram + BYO-LLM callout
 */

function IntegrationsSection() {
  const categories = [
    {
      label: "Commerce & CMS",
      items: [
        { n:"Shopify",        s:"Reads orders, products, customers · writes blog posts, PDP copy, alt text", status:"live",  abbr:"Sh", color:"#95bf47" },
        { n:"WooCommerce",    s:"Same as Shopify, for WP-based stores",                                       status:"soon", abbr:"Wc", color:"#96588a" },
        { n:"BigCommerce",    s:"Headless and hosted store support",                                          status:"soon", abbr:"Bc", color:"#0d52ff" },
      ]
    },
    {
      label: "Email & Marketing Automation",
      items: [
        { n:"DotDigital",     s:"Ships campaigns, templates, lists · reads engagement data",                  status:"live",  abbr:"Dd", color:"#0072c6" },
        { n:"Klaviyo",        s:"Lifecycle flows, segments, campaign deploys",                                status:"live",  abbr:"Kl", color:"#232323" },
        { n:"Omnisend",       s:"Multi-channel lifecycle marketing",                                          status:"soon", abbr:"Om", color:"#00b3a4" },
      ]
    },
    {
      label: "Analytics & Attribution",
      items: [
        { n:"Triple Whale",   s:"Multi-touch attribution, daily revenue, CAC / LTV",                          status:"live",  abbr:"Tw", color:"#ff5a5a" },
        { n:"Google Analytics 4", s:"Sessions, conversions, e-comm events",                                   status:"live",  abbr:"G4", color:"#e37400" },
        { n:"Meta Pixel",     s:"Ad attribution and conversion tracking",                                     status:"soon", abbr:"Mp", color:"#1877f2" },
      ]
    },
    {
      label: "Customer Service",
      items: [
        { n:"Gorgias",        s:"Ticket triage and drafted replies · Customer Service Agent",                 status:"live",  abbr:"Gx", color:"#f26b27" },
        { n:"Zendesk",        s:"Enterprise support desk integration",                                        status:"soon", abbr:"Zd", color:"#03363d" },
        { n:"Intercom",       s:"Conversational support and chat",                                            status:"soon", abbr:"Ic", color:"#0057ff" },
      ]
    },
    {
      label: "Financial",
      items: [
        { n:"Xero",           s:"P&L, contribution margin, invoice data · CFO Agent",                         status:"live",  abbr:"Xr", color:"#13b5ea" },
        { n:"QuickBooks",     s:"Accounting and payroll sync",                                                status:"soon", abbr:"Qb", color:"#2ca01c" },
        { n:"Stripe",         s:"Revenue and subscription data",                                              status:"soon", abbr:"St", color:"#635bff" },
      ]
    },
    {
      label: "AI / LLM Providers",
      items: [
        { n:"Anthropic (Claude)", s:"Default · Haiku 4.5 (fast), Sonnet 4.6 (accurate), Opus 4.6 (premium)",  status:"live",  abbr:"An", color:"#d97757" },
        { n:"OpenAI",         s:"Bring your own key · GPT-4 and GPT-4o",                                      status:"live",  abbr:"Oa", color:"#10a37f" },
        { n:"Google Gemini",  s:"Gemini 3 Pro and Gemini 3 Flash",                                             status:"soon", abbr:"Gg", color:"#4285f4" },
      ]
    },
    {
      label: "Social & Publishing",
      items: [
        { n:"Meta (Facebook + Instagram)", s:"Post scheduling and ad campaign deploys",                       status:"live",  abbr:"Fb", color:"#1877f2" },
        { n:"LinkedIn",       s:"B2B posts and company page scheduling",                                      status:"soon", abbr:"Li", color:"#0a66c2" },
        { n:"TikTok",         s:"Organic and paid content deploys",                                           status:"soon", abbr:"Tk", color:"#000000" },
      ]
    },
    {
      label: "Reviews & UGC",
      items: [
        { n:"Okendo",         s:"Review monitoring and drafted responses",                                    status:"soon", abbr:"Ok", color:"#ff3366" },
        { n:"Trustpilot",     s:"Reputation signals and response workflow",                                   status:"soon", abbr:"Tp", color:"#00b67a" },
        { n:"Yotpo",          s:"Loyalty + UGC review platform",                                              status:"soon", abbr:"Yo", color:"#0042e4" },
      ]
    },
  ];

  return (
    <section id="integrations" style={{background:"var(--panel-2)"}}>
      <div className="wrap">
        <div className="section-head">
          <div className="section-eye"><span>INTEGRATIONS</span></div>
          <h2>Connects to your existing stack.</h2>
          <p>AGOS doesn't replace your Shopify store or your email platform. It orchestrates them — reading performance data, writing content, and publishing across channels.</p>
        </div>

        {/* LEGEND */}
        <div style={{display:"none"}}></div>

        {/* CATEGORY GRID */}
        {categories.map(cat => (
          <div key={cat.label} style={{marginBottom:20}}>
            <h3 style={{margin:"0 0 10px", fontSize:12, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-3)", fontWeight:600, fontFamily:"'Geist Mono', monospace"}}>
              {cat.label}
            </h3>
            <div className="int-grid">
              {cat.items.map(item => <IntegrationCell key={item.n} item={item}/>)}
            </div>
          </div>
        ))}

        {/* DATA FLOW DIAGRAM */}
        <div style={{marginTop:48, border:"1px solid var(--line)", borderRadius:12, background:"var(--panel)", padding:"32px 28px 28px"}}>
          <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:12}}>
            <h3 style={{margin:0, fontSize:20, fontWeight:500, letterSpacing:"-0.015em"}}>How data moves through the system</h3>
          </div>

          <div className="int-flow">
            {/* READ column */}
            <div className="int-flow-col">
              <div className="int-flow-col-hd">SOURCES · AGOS READS</div>
              <FlowNode icon="cart"   name="Shopify"      line="Orders, products, customers"/>
              <FlowNode icon="chart"  name="Triple Whale" line="Attribution, daily revenue"/>
              <FlowNode icon="coin"   name="Xero"         line="P&L, margin, invoices"/>
              <FlowNode icon="chat"   name="Gorgias"      line="Tickets, customer sentiment"/>
              <FlowNode icon="star"   name="Okendo"       line="Reviews, UGC signals"/>
            </div>

            {/* CORE */}
            <div className="int-flow-core">
              <div className="int-flow-core-box">
                <AgosGlyph size={56}/>
                <div style={{fontSize:18, fontWeight:500, letterSpacing:"-0.015em", marginTop:12}}>AGOS</div>
                <div style={{fontSize:11, color:"var(--nav-ink-2)", fontFamily:"'Geist Mono', monospace", letterSpacing:".12em", textTransform:"uppercase", marginTop:4}}>
                  12 agents · shared memory
                </div>
                <div style={{marginTop:14, padding:"10px 12px", background:"rgba(255,255,255,.04)", border:"1px dashed var(--nav-line)", borderRadius:6, fontSize:12, color:"var(--nav-ink)", lineHeight:1.45, textAlign:"left"}}>
                  Reads normalize to a shared schema. Agents plan, draft, check. Humans approve. Writes deploy to the right channel.
                </div>
              </div>
            </div>

            {/* WRITE column */}
            <div className="int-flow-col">
              <div className="int-flow-col-hd">DESTINATIONS · AGOS WRITES</div>
              <FlowNode icon="brush"  name="Shopify"      line="Blog posts, PDP copy, alt text"/>
              <FlowNode icon="mail"   name="DotDigital"   line="Campaigns, templates, lists"/>
              <FlowNode icon="mail"   name="Klaviyo"      line="Lifecycle flows, campaigns"/>
              <FlowNode icon="zap"    name="Meta"         line="Posts, paid campaigns"/>
              <FlowNode icon="chat"   name="Gorgias"      line="Drafted replies, macros"/>
            </div>
          </div>
        </div>

        {/* BYO-LLM CALLOUT */}
        <div style={{marginTop:20, border:"1px solid var(--line)", borderRadius:12, overflow:"hidden", background:"var(--panel)"}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:0}}>
            <div style={{padding:"32px 32px", borderRight:"1px solid var(--line)"}}>
              <h3 style={{margin:"0 0 10px", fontSize:24, fontWeight:500, letterSpacing:"-0.02em"}}>Your API key, your costs, your choice.</h3>
              <p style={{margin:"0 0 16px", color:"var(--ink-3)", fontSize:14, lineHeight:1.55}}>AGOS defaults to Anthropic's Claude family with zero‑retention inference. If your team has an OpenAI or Gemini contract, plug it in and we'll route per‑rule — fast, accurate, or premium.</p>
              <ul style={{listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap:8, fontSize:13, color:"var(--ink-2)"}}>
                <li style={{display:"flex", gap:8}}><span style={{color:"var(--ok)", marginTop:2}}><Icon name="check"/></span>Per-rule model selection — fast / accurate / premium tiers</li>
                <li style={{display:"flex", gap:8}}><span style={{color:"var(--ok)", marginTop:2}}><Icon name="check"/></span>Cost and token usage visible per-agent, per-workspace</li>
                <li style={{display:"flex", gap:8}}><span style={{color:"var(--ok)", marginTop:2}}><Icon name="check"/></span>Fallback chain: if your primary is down, we route to the next provider</li>
              </ul>
            </div>

            <div style={{padding:"32px 32px", background:"var(--panel-2)"}}>
              <div style={{display:"flex", flexDirection:"column", gap:8}}>
                {[
                  { tier:"Fast",     desc:"Real-time compliance, intent classification, simple rewrites", anth:"Haiku 4.5",    oa:"GPT-4o mini", g:"Gemini 3 Flash" },
                  { tier:"Accurate", desc:"Drafting, brand voice, most production content",                anth:"Sonnet 4.6",   oa:"GPT-4o",       g:"Gemini 3 Pro" },
                  { tier:"Premium",  desc:"Strategy, long-form, ambiguous edge cases",                     anth:"Opus 4.6",     oa:"GPT-4 Turbo",  g:"—" },
                ].map(row => (
                  <div key={row.tier} style={{border:"1px solid var(--line)", borderRadius:8, padding:"10px 14px", background:"var(--panel)"}}>
                    <div style={{display:"flex", alignItems:"baseline", gap:10, marginBottom:4}}>
                      <div style={{fontSize:14, fontWeight:500, letterSpacing:"-0.01em"}}>{row.tier}</div>
                      <div style={{fontSize:11, color:"var(--ink-4)"}}>{row.desc}</div>
                    </div>
                    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, fontSize:11, fontFamily:"'Geist Mono', monospace"}}>
                      <div><span style={{color:"var(--ink-4)"}}>ANTH</span> <span style={{color:"var(--ink-2)"}}>{row.anth}</span></div>
                      <div><span style={{color:"var(--ink-4)"}}>OA</span> <span style={{color:"var(--ink-2)"}}>{row.oa}</span></div>
                      <div><span style={{color:"var(--ink-4)"}}>G</span> <span style={{color:"var(--ink-2)"}}>{row.g}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TRUST CALLOUT — reused phrasing */}
        <div style={{marginTop:20, padding:"22px 28px", border:"1px solid var(--line)", borderRadius:12, background:"var(--panel)", display:"flex", alignItems:"center", gap:20}}>
          <div style={{width:44, height:44, borderRadius:10, background:"var(--accent-bg)", color:"var(--accent)", display:"grid", placeItems:"center", border:"1px solid var(--accent-line)", flex:"0 0 44px"}}>
            <Icon name="lock" size={20}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:15, fontWeight:500, marginBottom:2, letterSpacing:"-0.01em"}}>Your credentials are encrypted at rest. OAuth where available.</div>
            <div style={{fontSize:13, color:"var(--ink-3)", lineHeight:1.55}}>API keys stored in Supabase with row-level encryption. We never store your customers' PII beyond what's needed for the agent task.</div>
          </div>
          <a href="#security" className="btn ghost-dark" style={{flex:"0 0 auto"}}>Security details <Icon name="arrow"/></a>
        </div>

      </div>

      <style>{`
        .int-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        @media (max-width:900px){.int-grid{grid-template-columns:1fr 1fr}}
        @media (max-width:600px){.int-grid{grid-template-columns:1fr}}
        .int-cell{
          display:grid;grid-template-columns:40px 1fr auto;gap:12px;align-items:center;
          padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:var(--panel);
          transition:border-color 140ms, transform 140ms, box-shadow 140ms;
        }
        .int-cell.soon{opacity:.7}
        .int-cell:hover{border-color:var(--line-3);transform:translateY(-1px);box-shadow:0 6px 14px -8px rgba(12,20,42,.12)}
        .int-cell .logo{
          width:36px;height:36px;border-radius:6px;color:#fff;
          display:grid;place-items:center;font-weight:600;font-size:14px;
          letter-spacing:-0.01em;
          box-shadow:inset 0 0 0 1px rgba(255,255,255,.14), inset 0 -1px 0 rgba(0,0,0,.1);
        }
        .int-cell .n{font-size:14px;font-weight:500;letterSpacing:-0.005em}
        .int-cell .s{font-size:12px;color:var(--ink-4);margin-top:2px;line-height:1.45}
        .int-chip{
          font-size:9px;font-family:'Geist Mono',monospace;letter-spacing:.12em;
          padding:3px 8px;border-radius:10px;border:1px solid transparent;text-transform:uppercase;
          white-space:nowrap;
        }
        .int-chip.live{color:var(--ok);background:var(--ok-bg);border-color:color-mix(in srgb,var(--ok) 24%,transparent)}
        .int-chip.beta{color:var(--warn);background:var(--warn-bg);border-color:color-mix(in srgb,var(--warn) 24%,transparent)}
        .int-chip.soon{color:var(--ink-4);background:var(--line-2);border-color:var(--line-3)}

        .int-flow{display:grid;grid-template-columns:1fr 220px 1fr;gap:20px;align-items:stretch}
        @media (max-width:900px){.int-flow{grid-template-columns:1fr}}
        .int-flow-col{display:flex;flex-direction:column;gap:8px}
        .int-flow-col-hd{font-family:'Geist Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-4);margin-bottom:4px}
        .int-flow-node{
          display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;
          padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--panel);
        }
        .int-flow-node .ico{width:24px;height:24px;border-radius:5px;background:var(--accent-bg);color:var(--accent);display:grid;place-items:center;border:1px solid var(--accent-line)}
        .int-flow-node .nm{font-size:13px;font-weight:500}
        .int-flow-node .ln{font-size:11px;color:var(--ink-4);margin-top:1px}
        .int-flow-node .phase{font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-4);padding:2px 6px;border:1px dashed var(--line-3);border-radius:10px;white-space:nowrap}
        .int-flow-core{
          display:grid;place-items:center;
          background:linear-gradient(180deg,#0f1423,#0b1020);
          border:1px solid var(--nav-line);border-radius:12px;color:#fff;
          padding:22px 18px;text-align:center;
          box-shadow:0 20px 40px -20px rgba(47,111,235,.35), 0 0 0 1px rgba(47,111,235,.15) inset;
          position:relative;overflow:hidden;
        }
        .int-flow-core-box{position:relative;z-index:2}
        @media (max-width:900px){
          .int-flow-node{grid-template-columns:28px 1fr}
          .int-flow-node .phase{grid-column:1/-1}
        }
      `}</style>
    </section>
  );
}

function IntegrationCell({ item }) {
  return (
    <div className={`int-cell ${item.status==="soon"?"soon":""}`}>
      <div className="logo" style={{background:item.color}}>{item.abbr}</div>
      <div style={{minWidth:0}}>
        <div className="n">{item.n}</div>
        <div className="s">{item.s}</div>
      </div>
      <span className={`int-chip ${item.status}`}>
        {item.status==="live" ? "LIVE" : item.status==="beta" ? "BETA" : "Q3 2026"}
      </span>
    </div>
  );
}

function Legend({ color, label, count }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--ink-3)"}}>
      <span style={{width:8, height:8, borderRadius:"50%", background:color}}/>
      <span>{label}</span>
      <span className="mono tnum" style={{color:"var(--ink-4)", fontSize:11}}>{count}</span>
    </div>
  );
}

function FlowNode({ icon, name, line, phase }) {
  return (
    <div className="int-flow-node">
      <div className="ico"><Icon name={icon} size={12}/></div>
      <div>
        <div className="nm">{name}</div>
        <div className="ln">{line}</div>
      </div>
      {phase && <span className="phase">{phase}</span>}
    </div>
  );
}

Object.assign(window, { IntegrationsSection });
