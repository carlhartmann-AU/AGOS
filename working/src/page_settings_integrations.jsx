/* Settings → Integrations tab
 * Health overview + 7 category sections + rich detail cards for the
 * 7 fully-specified services; everything else is a single "coming soon" line.
 */

const INTEGRATIONS_DATA = {
  categories: [
    {
      id: "commerce",
      label: "Commerce & CMS",
      desc: "Product catalog, orders, and publishing surfaces",
      items: [
        {
          name: "Shopify", abbr: "Sh", color: "#95bf47",
          status: "connected",
          detail: {
            account: "plasmaide-uk.myshopify.com",
            sync: "Real-time webhook + 15min backfill",
            lastSync: { ok: true, ago: "2m", ts: "Apr 20 · 14:23 AEST" },
            markets: ["AU", "UK", "US", "EU"],
            reads: ["Orders", "Products", "Customers", "Collections"],
            writes: ["Blog posts", "Product descriptions", "Alt text"],
          },
        },
        { name: "WooCommerce", abbr: "Wc", color: "#96588a", status: "soon" },
        { name: "BigCommerce", abbr: "Bc", color: "#0d52ff", status: "soon" },
      ],
    },
    {
      id: "email",
      label: "Email & Marketing Automation",
      desc: "Lifecycle and broadcast channels",
      items: [
        {
          name: "DotDigital", abbr: "Dd", color: "#0072c6",
          status: "connected",
          detail: {
            account: "Plasmaide AU · #47218",
            sync: "Daily 06:00 AEST + manual",
            lastSync: { ok: true, ago: "14h", ts: "Apr 20 · 06:01 AEST" },
            lastCampaign: "Autumn restock · Apr 19 · 14,203 sent",
            contacts: "11,482 contacts",
            reads: ["Subscribers", "Campaign performance", "Segments"],
            writes: ["Email campaigns", "Templates", "Lists"],
          },
        },
        {
          name: "Klaviyo", abbr: "Kl", color: "#232323",
          status: "available",
          note: "Available now · used by Folle (pre-launch)",
        },
        { name: "Omnisend", abbr: "Om", color: "#00b3a4", status: "soon" },
        { name: "Mailchimp", abbr: "Mc", color: "#ffe01b", status: "soon" },
      ],
    },
    {
      id: "analytics",
      label: "Analytics & Attribution",
      desc: "Performance data the agents read from",
      items: [
        {
          name: "Triple Whale", abbr: "Tw", color: "#ff5a5a",
          status: "connected",
          detail: {
            account: "plasmaide-au · workspace 9041",
            sync: "Daily cron · 03:00 AEST",
            cronStatus: "Active",
            cached: "90 days",
            lastSync: { ok: true, ago: "17h", ts: "Apr 20 · 03:04 AEST" },
            reads: ["Attribution by channel", "Daily revenue", "Ad spend", "CAC/LTV"],
            writes: [],
          },
        },
        { name: "Google Analytics 4", abbr: "G4", color: "#e37400", status: "available" },
        { name: "Meta Pixel", abbr: "Mp", color: "#1877f2", status: "soon" },
      ],
    },
    {
      id: "support",
      label: "Customer Service",
      desc: "Inbound support channels — Customer Service Agent (Phase 6)",
      items: [
        {
          name: "Gorgias", abbr: "Gx", color: "#f26b27",
          status: "available",
          note: "Available now · required for Customer Service Agent",
        },
        { name: "Zendesk", abbr: "Zd", color: "#03363d", status: "soon" },
        { name: "Intercom", abbr: "Ic", color: "#0057ff", status: "soon" },
      ],
    },
    {
      id: "financial",
      label: "Financial",
      desc: "P&L data for CFO Agent (Phase 5)",
      items: [
        {
          name: "Xero", abbr: "Xr", color: "#13b5ea",
          status: "available",
          note: "Available now · required for CFO Agent",
        },
        { name: "QuickBooks", abbr: "Qb", color: "#2ca01c", status: "soon" },
        { name: "Stripe", abbr: "St", color: "#635bff", status: "soon" },
      ],
    },
    {
      id: "llm",
      label: "AI / LLM Providers",
      desc: "The models your agents run on",
      items: [
        {
          name: "Anthropic (Claude)", abbr: "An", color: "#d97757",
          status: "connected",
          detail: {
            account: "agos-plasmaide-prod",
            sync: "Live · zero retention enabled",
            lastSync: { ok: true, ago: "now", ts: "Streaming" },
            models: [
              { k: "Fast", v: "Haiku 4.5" },
              { k: "Accurate", v: "Sonnet 4.6" },
              { k: "Premium", v: "Opus 4 (on-demand)" },
            ],
            usage: "2.41M input · 612k output tokens (MTD)",
            cost: "≈ $184.20 MTD · forecast $247/mo",
            reads: [],
            writes: ["All agent inference"],
          },
        },
        { name: "OpenAI", abbr: "Oa", color: "#10a37f", status: "available", note: "Bring your own key" },
        { name: "Google Gemini", abbr: "Gg", color: "#4285f4", status: "soon" },
      ],
    },
    {
      id: "social",
      label: "Social & Publishing",
      desc: "Distribution channels for Campaign Execution Agent",
      items: [
        { name: "Meta (Facebook + Instagram)", abbr: "Fb", color: "#1877f2", status: "available" },
        { name: "LinkedIn", abbr: "Li", color: "#0a66c2", status: "soon" },
        { name: "Buffer / Later", abbr: "Bf", color: "#1d1d1d", status: "soon" },
        { name: "TikTok", abbr: "Tk", color: "#000000", status: "soon" },
      ],
    },
    {
      id: "reviews",
      label: "Reviews & UGC",
      desc: "Inputs for Review Harvester Agent",
      items: [
        { name: "Okendo", abbr: "Ok", color: "#ff3366", status: "soon" },
        { name: "Trustpilot", abbr: "Tp", color: "#00b67a", status: "soon" },
        { name: "Yotpo", abbr: "Yo", color: "#0042e4", status: "soon" },
      ],
    },
  ],
};

