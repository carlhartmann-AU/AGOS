// Intelligence / Reports page — output of the Intelligence agent

const LATEST_REPORT = {
  window: "Apr 13 – Apr 19, 2026",
  generated: "2h ago",
  model: "claude-sonnet-4.6",
  tokens: 1847,
  cost: "$0.02",
  duration: "340ms",
  narrator: true,
  narrative: [
    "Revenue held steady at AU$7,676 for the week, a 4.2% lift on the prior 7d window, driven almost entirely by a 32% spike on Apr 19 tied to the Autumn Taper email campaign.",
    "Content throughput stayed healthy — 18 pieces approved against 22 generated, an 82% approval rate — with the Compliance agent catching 3 TGA-adjacent claims before human review, saving an estimated 40 minutes of queue time.",
    "The biggest risk this week sits on ad spend: Meta prospecting hit its daily cap twice and auto-paused, flagging an underfunded funnel while Google search is over-delivering on branded keywords.",
    "Recommend reallocating AU$1,200 from Meta broad → Google branded defence, and pulling forward the Anzac Day nurture (planned May 2) to capture April's elevated email intent.",
  ],
  revenue: {
    total: "AU$7,676", delta: +4.2, orders: 214, aov: "AU$35.87",
    newCust: 142, returnCust: 72,
    spark: [820,910,780,1120,960,1040,1180,1060,1240,1180,1310,1220,1340],
    bestDay: "Apr 19 · AU$1,412", worstDay: "Apr 15 · AU$782",
  },
  content: {
    generated: 22, approved: 18, rejected: 2, published: 14,
    approvalRate: 82, avgApproveTime: "3h 12m",
    byType: [ {n:"Blog", v:6}, {n:"Email", v:9}, {n:"Social", v:5}, {n:"PDP", v:2} ],
  },
  compliance: {
    checks: 47, passRate: 94,
    topRules: [
      { rule: "health_supplements_au/therapeutic-claim", count: 8, sev: "esc" },
      { rule: "general_marketing/absolutes",              count: 6, sev: "warn" },
      { rule: "brand_voice/superlatives",                  count: 3, sev: "warn" },
    ],
    autoFixed: 12, llmCost: "$0.08",
  },
};

const RECOMMENDATIONS = [
  { pri: "high",   cat: "revenue",    title: "Reallocate AU$1,200 Meta → Google branded defence",
    desc: "Meta prospecting paused twice this week at daily cap; Google branded is over-delivering at 0.8× target CAC.",
    action: "Route to Budget Allocator · requires approval (> AU$1k cap)" },
  { pri: "high",   cat: "content",    title: "Pull forward Anzac Day nurture from May 2 → Apr 25",
    desc: "Email intent is elevated 18% WoW. The planned May 2 send misses peak window and competes with May promotional noise.",
    action: "Reschedule in Content Studio · requires Editor pass" },
  { pri: "medium", cat: "compliance", title: "Review health_supplements_au/therapeutic-claim triggers",
    desc: "8 WARN hits this week, up from 3. Likely tied to Autumn-focused copy implying seasonal immunity benefits.",
    action: "Check brand-voice glossary for seasonal claim pattern" },
  { pri: "medium", cat: "content",    title: "Add 2 PDP refreshes to next-week brief",
    desc: "Only 2 PDPs shipped vs the 4-per-week target. Strategy agent suggests PLS-240 and PLS-180 are overdue.",
    action: "Content Strategy will draft briefs overnight" },
  { pri: "low",    cat: "operations", title: "Retry Meta Ads sync policy",
    desc: "Performance Analytics logged 3 retry events in 7d. Token probably refreshes fine but backoff feels conservative.",
    action: "Tune in Integrations settings" },
];

const ANOMALIES = [
  { sev: "warn", title: "Revenue spike · Apr 19",
    desc: "AU$1,412 on Apr 19 · 3.2× the daily average for the window. Attribution traces to Autumn Taper send (em-0081)." },
  { sev: "esc",  title: "Meta auto-pause · 2 events",
    desc: "PLM-AU-Daily-Prospecting hit cap at 14:02 and 20:41. Check daily cap or pacing policy." },
];

