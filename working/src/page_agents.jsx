// Agents page — 4 active · 8 coming soon
// Aligned to the build roadmap: Content Strategy, Compliance, Intelligence, Performance Analytics are live.

const AGENTS = [
  // ───────── ACTIVE ─────────
  {
    id: "agent-content-strategy", tag: "CNT-01", name: "Content Strategy",
    role: "Content", icon: "brush", status: "active", phase: 1,
    desc: "Maps editorial calendar against SKU launches, seasons, and topic-authority gaps. Routes briefs to writers.",
    model: "claude-sonnet-4.6", temp: 0.5,
    task: "Assembling next-week brief · 9 topics queued",
    metric: "42 pieces this week", lastRun: "32s ago",
    spark: [3,4,5,4,6,5,7,6,8,7,9,8,10,9,11,10,12,11,13,12,14,13,14],
    tools: ["Shopify", "Brand voice", "Calendar", "Topic graph"],
    runs: [
      { t: "12:04", status: "ok",   dur: "1.2s", cost: "$0.01", note: "Brief generated · bd-0034 outline" },
      { t: "11:47", status: "ok",   dur: "0.9s", cost: "$0.01", note: "Topic authority sweep · Q3 gaps identified" },
      { t: "11:12", status: "ok",   dur: "1.4s", cost: "$0.02", note: "Editorial calendar refreshed · 7d window" },
      { t: "10:35", status: "ok",   dur: "1.1s", cost: "$0.01", note: "Brief generated · em-0089 · L2-winback" },
      { t: "09:58", status: "warn", dur: "2.3s", cost: "$0.03", note: "Slow topic research · Ahrefs rate-limited" },
    ],
  },
  {
    id: "agent-compliance", tag: "CMP-03", name: "Compliance",
    role: "Compliance", icon: "shield", status: "active", phase: 1,
    desc: "Runs installed rule packs (health_supplements_au, general_marketing, brand_voice). Flags at WARN, ESC, BLOCK severities.",
    model: "claude-sonnet-4.6", temp: 0.1,
    task: "Scanning 3 drafts · 1 WARN flagged",
    metric: "94% pass rate", lastRun: "12s ago",
    spark: [92,93,91,94,93,95,94,96,95,94,93,95,94,96,95,94,93,95,94,94,95,94,94],
    tools: ["health_supplements_au", "general_marketing", "brand_voice"],
    runs: [
      { t: "12:04", status: "ok",   dur: "310ms", cost: "$0.00", note: "bd-0032 · all packs passed" },
      { t: "12:02", status: "warn", dur: "420ms", cost: "$0.01", note: "ig-0451 · PRI-REG-AU trigger · auto-fix offered" },
      { t: "12:00", status: "ok",   dur: "280ms", cost: "$0.00", note: "em-0089 · all packs passed" },
      { t: "11:58", status: "esc",  dur: "510ms", cost: "$0.01", note: "bd-0031 · superlative · escalated to Steve" },
      { t: "11:54", status: "ok",   dur: "290ms", cost: "$0.00", note: "pd-0012 · all packs passed" },
    ],
  },
  {
    id: "agent-intelligence", tag: "INT", name: "Intelligence",
    role: "Analytics", icon: "brain", status: "active", phase: 1,
    desc: "Weekly and on-demand executive reports. Combines revenue, content, and compliance telemetry into narrative + recommendations.",
    model: "claude-sonnet-4.6", temp: 0.4,
    task: "Idle · next scheduled Mon 09:00 AEST",
    metric: "Last report: 2h ago", lastRun: "2h ago",
    spark: [0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0],
    tools: ["Shopify", "Internal telemetry", "Xero (planned)", "Narrator"],
    runs: [
      { t: "10:02", status: "ok", dur: "340ms", cost: "$0.02", note: "Weekly report · Apr 13–19 · 1,847 tokens" },
      { t: "Apr 12", status: "ok", dur: "320ms", cost: "$0.02", note: "Weekly report · Apr 06–12 · 1,792 tokens" },
      { t: "Apr 05", status: "ok", dur: "380ms", cost: "$0.03", note: "Weekly report · Mar 30–Apr 05 · 2,014 tokens" },
      { t: "Mar 29", status: "ok", dur: "310ms", cost: "$0.02", note: "Weekly report · Mar 23–29 · 1,680 tokens" },
    ],
  },
  {
    id: "agent-performance", tag: "ANL-04", name: "Performance Analytics",
    role: "Analytics", icon: "chart", status: "active", phase: 1,
    desc: "Unifies Shopify, Meta, Google and Klaviyo into one pulse. Tracks revenue, CAC, approval-rate, content→conversion attribution.",
    model: "claude-haiku-4.5", temp: 0.2,
    task: "Rolling up 24h revenue feed · 214 SKUs",
    metric: "£7,676 7d revenue", lastRun: "47s ago",
    spark: [820,910,780,1120,960,1040,1180,1060,1240,1180,1310,1220,1340,1280,1410,1320,1290,1380,1240,1320,1280,1190,1210],
    tools: ["Shopify", "Triple Whale (out)", "Meta Ads (read)", "Google Ads (read)"],
    runs: [
      { t: "12:04", status: "ok",   dur: "220ms", cost: "$0.00", note: "Shopify revenue roll-up complete" },
      { t: "11:59", status: "ok",   dur: "410ms", cost: "$0.01", note: "Attribution snapshot · last-click model" },
      { t: "11:54", status: "warn", dur: "1.8s",  cost: "$0.01", note: "Meta Ads sync lag · retry queued" },
      { t: "11:49", status: "ok",   dur: "180ms", cost: "$0.00", note: "SKU pulse · 3 movers flagged" },
    ],
  },

  // ───────── COMING SOON (8) ─────────
  { id: "agent-coo",            tag: "ORCH",   name: "Digital COO",
    role: "Orchestration", icon: "brain", status: "soon", phase: 2,
    desc: "Plans the week from last week's data. Routes work across agents. Surfaces what needs a human." },
  { id: "agent-campaigns",      tag: "CMP-02", name: "Campaign Execution",
    role: "Growth", icon: "zap", status: "soon", phase: 2,
    desc: "Ships email, SMS, and social at the scheduled moments. Respects send-time guardrails and brand voice." },
  { id: "agent-content-exec",   tag: "CNT-02", name: "Content Execution",
    role: "Content", icon: "brush", status: "soon", phase: 2,
    desc: "Drafts across formats — blog, email, social, PDP — using brand voice, SKU facts and brief from Strategy." },
  { id: "agent-cfo",            tag: "FIN-05", name: "CFO",
    role: "Financial", icon: "chart", status: "soon", phase: 3,
    desc: "P&L, CAC, LTV, payback. Syncs with Xero. Flags spend that breaches policy before it ships." },
  { id: "agent-growth",         tag: "GRO-06", name: "Growth",
    role: "Growth", icon: "zap", status: "soon", phase: 3,
    desc: "Budget allocation across channels. Proposes shifts based on Performance Analytics and CFO constraints." },
  { id: "agent-support",        tag: "SUP-07", name: "Support",
    role: "CX", icon: "shield", status: "soon", phase: 4,
    desc: "Tier-1 ticket handling via Gorgias. Escalates refunds > policy cap. Learns from approved human responses." },
  { id: "agent-personalize",    tag: "PER-08", name: "Personalization",
    role: "Growth", icon: "brush", status: "soon", phase: 4,
    desc: "On-site and email personalization. Segments customers by intent, recency and compliance-safe traits." },
  { id: "agent-operations",     tag: "OPS-09", name: "Operations",
    role: "Commerce", icon: "shield", status: "soon", phase: 5,
    desc: "Inventory, supplier SLAs, reorder timing. Flags stock-outs before they impact campaigns." },
];