function IntegrationsTab() {
  const [expanded, setExpanded] = useState({ Shopify: true });
  const cats = INTEGRATIONS_DATA.categories;

  // Flat counts
  const all = cats.flatMap(c => c.items);
  const connected = all.filter(i => i.status === "connected");
  const available = all.filter(i => i.status === "available");
  const soon      = all.filter(i => i.status === "soon");
  const lastSyncLabel = "Apr 20 · 14:23 AEST";
  const overallHealth = "ok"; // all synced in last 24h

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 300px", gap:20}}>
      <div>
        {/* HEALTH OVERVIEW */}
        <div className="card" style={{marginBottom:20, padding:"18px 20px", display:"flex", alignItems:"center", gap:24, flexWrap:"wrap"}}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <span style={{
              width:10, height:10, borderRadius:"50%",
              background: overallHealth === "ok" ? "var(--ok)" : overallHealth === "warn" ? "var(--warn)" : "var(--bad)",
              boxShadow: overallHealth === "ok" ? "0 0 0 3px rgba(15,138,95,.18)" : "0 0 0 3px rgba(184,116,26,.18)"
            }}/>
            <div>
              <div style={{fontSize:14, fontWeight:500, letterSpacing:"-0.01em"}}>
                {overallHealth === "ok" ? "All integrations healthy" : "Some integrations need attention"}
              </div>
              <div className="mono" style={{fontSize:10, color:"var(--ink-4)", letterSpacing:".08em", textTransform:"uppercase", marginTop:2}}>
                LAST FULL SYNC · {lastSyncLabel}
              </div>
            </div>
          </div>
          <div style={{display:"flex", gap:18, marginLeft:"auto"}}>
            <CountPill n={connected.length} label="Connected" tone="ok"/>
            <CountPill n={available.length} label="Available" tone="accent"/>
            <CountPill n={soon.length} label="Coming soon" tone="muted"/>
          </div>
        </div>

        {/* CATEGORIES */}
        {cats.map(cat => (
          <CategorySection
            key={cat.id}
            cat={cat}
            expanded={expanded}
            setExpanded={setExpanded}
          />
        ))}
      </div>

      {/* SIDEBAR */}
      <div>
        <div className="card">
          <div className="card-head"><h3>Recommended setup</h3></div>
          <div className="card-body">
            <div style={{fontSize:12, color:"var(--ink-3)", lineHeight:1.55, marginBottom:12}}>
              For a typical DTC workspace, connect in this order to unlock each agent tier:
            </div>
            {[
              { n:1, t:"Shopify", s:"Unlocks: Performance, Content", done:true },
              { n:2, t:"Email platform", s:"Unlocks: Campaign Execution", done:true },
              { n:3, t:"Triple Whale / GA4", s:"Unlocks: Analytics, CFO", done:true },
              { n:4, t:"Xero", s:"Unlocks: CFO Agent (Phase 5)", done:false },
              { n:5, t:"Gorgias", s:"Unlocks: Customer Service (Phase 6)", done:false },
            ].map((s,i)=>(
              <div key={i} style={{display:"grid", gridTemplateColumns:"22px 1fr", gap:10, padding:"8px 0", borderBottom: i<4 ? "1px solid var(--line-2)":"0"}}>
                <div style={{
                  width:20, height:20, borderRadius:10,
                  background: s.done ? "var(--ok-bg)" : "var(--line-2)",
                  color: s.done ? "var(--ok)" : "var(--ink-4)",
                  display:"grid", placeItems:"center", fontSize:10, fontWeight:600,
                  border: s.done ? "1px solid color-mix(in srgb, var(--ok) 24%, transparent)" : "1px solid var(--line-3)",
                  fontFamily:"'Geist Mono', monospace",
                }}>{s.done ? "✓" : s.n}</div>
                <div>
                  <div style={{fontSize:13, fontWeight:500}}>{s.t}</div>
                  <div className="mono" style={{fontSize:10, color:"var(--ink-4)", letterSpacing:".04em", marginTop:1}}>{s.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{marginTop:16}}>
          <div className="card-head"><h3>Sync activity · 7d</h3></div>
          <div className="card-body">
            <div className="mono" style={{fontSize:11, color:"var(--ink-3)", lineHeight:2}}>
              <div className="row" style={{justifyContent:"space-between"}}><span>SHOPIFY</span><span className="tnum" style={{color:"var(--ok)"}}>1,204 / 0</span></div>
              <div className="row" style={{justifyContent:"space-between"}}><span>DOTDIGITAL</span><span className="tnum" style={{color:"var(--ok)"}}>7 / 0</span></div>
              <div className="row" style={{justifyContent:"space-between"}}><span>TRIPLE WHALE</span><span className="tnum" style={{color:"var(--ok)"}}>7 / 0</span></div>
              <div className="row" style={{justifyContent:"space-between"}}><span>ANTHROPIC</span><span className="tnum" style={{color:"var(--ok)"}}>∞ / 0</span></div>
              <div className="row" style={{justifyContent:"space-between", borderTop:"1px dashed var(--line-3)", paddingTop:6, marginTop:4}}>
                <span>OK / ERRORS</span><span className="tnum" style={{color:"var(--ink-4)"}}>7d</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ————— subcomponents ————— */

function CountPill({ n, label, tone }) {
  const tones = {
    ok:     { bg:"var(--ok-bg)",     fg:"var(--ok)"     },
    accent: { bg:"var(--accent-bg)", fg:"var(--accent)" },
    muted:  { bg:"var(--line-2)",    fg:"var(--ink-3)"  },
  };
  const t = tones[tone] || tones.muted;
  return (
    <div style={{display:"flex", alignItems:"baseline", gap:6}}>
      <div className="tnum" style={{fontSize:20, fontWeight:500, letterSpacing:"-0.015em", color:t.fg}}>{n}</div>
      <div className="mono" style={{fontSize:10, color:"var(--ink-4)", letterSpacing:".12em", textTransform:"uppercase"}}>{label}</div>
    </div>
  );
}

function CategorySection({ cat, expanded, setExpanded }) {
  const richItems = cat.items.filter(i => i.status === "connected" || i.status === "available");
  const soonItems = cat.items.filter(i => i.status === "soon");
  return (
    <div style={{marginBottom:28}}>
      <div style={{marginBottom:10, display:"flex", alignItems:"baseline", justifyContent:"space-between"}}>
        <div>
          <h3 style={{margin:0, fontSize:14, fontWeight:600, letterSpacing:"-0.005em"}}>{cat.label}</h3>
          <div style={{fontSize:12, color:"var(--ink-4)", marginTop:2}}>{cat.desc}</div>
        </div>
        <div className="mono" style={{fontSize:10, color:"var(--ink-4)", letterSpacing:".12em", textTransform:"uppercase"}}>
          {cat.items.length} TOTAL · {cat.items.filter(i=>i.status==="connected").length} CONNECTED
        </div>
      </div>

      {/* Rich cards */}
      {richItems.length > 0 && (
        <div className="card" style={{marginBottom: soonItems.length ? 8 : 0}}>
          {richItems.map((item, idx) => (
            <IntegrationCard
              key={item.name}
              item={item}
              isLast={idx === richItems.length - 1 && soonItems.length === 0}
              expanded={expanded[item.name] || false}
              onToggle={() => setExpanded(e => ({ ...e, [item.name]: !e[item.name] }))}
            />
          ))}
        </div>
      )}

      {/* Coming-soon inline list */}
      {soonItems.length > 0 && (
        <div className="card" style={{padding:"4px 0"}}>
          {soonItems.map((item, idx) => (
            <div key={item.name} style={{
              display:"grid", gridTemplateColumns:"32px 1fr auto", gap:12,
              alignItems:"center", padding:"10px 18px",
              borderBottom: idx < soonItems.length - 1 ? "1px solid var(--line-2)" : 0,
              opacity:0.72,
            }}>
              <IntegrationLogo item={item} size={26}/>
              <div style={{fontSize:13, fontWeight:500}}>{item.name}</div>
              <span className="chip mono" style={{fontSize:9, letterSpacing:".12em", height:20}}>COMING SOON</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationLogo({ item, size = 36 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius: Math.max(4, size*0.17),
      background: item.color || "var(--line-2)",
      color: "#fff",
      display:"grid", placeItems:"center",
      fontWeight:600, fontSize: size*0.4,
      letterSpacing:"-0.01em",
      flex:`0 0 ${size}px`,
      boxShadow:"inset 0 0 0 1px rgba(255,255,255,.14), inset 0 -1px 0 rgba(0,0,0,.1)",
      fontFamily:"'Geist', sans-serif",
    }}>{item.abbr}</div>
  );
}

function IntegrationCard({ item, isLast, expanded, onToggle }) {
  const isConnected = item.status === "connected";
  const isAvailable = item.status === "available";
  const d = item.detail || {};

  return (
    <div style={{borderBottom: isLast ? 0 : "1px solid var(--line-2)"}}>
      {/* Row */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"40px 1fr auto auto auto",
        gap:14, alignItems:"center", padding:"14px 18px",
      }}>
        <IntegrationLogo item={item} size={40}/>
        <div style={{minWidth:0}}>
          <div style={{fontSize:14, fontWeight:500, letterSpacing:"-0.005em"}}>{item.name}</div>
          {isConnected && d.account && (
            <div className="mono" style={{fontSize:11, color:"var(--ink-4)", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
              {d.account}
            </div>
          )}
          {isAvailable && item.note && (
            <div style={{fontSize:11.5, color:"var(--ink-3)", marginTop:2}}>{item.note}</div>
          )}
        </div>

        {/* Status */}
        {isConnected ? (
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{width:7, height:7, borderRadius:"50%", background:"var(--ok)", boxShadow:"0 0 0 3px rgba(15,138,95,.18)"}}/>
            <span style={{fontSize:12, color:"var(--ok)", fontWeight:500}}>Connected</span>
            {d.lastSync && (
              <span className="mono" style={{fontSize:11, color:"var(--ink-4)", marginLeft:6}}>
                · last sync {d.lastSync.ago}
              </span>
            )}
          </div>
        ) : (
          <span className="chip mono" style={{fontSize:10, letterSpacing:".12em", color:"var(--accent)", background:"var(--accent-bg)", borderColor:"var(--accent-line)", height:20}}>
            AVAILABLE
          </span>
        )}

        {/* Actions */}
        {isConnected ? (
          <>
            <button className="btn ghost" onClick={onToggle} style={{fontSize:12}}>
              {expanded ? "Hide details" : "Details"}
            </button>
            <button className="btn" style={{fontSize:12}}><Icon name="refresh"/> Sync now</button>
          </>
        ) : (
          <>
            <div/>
            <button className="btn primary" style={{fontSize:12}}>Connect</button>
          </>
        )}
      </div>

      {/* Expandable detail */}
      {isConnected && expanded && (
        <div style={{
          borderTop:"1px solid var(--line-2)",
          background:"var(--panel-2)",
          padding:"18px 18px 18px 72px",
          display:"grid", gridTemplateColumns:"1fr 1fr", gap:"18px 32px",
        }}>
          <DetailBlock title="Connection">
            <KV k="Account" v={d.account} mono/>
            <KV k="Sync" v={d.sync}/>
            {d.cronStatus && <KV k="Cron" v={<span style={{color:"var(--ok)"}}>{d.cronStatus.toUpperCase()}</span>}/>}
            {d.cached && <KV k="Cached" v={d.cached}/>}
            {d.markets && (
              <KV k="Markets" v={
                <div style={{display:"flex", gap:4}}>
                  {d.markets.map(m => <span key={m} className="chip mono" style={{fontSize:9, letterSpacing:".08em", height:17, padding:"0 6px"}}>{m}</span>)}
                </div>
              }/>
            )}
            {d.contacts && <KV k="Contacts" v={d.contacts}/>}
            {d.lastCampaign && <KV k="Last campaign" v={d.lastCampaign}/>}
          </DetailBlock>

          <DetailBlock title="Last sync">
            {d.lastSync && (
              <>
                <KV k="Status" v={
                  <span style={{color: d.lastSync.ok ? "var(--ok)" : "var(--bad)", display:"flex", alignItems:"center", gap:6}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background: d.lastSync.ok ? "var(--ok)" : "var(--bad)"}}/>
                    {d.lastSync.ok ? "SUCCESS" : "FAILED"}
                  </span>
                }/>
                <KV k="Timestamp" v={d.lastSync.ts} mono/>
                <KV k="Ago" v={d.lastSync.ago}/>
              </>
            )}
            {d.models && (
              <div style={{marginTop:4}}>
                <div className="mono" style={{fontSize:10, letterSpacing:".12em", color:"var(--ink-4)", textTransform:"uppercase", marginBottom:6}}>Active models</div>
                {d.models.map(m => (
                  <div key={m.k} style={{display:"grid", gridTemplateColumns:"80px 1fr", gap:10, fontSize:12, marginBottom:3}}>
                    <span style={{color:"var(--ink-4)"}}>{m.k}</span>
                    <span className="mono" style={{color:"var(--ink)"}}>{m.v}</span>
                  </div>
                ))}
              </div>
            )}
            {d.usage && <KV k="Usage MTD" v={d.usage} mono/>}
            {d.cost && <KV k="Cost MTD" v={d.cost} mono/>}
          </DetailBlock>

          <DetailBlock title="Data flowing">
            {d.reads && d.reads.length > 0 && (
              <div style={{marginBottom:10}}>
                <div className="mono" style={{fontSize:10, letterSpacing:".12em", color:"var(--ink-4)", textTransform:"uppercase", marginBottom:6}}>
                  AGOS reads ←
                </div>
                <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
                  {d.reads.map(r => <span key={r} className="chip mono" style={{fontSize:10, letterSpacing:".04em", height:19}}>{r}</span>)}
                </div>
              </div>
            )}
            {d.writes && d.writes.length > 0 && (
              <div>
                <div className="mono" style={{fontSize:10, letterSpacing:".12em", color:"var(--accent)", textTransform:"uppercase", marginBottom:6}}>
                  AGOS writes →
                </div>
                <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
                  {d.writes.map(w => <span key={w} className="chip mono" style={{fontSize:10, letterSpacing:".04em", height:19, color:"var(--accent)", background:"var(--accent-bg)", borderColor:"var(--accent-line)"}}>{w}</span>)}
                </div>
              </div>
            )}
          </DetailBlock>

          <DetailBlock title="Actions">
            <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              <button className="btn ghost" style={{fontSize:12}}>Test connection</button>
              <button className="btn ghost" style={{fontSize:12}}>Configure</button>
              <button className="btn ghost" style={{fontSize:12, color:"var(--bad)", borderColor:"color-mix(in srgb, var(--bad) 30%, transparent)"}}>Disconnect</button>
            </div>
            <div style={{fontSize:11, color:"var(--ink-4)", marginTop:10, lineHeight:1.5}}>
              Disconnecting requires confirmation and pauses any agents that depend on this integration.
            </div>
          </DetailBlock>
        </div>
      )}
    </div>
  );
}

function DetailBlock({ title, children }) {
  return (
    <div>
      <div className="mono" style={{fontSize:10, letterSpacing:".14em", color:"var(--ink-4)", textTransform:"uppercase", marginBottom:10, fontWeight:600}}>
        {title}
      </div>
      <div style={{display:"flex", flexDirection:"column", gap:6}}>
        {children}
      </div>
    </div>
  );
}

function KV({ k, v, mono }) {
  return (
    <div style={{display:"grid", gridTemplateColumns:"110px 1fr", gap:10, fontSize:12, alignItems:"start"}}>
      <span style={{color:"var(--ink-4)"}}>{k}</span>
      <span className={mono ? "mono" : ""} style={{color:"var(--ink-2)"}}>{v}</span>
    </div>
  );
}

window.IntegrationsTab = IntegrationsTab;