const HISTORY = [
  { range: "Apr 13 – Apr 19, 2026", type: "weekly",    narrator: true,  dur: "340ms", cost: "$0.02", current: true },
  { range: "Apr 06 – Apr 12, 2026", type: "weekly",    narrator: true,  dur: "320ms", cost: "$0.02" },
  { range: "Mar 30 – Apr 05, 2026", type: "weekly",    narrator: true,  dur: "380ms", cost: "$0.03" },
  { range: "Mar 23 – Mar 29, 2026", type: "weekly",    narrator: true,  dur: "310ms", cost: "$0.02" },
  { range: "Mar 19, 2026",           type: "on-demand", narrator: false, dur: "140ms", cost: "$0.00" },
  { range: "Mar 16 – Mar 22, 2026", type: "weekly",    narrator: true,  dur: "290ms", cost: "$0.02" },
];

function Ring({ pct, size = 56 }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth="4"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--accent)" strokeWidth="4"
              strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
              transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2} dy="3" textAnchor="middle" fontSize="13" fontWeight="500" fontFamily="Geist" fill="var(--ink)">{pct}%</text>
    </svg>
  );
}

function PriChip({ pri }) {
  const map = { high: "bad", medium: "warn", low: "accent" };
  return <span className={`chip mono ${map[pri] || ""}`}><span className="dot"/>{pri.toUpperCase()}</span>;
}

