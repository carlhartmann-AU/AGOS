// Mock data for AGOS dashboard
window.AGOS_DATA = (() => {
  // deterministic pseudorandom
  function rng(seed) {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function trend(n, base, variance, seed) {
    const r = rng(seed);
    const out = [];
    let v = base;
    for (let i = 0; i < n; i++) {
      v = v + (r() - 0.48) * variance;
      v = Math.max(base * 0.5, v);
      out.push(Math.round(v));
    }
    return out;
  }

  const currencies = {
    AUD: { sym: "A$", rate: 1.0 },
    USD: { sym: "$",  rate: 0.66 },
    GBP: { sym: "£",  rate: 0.52 },
    EUR: { sym: "€",  rate: 0.61 },
  };

  const windows = {
    "24h": { label: "24h", points: 24, step: "h" },
    "7d":  { label: "7d",  points: 7,  step: "d" },
    "30d": { label: "30d", points: 30, step: "d" },
    "MTD": { label: "MTD", points: 20, step: "d" },
  };

  const kpisBase = {
    "24h": { revenue: 4280, orders: 38,  aov: 112.6, newCust: 18  },
    "7d":  { revenue: 32140, orders: 284, aov: 113.2, newCust: 142 },
    "30d": { revenue: 128500, orders: 1124, aov: 114.3, newCust: 548 },
    "MTD": { revenue: 84210, orders: 742, aov: 113.5, newCust: 362 },
  };

  const deltas = {
    "24h": { revenue: +6.2, orders: +3.1, aov: +2.4, newCust: +12.5 },
    "7d":  { revenue: +2.8, orders: -1.2, aov: +4.1, newCust: +8.9 },
    "30d": { revenue: +14.5, orders: +9.4, aov: +4.7, newCust: +22.1 },
    "MTD": { revenue: +11.2, orders: +6.8, aov: +4.2, newCust: +16.0 },
  };

  const sparks = {
    revenue: {
      "24h": trend(24, 180, 60, 11),
      "7d":  trend(7, 4600, 600, 12),
      "30d": trend(30, 4280, 700, 13),
      "MTD": trend(20, 4210, 650, 14),
    },
    orders: {
      "24h": trend(24, 1.6, 1.2, 21),
      "7d":  trend(7, 40, 8, 22),
      "30d": trend(30, 37, 10, 23),
      "MTD": trend(20, 37, 9, 24),
    },
    aov: {
      "24h": trend(24, 112, 6, 31),
      "7d":  trend(7, 113, 3, 32),
      "30d": trend(30, 114, 4, 33),
      "MTD": trend(20, 113, 3, 34),
    },
    newCust: {
      "24h": trend(24, 0.75, 0.6, 41),
      "7d":  trend(7, 20, 5, 42),
      "30d": trend(30, 18, 6, 43),
      "MTD": trend(20, 18, 5, 44),
    },
  };

  const contentStats = {
    generated: 347,
    pending: 18,
    published: 284,
    approvalRate: 91.3,
  };

  const contentItems = [
    { id: "c_9214", title: "Pine Bark's Role in Circulatory Health — Autumn Edition", type: "blog",    status: "pending",   date: "4m ago",  words: 1120, compliance: "warnings" },
    { id: "c_9213", title: "Your April restock is here — free shipping over $80", type: "email",    status: "published", date: "42m ago", words: 180,  compliance: "passed"   },
    { id: "c_9212", title: "Founder note: why we don't add magnesium stearate",   type: "blog",    status: "published", date: "2h ago",  words: 860,  compliance: "passed"   },
    { id: "c_9211", title: "3 ways pine bark supports skin elasticity",            type: "social",  status: "escalated", date: "3h ago",  words: 90,   compliance: "escalated" },
    { id: "c_9210", title: "Plasmaide Daily — new subscription pricing",           type: "product", status: "pending",   date: "5h ago",  words: 240,  compliance: "warnings" },
    { id: "c_9209", title: "A cardiologist's take on endothelial health",          type: "blog",    status: "published", date: "8h ago",  words: 1340, compliance: "passed"   },
    { id: "c_9208", title: "May promo — member early access email",               type: "email",    status: "published", date: "11h ago", words: 165,  compliance: "passed"   },
    { id: "c_9207", title: "Weekly wellbeing digest #18",                          type: "email",    status: "pending",   date: "14h ago", words: 420,  compliance: "passed"   },
  ];

  const alerts = [
    { id: "a_118", sev: "esc",  title: "Compliance escalation — blog #9211",     detail: "Claim \"reduces inflammation\" requires TGA-registered source", age: "12m", source: "compliance" },
    { id: "a_117", sev: "warn", title: "DotDigital sync lag — 4h behind",        detail: "Segments \"vip-au\", \"lapsed-30d\" delayed",                     age: "34m", source: "integration" },
    { id: "a_116", sev: "bad",  title: "Meta Ads budget overrun — AU campaign",  detail: "Spent A$612 / A$500 daily cap · auto-paused",                    age: "1h",  source: "finance" },
    { id: "a_115", sev: "warn", title: "Gorgias ticket surge — +38% last hour",   detail: "Possible carrier delay · 22 unresolved",                         age: "1h",  source: "support" },
    { id: "a_114", sev: "esc",  title: "Product claim review — capsule page",    detail: "\"Doctor recommended\" flagged without attribution",             age: "3h",  source: "compliance" },
    { id: "a_113", sev: "ok",   title: "Xero reconciliation completed",           detail: "April 14–20 · 284 orders matched",                               age: "4h",  source: "finance" },
  ];

  const approvals = [
    {
      id: "ap_501",
      kind: "content",
      title: "Pine Bark's Role in Circulatory Health — Autumn Edition",
      type: "blog",
      created: "Today, 08:14",
      author: "agent-writer-03",
      status: "pending",
      flags: [
        { sev: "esc", rule: "TGA-001",  name: "Therapeutic claim without registered source", snippet: "...may help reduce chronic inflammation in adults over 40 by up to 32%...", suggestion: "Soften to \"supports healthy inflammatory response\" and cite internal study PLM-2024-07." },
        { sev: "warn", rule: "COPY-044", name: "Absolute health claim",                       snippet: "...guaranteed to improve your circulation within two weeks...",        suggestion: "Replace \"guaranteed\" with \"may support\"." },
      ],
      body: `Pine bark extract — specifically from the French maritime pine (Pinus pinaster) — has been studied for its effects on the circulatory system since the late 1980s.

In Plasmaide's sourcing audit this autumn, we selected four harvest batches from the Les Landes forest in southwest France. Each batch was tested for procyanidin content, with an acceptance threshold of 70%.

The resulting extract is standardised and used in our Daily capsule, which contains 150mg per serve.`,
    },
    {
      id: "ap_502",
      kind: "content",
      title: "3 ways pine bark supports skin elasticity",
      type: "social",
      created: "Today, 05:32",
      author: "agent-writer-01",
      status: "pending",
      flags: [
        { sev: "bad", rule: "COSM-012", name: "Cosmetic claim on supplement product", snippet: "...erases fine lines in as little as 21 days.", suggestion: "Remove claim. Cosmetic claims require separate TGA cosmetic registration." },
      ],
      body: "Post copy: Three things most people don't know about pine bark... 1) It's a powerful antioxidant source. 2) It supports collagen. 3) It erases fine lines in as little as 21 days.",
    },
    {
      id: "ap_503",
      kind: "content",
      title: "Your April restock is here — free shipping over $80",
      type: "email",
      created: "Yesterday, 18:02",
      author: "agent-writer-02",
      status: "pending",
      flags: [],
      body: "Subject: Your April restock is here\n\nHi {{first_name}} — we've restocked Plasmaide Daily. Free shipping on orders over A$80 until Sunday.",
    },
    {
      id: "ap_504",
      kind: "finance",
      title: "Increase Meta Ads daily cap — AU · +A$200",
      type: "budget",
      created: "Today, 10:04",
      author: "agent-growth",
      status: "pending",
      flags: [
        { sev: "warn", rule: "FIN-008", name: "Budget increase > 25% threshold", snippet: "Proposed daily cap A$700 is +40% vs trailing 14d average (A$500).", suggestion: "Approver must confirm; suggest staged increase to A$600 first." },
      ],
      body: "Campaign: PLM-AU-Daily-Prospecting\nCurrent: A$500/day · ROAS 3.1\nProposed: A$700/day\nRationale: Creative set 14 is scaling efficiently, frequency low at 1.6.",
    },
    {
      id: "ap_505",
      kind: "finance",
      title: "Refund override — order #A71429 (A$184.80)",
      type: "refund",
      created: "Today, 11:48",
      author: "agent-support",
      status: "pending",
      flags: [],
      body: "Customer: J. Alvarado · Order #A71429 · Shipped 10d ago, carrier lost.\nRequesting full refund per lost-parcel policy §4.2.",
    },
  ];

  const integrations = [
    { name: "Shopify",      abbr: "Sh",  status: "ok",   sub: "Connected · last sync 4m ago · 1,284 orders mirrored" },
    { name: "DotDigital",   abbr: "Dd",  status: "warn", sub: "Sync lag 4h · segments delayed · retry 02:18" },
    { name: "Triple Whale", abbr: "Tw",  status: "ok",   sub: "Connected · attribution window 28d · blended ROAS 3.42" },
    { name: "Xero",         abbr: "Xe",  status: "ok",   sub: "Connected · last reconciliation 4h ago" },
    { name: "Gorgias",      abbr: "Gg",  status: "esc",  sub: "Ticket surge · 22 unresolved · SLA breach risk" },
    { name: "Meta Ads",     abbr: "Ma",  status: "bad",  sub: "Budget cap hit on PLM-AU-Daily-Prospecting · auto-paused" },
    { name: "Klaviyo",      abbr: "Kv",  status: "off",  sub: "Not connected" },
  ];

  const rulePacks = [
    {
      name: "Health supplements — AU",
      key: "health_supplements_au",
      on: true,
      desc: "Installed pack · TGA-aligned supplement claims for the Australian market",
      tags: ["installed", "au-region"],
    },
    {
      name: "General marketing",
      key: "general_marketing",
      on: true,
      desc: "Installed pack · baseline marketing claim checks, absolutes and superlatives",
      tags: ["installed"],
    },
    {
      name: "Brand voice",
      key: "brand_voice",
      on: true,
      desc: "Installed pack · Plasmaide tone — avoid \"cure\", \"guarantee\", \"best\", superlatives",
      tags: ["installed", "brand"],
    },
  ];

  const team = [
    { name: "Carl Hartmann", role: "Admin",    email: "carl@plasmaide.com",  initials: "CH", tag: "technical · product" },
    { name: "Steve Whitby",  role: "Approver", email: "steve@plasmaide.com", initials: "SW", tag: "business · approvals" },
    { name: "Agent · Writer",  role: "System", email: "agent-writer-01",     initials: "AW", tag: "automated" },
    { name: "Agent · Growth",  role: "System", email: "agent-growth",        initials: "AG", tag: "automated" },
  ];

  return {
    currencies, windows, kpisBase, deltas, sparks,
    contentStats, contentItems,
    alerts, approvals,
    integrations, rulePacks, team,
  };
})();
