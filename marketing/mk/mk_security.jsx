function Security({ go }) {
  return (
    <div>
      {/* HERO */}
      <section className="dark" style={{paddingTop:88, paddingBottom:56}}>
        <div className="wrap">
          <h1 style={{color:"#fff",fontSize:"clamp(36px,5vw,62px)",letterSpacing:"-0.03em",lineHeight:1.05,fontWeight:500,margin:"8px 0 18px",maxWidth:960,textWrap:"balance"}}>Your data never trains an AI model. Not ours. Not anyone's.</h1>
          <p style={{fontSize:18,color:"var(--nav-ink)",maxWidth:680,margin:0,lineHeight:1.55}}>AGOS runs on zero-retention inference, a tightly-scoped cloud stack, and compliance-as-code. Here's exactly what happens to every byte your brand sends us — and what doesn't.</p>
        </div>
      </section>

      {/* 4 TRUST PILLARS */}
      <section style={{paddingTop:64}}>
        <div className="wrap">
          <div className="sec-pillars">
            {[
              {
                ic:"brain",
                t:"Zero model training",
                d:"Anthropic zero-retention is enabled on every workspace. Your drafts, briefs, product data, and customer records pass through inference and are discarded — never logged, never used to train foundation models.",
              },
              {
                ic:"lock",
                t:"Encrypted in transit & at rest",
                d:"TLS 1.3 on every hop. AES-256 on the database. Column-level encryption on customer PII. Keys rotated quarterly via Supabase Vault.",
              },
              {
                ic:"shield",
                t:"Compliance as code",
                d:"TGA, ACCC, FDA, and cosmetic-claim rule packs are versioned, tested, and deployed like software. Every flag carries a rule ID, jurisdiction, and citation you can audit.",
              },
              {
                ic:"globe",
                t:"Data residency",
                d:"Today: AWS Sydney (ap-southeast-2) for Australian workspaces, US-East for US. EU residency shipping alongside GDPR certification in Q4 2026.",
              },
            ].map((p,i)=>(
              <Reveal key={i} delay={i*60}>
                <div className="sec-pillar">
                  <div className="sp-ico"><Icon name={p.ic} size={18}/></div>
                  <h3>{p.t}</h3>
                  <p>{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* DATA FLOW DIAGRAM */}
      <section className="dark">
        <div className="wrap">
          <div className="section-head">
            <h2 style={{color:"#fff"}}>Here's what happens when you press Generate.</h2>
            <p>Every inference request takes this path. Every step is auditable. Nothing persists where it shouldn't.</p>
          </div>
          <div className="data-flow">
            {[
              {n:"01",t:"Your browser",d:"Draft + brief leave your session over TLS 1.3",sub:"CLIENT · BROWSER",c:"var(--accent)"},
              {n:"02",t:"AGOS edge",d:"Vercel edge function in Sydney · auth + rate limit",sub:"VERCEL · SYD-1",c:"var(--accent)"},
              {n:"03",t:"Compliance pre-scan",d:"Rule packs run on the brief before it touches an LLM",sub:"WORKER · ISOLATED",c:"var(--ok)"},
              {n:"04",t:"Inference",d:"Anthropic API · zero-retention · PII redacted",sub:"ANTHROPIC · ZR",c:"var(--warn)"},
              {n:"05",t:"Compliance post-scan",d:"Rule packs run on the draft · flags attached",sub:"WORKER · ISOLATED",c:"var(--ok)"},
              {n:"06",t:"Supabase",d:"Draft persisted · AES-256 · RLS · project-scoped",sub:"SUPABASE · SYD",c:"var(--accent)"},
            ].map((s,i,arr)=>(
              <div key={i} className="df-step">
                <div className="df-node" style={{borderColor:s.c}}>
                  <div className="df-n mono" style={{color:s.c}}>{s.n}</div>
                  <div className="df-t">{s.t}</div>
                  <div className="df-d">{s.d}</div>
                  <div className="df-sub mono">{s.sub}</div>
                </div>
                {i<arr.length-1 && <div className="df-arrow"><Icon name="arrow" size={14}/></div>}
              </div>
            ))}
          </div>
          <div className="data-flow-note mono">
            <span>NOTHING WRITTEN TO DISK AT STEP 04</span>
            <span>·</span>
            <span>FULL REQUEST HASH AUDITED · 7-YEAR LOG</span>
          </div>
        </div>
      </section>

      {/* STACK */}
      <section>
        <div className="wrap">
          <div className="section-head">
            <h2>The stack, named.</h2>
            <p>We don't hide our vendors — you should know who you're trusting by transitive property. Every provider here is SOC 2 Type II and GDPR-compliant today.</p>
          </div>
          <div className="sec-stack">
            {[
              {n:"Anthropic",role:"LLM inference",cert:"SOC 2 · HIPAA · ZR",k:"All generative work. Zero-retention contract. No training on customer prompts."},
              {n:"Vercel",role:"Edge + app hosting",cert:"SOC 2 Type II · ISO 27001",k:"Sydney + Virginia regions. Network isolation per workspace."},
              {n:"Supabase",role:"Postgres + auth + storage",cert:"SOC 2 Type II · HIPAA BAA",k:"Row-level security on every table. Column-level encryption on PII."},
              {n:"Cloudflare",role:"WAF + DDoS + DNS",cert:"SOC 2 Type II · ISO 27001",k:"Rate limiting, bot detection, and TLS termination."},
              {n:"Shopify",role:"Commerce data source",cert:"PCI DSS Level 1",k:"OAuth-scoped. Read by default. Write scopes are per-workspace opt-in."},
              {n:"Sentry",role:"Error tracking",cert:"SOC 2 Type II",k:"PII scrubbing on. No request bodies captured. 90-day retention."},
            ].map((v,i)=>(
              <div key={i} className="sec-stack-row">
                <div className="ssr-logo mono">{v.n[0]}</div>
                <div className="ssr-body">
                  <div className="ssr-top">
                    <span className="ssr-name">{v.n}</span>
                    <span className="ssr-role mono">· {v.role}</span>
                    <span className="ssr-cert mono">{v.cert}</span>
                  </div>
                  <p className="ssr-d">{v.k}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CERTS */}
      <section style={{background:"var(--panel-2)"}}>
        <div className="wrap">
          <div className="section-head">
            <h2>Certifications — what's live, what's planned.</h2>
            <p>We're pre-enterprise. Here's the honest roadmap — not vague asterisks, not "coming soon" without dates.</p>
          </div>
          <div className="sec-certs">
            {[
              {n:"Zero-retention inference",s:"Live",date:"Since Apr 2026",k:"live"},
              {n:"TLS 1.3 · AES-256",s:"Live",date:"Since launch",k:"live"},
              {n:"APAC data residency",s:"Live",date:"AWS Sydney",k:"live"},
              {n:"US data residency",s:"Live",date:"AWS Virginia",k:"live"},
              {n:"SOC 2 Type I",s:"In audit",date:"Report Q2 2026",k:"progress"},
              {n:"SOC 2 Type II",s:"Planned",date:"Q3 2026",k:"planned"},
              {n:"GDPR certification",s:"Planned",date:"Q4 2026 + EU residency",k:"planned"},
              {n:"ISO 27001",s:"Planned",date:"2027",k:"planned"},
              {n:"HIPAA BAA",s:"On request",date:"Enterprise tier",k:"planned"},
            ].map((c,i)=>(
              <div key={i} className={`sec-cert kind-${c.k}`}>
                <div className="scert-top">
                  <span className={`scert-status mono kind-${c.k}`}>{c.k==="live"?"● LIVE":c.k==="progress"?"◐ IN AUDIT":"○ PLANNED"}</span>
                  <span className="scert-date mono">{c.date}</span>
                </div>
                <div className="scert-name">{c.n}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DATA RIGHTS */}
      <section>
        <div className="wrap">
          <div className="section-head">
            <h2>Your data, your rules.</h2>
            <p>You own every byte. We're custodians, not owners. Here's what that means in practice.</p>
          </div>
          <div className="sec-rights">
            {[
              {t:"Export anytime",d:"One click in Settings → Data. Full JSON + Markdown export of every draft, approval, and audit entry. Delivered within 24 hours, usually minutes."},
              {t:"Delete anytime",d:"Workspace deletion triggers 30-day soft delete, then cryptographic shredding of all tenant data, including derived vector embeddings and brand-voice profiles."},
              {t:"No secondary use",d:"We don't sell, share, or benchmark against your data. Aggregate product analytics use workspace-level counts only, never content."},
              {t:"Sub-processor list",d:"Published and versioned. Customers with data-processing agreements are notified 30 days before any new sub-processor is added."},
            ].map((r,i)=>(
              <div key={i} className="sec-right">
                <span className="sr-ico"><Icon name="check" size={14}/></span>
                <div>
                  <div className="sr-t">{r.t}</div>
                  <p className="sr-d">{r.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section style={{background:"var(--panel-2)",paddingTop:64,paddingBottom:64}}>
        <div className="wrap">
          <div className="sec-contact">
            <div>
              <h3>Questions? Security reviews? Report a vuln?</h3>
              <p>We run a private bug-bounty program and respond to responsible disclosures within one business day.</p>
            </div>
            <div className="sec-contact-links">
              <a href="mailto:security@agos.app" className="btn ghost-dark lg"><Icon name="mail"/> security@agos.app</a>
              <a href="#" className="btn ghost-dark lg"><Icon name="lock"/> PGP key</a>
              <a href="#" className="btn ghost-dark lg"><Icon name="doc"/> Sub-processor list</a>
            </div>
          </div>
        </div>
      </section>

      <BigCTA/>
    </div>
  );
}
Object.assign(window, { Security });