function IntelligencePage({ tweaks }) {
  const [range, setRange] = useState("7d");
  const [narratorOn, setNarratorOn] = useState(true);
  const r = LATEST_REPORT;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Intelligence</h1>
          <div className="page-sub">Weekly and on-demand executive reports · revenue, content, compliance · rolled up by the Intelligence agent.</div>
        </div>
        <div className="page-meta">
          <Seg options={["7d","30d","MTD","Custom"]} value={range} onChange={setRange}/>
          <button className="btn"><Icon name="doc"/> History</button>
          <button className="btn primary"><Icon name="refresh"/> Generate report</button>
        </div>
      </div>

      {/* LATEST REPORT */}
      <div className="section-head">
        <h2>Latest report <span className="desc">· {r.window}</span></h2>
        <div className="row" style={{gap:8}}>
          <label className="row" style={{gap:6, fontSize:11, color:"var(--ink-3)"}}>
            <span className="mono" style={{fontSize:10, letterSpacing:".08em", textTransform:"uppercase"}}>Narrator</span>
            <span className="switch">
              <input type="checkbox" checked={narratorOn} onChange={e => setNarratorOn(e.target.checked)}/>
              <span className="slider"/>
            </span>
          </label>
        </div>
      </div>

      {narratorOn ? (
        <div className="report-narrative card">
          <div className="narr-accent"/>
          <div className="narr-body">
            <div className="narr-meta mono">
              <span>EXECUTIVE SUMMARY</span>
              <span>·</span>
              <span>{r.window}</span>
            </div>
            {r.narrative.map((p, i) => <p key={i}>{p}</p>)}
            <div className="narr-foot mono">
              <span>Generated {r.generated}</span>
              <span>·</span>
              <span>{r.model}</span>
              <span>·</span>
              <span>{r.tokens.toLocaleString()} tokens</span>
              <span>·</span>
              <span>{r.cost}</span>
              <span>·</span>
              <span>{r.duration}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{padding:"14px 18px", background:"var(--panel-2)", display:"flex", alignItems:"center", gap:10, color:"var(--ink-3)"}}>
          <Icon name="doc" size={14}/>
          <span style={{fontSize:12}}>Data-only report · AI narrative not generated. Toggle narrator on to get the executive summary.</span>
        </div>
      )}

      {/* THREE SUMMARY CARDS */}
      <div className="report-summary">
        {/* Revenue */}
        <div className="card">
          <div className="card-head">
            <h3>Revenue</h3>
            <Chip kind="ok" mono>↑ {r.revenue.delta}%</Chip>
          </div>
          <div className="card-body">
            <div className="row" style={{justifyContent:"space-between", alignItems:"baseline"}}>
              <div style={{fontSize:26, fontWeight:500, letterSpacing:"-0.02em"}} className="tnum">{r.revenue.total}</div>
              <span className="mono" style={{fontSize:10, color:"var(--ink-4)"}}>7D</span>
            </div>
            <div className="mt-8"><Sparkline data={r.revenue.spark} height={40} style={tweaks.chartStyle}/></div>
            <div className="kv mt-12" style={{gridTemplateColumns:"110px 1fr", rowGap:5}}>
              <div className="k">Orders</div>        <div className="v mono tnum">{r.revenue.orders}</div>
              <div className="k">AOV</div>           <div className="v mono tnum">{r.revenue.aov}</div>
              <div className="k">New / Return</div>  <div className="v mono tnum">{r.revenue.newCust} / {r.revenue.returnCust}</div>
              <div className="k">Best day</div>      <div className="v mono" style={{color:"var(--ok)"}}>{r.revenue.bestDay}</div>
              <div className="k">Worst day</div>    <div className="v mono" style={{color:"var(--ink-3)"}}>{r.revenue.worstDay}</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="card">
          <div className="card-head">
            <h3>Content</h3>
            <Chip mono>{r.content.approvalRate}% approved</Chip>
          </div>
          <div className="card-body">
            <div className="row" style={{gap:16, alignItems:"center"}}>
              <Ring pct={r.content.approvalRate}/>
              <div className="kv" style={{gridTemplateColumns:"90px 1fr", rowGap:4, flex:1}}>
                <div className="k">Generated</div> <div className="v mono tnum">{r.content.generated}</div>
                <div className="k">Approved</div>  <div className="v mono tnum">{r.content.approved}</div>
                <div className="k">Rejected</div>  <div className="v mono tnum">{r.content.rejected}</div>
                <div className="k">Published</div> <div className="v mono tnum">{r.content.published}</div>
                <div className="k">Avg approve</div><div className="v mono">{r.content.avgApproveTime}</div>
              </div>
            </div>
            <hr className="hr mt-12 mb-8"/>
            <div className="mono" style={{fontSize:10, letterSpacing:".1em", color:"var(--ink-4)", marginBottom:6}}>BY TYPE</div>
            <div className="type-bars">
              {r.content.byType.map((t, i) => (
                <div key={i} className="tb-row">
                  <span style={{fontSize:11}}>{t.n}</span>
                  <div className="tb-track"><div className="tb-fill" style={{width: (t.v / 9 * 100) + "%"}}/></div>
                  <span className="mono tnum" style={{fontSize:11, color:"var(--ink-3)"}}>{t.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compliance */}
        <div className="card">
          <div className="card-head">
            <h3>Compliance</h3>
            <Chip kind="ok" mono>{r.compliance.passRate}% pass</Chip>
          </div>
          <div className="card-body">
            <div className="row" style={{alignItems:"baseline", gap:8, marginBottom:8}}>
              <div style={{fontSize:28, fontWeight:500, letterSpacing:"-0.02em"}} className="tnum">{r.compliance.passRate}<span style={{fontSize:14, color:"var(--ink-4)"}}>%</span></div>
              <span className="mono" style={{fontSize:10, color:"var(--ink-4)"}}>{r.compliance.checks} CHECKS</span>
            </div>
            <div className="mono" style={{fontSize:10, letterSpacing:".1em", color:"var(--ink-4)", marginBottom:6}}>TOP TRIGGERS</div>
            {r.compliance.topRules.map((x, i) => (
              <div key={i} className="row" style={{padding:"5px 0", borderBottom: i < 2 ? "1px solid var(--line-2)" : 0, justifyContent:"space-between", gap:8}}>
                <div className="row" style={{gap:6, minWidth:0, flex:1}}>
                  <SevChip sev={x.sev}/>
                  <span className="mono" style={{fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{x.rule}</span>
                </div>
                <span className="mono tnum" style={{fontSize:11, color:"var(--ink-3)"}}>{x.count}×</span>
              </div>
            ))}
            <hr className="hr mt-8 mb-8"/>
            <div className="kv" style={{gridTemplateColumns:"110px 1fr", rowGap:4}}>
              <div className="k">Auto-fixed</div> <div className="v mono tnum">{r.compliance.autoFixed}</div>
              <div className="k">LLM cost</div>   <div className="v mono tnum">{r.compliance.llmCost}</div>
            </div>
          </div>
        </div>
      </div>

      {/* RECOMMENDATIONS */}
      <div className="section-head mt-16">
        <h2>Recommendations <span className="desc">· {RECOMMENDATIONS.length} this period · ranked by priority</span></h2>
      </div>
      <div className="rec-grid">
        {RECOMMENDATIONS.map((rec, i) => (
          <div key={i} className="rec-card">
            <div className="rec-top">
              <PriChip pri={rec.pri}/>
              <span className="chip mono">{rec.cat.toUpperCase()}</span>
            </div>
            <div className="rec-title">{rec.title}</div>
            <div className="rec-desc">{rec.desc}</div>
            <div className="rec-action mono">▸ {rec.action}</div>
          </div>
        ))}
      </div>

      {/* ANOMALIES */}
      {ANOMALIES.length > 0 && (
        <>
          <div className="section-head mt-16">
            <h2>Anomalies detected <span className="desc">· {ANOMALIES.length} signals worth a look</span></h2>
          </div>
          <div className="card">
            {ANOMALIES.map((a, i) => (
              <div key={i} className="alert-row">
                <span className={`bar ${a.sev}`}/>
                <div>
                  <div className="title">{a.title}</div>
                  <div className="meta"><span className="mono">{a.desc}</span></div>
                </div>
                <div className="actions">
                  <button className="btn ghost">Dismiss</button>
                  <button className="btn">Inspect</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* HISTORY */}
      <div className="section-head mt-16">
        <h2>Historical reports <span className="desc">· {HISTORY.length} on record</span></h2>
        <button className="btn ghost"><Icon name="doc"/> Export all</button>
      </div>
      <div className="card">
        <div style={{display:"grid", gridTemplateColumns:"1.5fr 90px 100px 90px 80px 80px", padding:"8px 14px", fontSize:10, letterSpacing:".12em", textTransform:"uppercase", color:"var(--ink-4)", fontWeight:500, borderBottom:"1px solid var(--line)", background:"var(--panel-2)"}}>
          <div>Date range</div><div>Type</div><div>Narrator</div><div>Duration</div><div>Cost</div><div></div>
        </div>
        {HISTORY.map((h, i) => (
          <div key={i} style={{display:"grid", gridTemplateColumns:"1.5fr 90px 100px 90px 80px 80px", padding:"10px 14px", fontSize:12, borderBottom: i < HISTORY.length - 1 ? "1px solid var(--line-2)" : 0, alignItems:"center", background: h.current ? "var(--accent-bg)" : "transparent", cursor:"pointer"}}>
            <div>
              <span style={{fontWeight: h.current ? 500 : 400}}>{h.range}</span>
              {h.current && <span className="chip accent mono" style={{marginLeft:8, fontSize:9, height:16}}><span className="dot"/>CURRENT</span>}
            </div>
            <div className="mono" style={{color:"var(--ink-3)"}}>{h.type}</div>
            <div><span className={`chip mono ${h.narrator ? "ok" : ""}`} style={{fontSize:10, height:18}}><span className="dot"/>{h.narrator ? "ON" : "DATA-ONLY"}</span></div>
            <div className="mono tnum" style={{color:"var(--ink-3)"}}>{h.dur}</div>
            <div className="mono tnum" style={{color:"var(--ink-3)"}}>{h.cost}</div>
            <div style={{textAlign:"right"}}>
              <button className="btn ghost" style={{padding:"0 8px"}}>View ▸</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.IntelligencePage = IntelligencePage;