const ACTIVITY = [
  { t: "12:04:18", agent: "agent-compliance",       sev: "ok",   msg: "bd-0032 · all packs passed · 310ms" },
  { t: "12:04:02", agent: "agent-performance",      sev: "ok",   msg: "Revenue roll-up complete · AU$18.2k 24h" },
  { t: "12:03:51", agent: "agent-content-strategy", sev: "ok",   msg: "Brief generated · bd-0034 outline · 5 H2s" },
  { t: "12:02:44", agent: "agent-compliance",       sev: "esc",  msg: "ig-0451 · PRI-REG-AU · auto-fix offered" },
  { t: "12:02:18", agent: "agent-performance",      sev: "warn", msg: "Meta Ads sync lag · 1.8s · retry queued" },
  { t: "12:01:47", agent: "agent-content-strategy", sev: "ok",   msg: "Topic authority sweep · 3 Q3 gaps identified" },
  { t: "12:01:12", agent: "agent-compliance",       sev: "ok",   msg: "em-0089 · all packs passed · 280ms" },
  { t: "12:00:33", agent: "agent-performance",      sev: "ok",   msg: "Attribution snapshot · last-click model" },
  { t: "10:02:11", agent: "agent-intelligence",     sev: "ok",   msg: "Weekly report generated · Apr 13–19 · $0.02" },
  { t: "09:58:07", agent: "agent-compliance",       sev: "esc",  msg: "bd-0031 · superlative · escalated to Steve" },
];

function StatusDot({ status }) {
  const map = {
    active: { cls: "ok",  label: "ACTIVE" },
    soon:   { cls: "",    label: "COMING SOON" },
    error:  { cls: "bad", label: "ERROR" },
    paused: { cls: "warn", label: "PAUSED" },
  };
  const m = map[status] || map.soon;
  return <span className={`chip mono ${m.cls}`}><span className="dot"/>{m.label}</span>;
}

function AgentCard({ agent, selected, onSelect, chartStyle }) {
  const isSoon = agent.status === "soon";
  return (
    <div
      className={`agent-card ${selected ? "sel" : ""} ${isSoon ? "soon" : ""}`}
      onClick={onSelect}
    >
      <div className="ag-top">
        <div className="ag-ico"><Icon name={agent.icon}/></div>
        <div className="stack" style={{flex:1, minWidth:0}}>
          <div className="ag-name">{agent.name}</div>
          <div className="ag-id mono">{agent.tag} · {agent.id}</div>
        </div>
        <StatusDot status={agent.status}/>
      </div>
      <div className="ag-desc">{agent.desc}</div>

      {!isSoon && (
        <>
          <div className="ag-task">{agent.task}</div>
          <div className="ag-spark">
            <Sparkline data={agent.spark} height={28} style={chartStyle}/>
          </div>
          <div className="ag-metrics">
            <div>
              <div className="agm-l">Key metric</div>
              <div className="agm-v" style={{fontSize:13}}>{agent.metric}</div>
            </div>
            <div>
              <div className="agm-l">Last run</div>
              <div className="agm-v mono" style={{fontSize:11, fontWeight:400}}>{agent.lastRun}</div>
            </div>
          </div>
        </>
      )}

      {isSoon && (
        <div className="ag-soon-row">
          <span className="chip mono">PHASE {agent.phase}</span>
          <span className="mono" style={{fontSize:11, color:"var(--ink-4)"}}>not yet configured</span>
        </div>
      )}
    </div>
  );
}

function AgentDetail({ agent, chartStyle }) {
  if (!agent) {
    return (
      <div className="empty">
        <div className="glyph">◎</div>
        <div className="h">Select an agent</div>
        <div>Click any card to see tools, recent runs and configuration.</div>
      </div>
    );
  }
  const isSoon = agent.status === "soon";
  return (
    <div className="ag-detail">
      <div className="ag-detail-head">
        <div className="stack">
          <div className="row" style={{gap:8, marginBottom:4}}>
            <div className="ag-ico" style={{width:22, height:22}}><Icon name={agent.icon} size={12}/></div>
            <span style={{fontWeight:500, fontSize:14}}>{agent.name}</span>
          </div>
          <div className="mono" style={{fontSize:10, color:"var(--ink-4)"}}>{agent.tag} · {agent.id}</div>
        </div>
        <StatusDot status={agent.status}/>
      </div>
      <div className="ag-detail-body">
        <div style={{fontSize:12, color:"var(--ink-2)", lineHeight:1.5, marginBottom:12}}>{agent.desc}</div>

        {isSoon ? (
          <div className="empty" style={{padding:"20px 0", borderTop:"1px dashed var(--line)"}}>
            <div className="glyph">⌬</div>
            <div className="h">Not yet configured</div>
            <div>Ships in phase {agent.phase}. Role slot reserved.</div>
          </div>
        ) : (
          <>
            <div className="kv">
              <div className="k">Role</div>      <div className="v">{agent.role}</div>
              <div className="k">Model</div>     <div className="v mono">{agent.model}</div>
              <div className="k">Temp</div>      <div className="v mono tnum">{agent.temp.toFixed(2)}</div>
              <div className="k">Last run</div>  <div className="v mono">{agent.lastRun}</div>
            </div>

            <div className="section-head" style={{marginTop:14, marginBottom:8}}>
              <h2 style={{fontSize:10}}>Tools & scopes</h2>
            </div>
            <div className="row" style={{flexWrap:"wrap", gap:4}}>
              {agent.tools.map(t => <span key={t} className="chip mono" style={{fontSize:10, height:18}}>{t}</span>)}
            </div>

            <div className="section-head" style={{marginTop:14, marginBottom:8}}>
              <h2 style={{fontSize:10}}>Recent runs</h2>
            </div>
            <div style={{border:"1px solid var(--line)", borderRadius:6, overflow:"hidden"}}>
              {agent.runs.map((r, i) => (
                <div key={i} style={{display:"grid", gridTemplateColumns:"48px 20px 1fr 52px 48px", gap:8, padding:"7px 10px", fontSize:11, alignItems:"center", borderBottom: i < agent.runs.length - 1 ? "1px solid var(--line-2)" : 0}}>
                  <span className="mono" style={{color:"var(--ink-4)"}}>{r.t}</span>
                  <span style={{width:6, height:6, borderRadius:"50%", background: r.status === "ok" ? "var(--ok)" : r.status === "warn" ? "var(--warn)" : r.status === "esc" ? "var(--esc)" : "var(--bad)"}}/>
                  <span style={{color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{r.note}</span>
                  <span className="mono tnum" style={{color:"var(--ink-4)", textAlign:"right"}}>{r.dur}</span>
                  <span className="mono tnum" style={{color:"var(--ink-4)", textAlign:"right"}}>{r.cost}</span>
                </div>
              ))}
            </div>

            <div className="row mt-12" style={{gap:6}}>
              <button className="btn">Pause</button>
              <button className="btn">View logs</button>
              <button className="btn primary">Configure</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AgentsPage({ tweaks }) {
  const [selected, setSelected] = useState(AGENTS[0].id);
  const [showAll, setShowAll] = useState(true);

  const active = AGENTS.filter(a => a.status === "active");
  const soon   = AGENTS.filter(a => a.status === "soon");
  const display = showAll ? AGENTS : active;

  const fleet = {
    active: active.length,
    soon:   soon.length,
    total:  AGENTS.length,
  };

  const sel = AGENTS.find(a => a.id === selected);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Agents</h1>
          <div className="page-sub">Plasmaide · {fleet.active} active · {fleet.soon} coming soon. Agents run within policy and escalate on breach.</div>
        </div>
        <div className="page-meta">
          <Chip kind="ok" mono><span className="dot"/> {fleet.active} ACTIVE</Chip>
          <Seg options={["Show all", "Active only"]} value={showAll ? "Show all" : "Active only"} onChange={v => setShowAll(v === "Show all")}/>
          <button className="btn"><Icon name="doc"/> Roadmap</button>
        </div>
      </div>

      {/* Fleet KPIs */}
      <div className="kpi-grid mb-16">
        <div className="kpi-tile">
          <div className="kpi-label">Fleet</div>
          <div className="kpi-value tnum">{fleet.active}<span className="unit">/ {fleet.total} active</span></div>
          <div className="row mt-4" style={{gap:6}}>
            <span className="chip ok mono"><span className="dot"/>{fleet.active} ACTIVE</span>
            <span className="chip mono"><span className="dot"/>{fleet.soon} SOON</span>
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Actions · 24h</div>
          <div className="kpi-value tnum">128</div>
          <div><span className="kpi-delta up">▲ 12.3%</span><span className="kpi-meta mono">vs 7d avg</span></div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Compliance avg</div>
          <div className="kpi-value tnum">94<span className="unit">%</span></div>
          <div><span className="kpi-delta up">▲ 1.2%</span><span className="kpi-meta mono">7d rolling</span></div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">LLM cost · 7d</div>
          <div className="kpi-value tnum">$1.42</div>
          <div><span className="kpi-meta mono">SONNET 4.6 · HAIKU 4.5</span></div>
        </div>
      </div>

      <div className="section-head">
        <h2>Agent roster <span className="desc">· {display.length} of {AGENTS.length} shown · click to inspect</span></h2>
      </div>

      <div className="agents-layout">
        <div className="agents-grid">
          {display.map(a => (
            <AgentCard
              key={a.id}
              agent={a}
              selected={a.id === selected}
              onSelect={() => setSelected(a.id)}
              chartStyle={tweaks.chartStyle}
            />
          ))}
        </div>

        <div className="agents-side">
          <div className="card">
            <div className="card-head">
              <h3>Selected agent</h3>
            </div>
            <AgentDetail agent={sel} chartStyle={tweaks.chartStyle}/>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Activity stream</h3>
              <span className="chip ok mono"><span className="dot"/>LIVE</span>
            </div>
            <div className="activity-stream">
              {ACTIVITY.map((a, i) => (
                <div key={i} className="activity-row">
                  <span className={`activity-bar ${a.sev}`}/>
                  <span className="mono activity-t">{a.t}</span>
                  <span className="activity-agent mono">{a.agent}</span>
                  <span className="activity-msg">{a.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AgentsPage = AgentsPage;
