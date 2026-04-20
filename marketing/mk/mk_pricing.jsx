function Pricing({ go }) {
  const tiers = [
    {n:"Starter",p:"$79",desc:"Founders running a single brand who need the core content + compliance loop.",feat:["1 brand workspace","1 user seat","50 AI generations / mo","Content Strategy + Execution","Base compliance rules","Email support"],cta:"Start free trial"},
    {n:"Growth",p:"$199",desc:"Small teams shipping regularly across email, blog, and social.",feat:["1 brand workspace","3 user seats","200 AI generations / mo","Full compliance rule packs","Approvals workflow + rotations","Performance Analytics","Priority support"],cta:"Start free trial",feat_flag:true},
    {n:"Scale",p:"$499",desc:"Multi-brand portfolios and teams with revenue depending on the pipeline.",feat:["3 brand workspaces","10 user seats","Unlimited generations","All 12 agents enabled","Custom rule packs","Shopify + Klaviyo + Meta integrations"],cta:"Start free trial"},
    {n:"Enterprise",p:"$999+",desc:"Portfolios, agencies, and regulated industries with SLA and audit needs.",feat:["Unlimited brands + seats","White-label option","Custom agent fine-tuning","SSO + SCIM + audit logs","99.9% SLA + 24/7 support","Dedicated CSM","Security review + DPIA","Onboarding team"],cta:"Talk to sales"},
  ];
  return (
    <div>
      <section className="dark" style={{paddingTop:96,paddingBottom:60}}>
        <div className="wrap">
          <h2 style={{color:"#fff",fontSize:"clamp(36px,5vw,60px)",letterSpacing:"-0.03em",lineHeight:1.05,fontWeight:500,margin:"14px 0 14px",maxWidth:780,textWrap:"balance"}}>One bill. One system. One-tenth the cost.</h2>
          <p style={{fontSize:18,color:"var(--nav-ink)",maxWidth:620,margin:0,lineHeight:1.55}}>All plans include human-in-the-loop approvals, compliance rule packs, and the same 12-agent architecture. Scale what you use.</p>
        </div>
      </section>

      <section style={{paddingTop:56}}>
        <div className="wrap">
          <div className="pricing-grid">
            {tiers.map((t,i)=>(
              <div key={i} className={`price-card ${t.feat_flag?"feat":""}`}>
                <h3>{t.n}</h3>
                <div className="price tnum">{t.p}<small>/ mo</small></div>
                <p className="desc">{t.desc}</p>
                <ul className="feats">
                  {t.feat.map((f,j)=>(<li key={j}><span className="c"><Icon name="check"/></span>{f}</li>))}
                </ul>
                <a href="#" className={`btn ${t.feat_flag?"primary":"ghost-dark"} lg`} style={{marginTop:"auto",justifyContent:"center"}}>{t.cta}</a>
              </div>
            ))}
          </div>

          {/* vs stack callout */}
          <div style={{marginTop:32,border:"1px solid var(--accent-line)",borderRadius:12,padding:"28px 32px",background:"linear-gradient(180deg,#fff 0%,#f4f8ff 100%)",display:"grid",gridTemplateColumns:"1fr auto 1fr auto",gap:32,alignItems:"center"}}>
            <div>
              <div className="mono" style={{fontSize:11,letterSpacing:".14em",color:"var(--ink-4)",textTransform:"uppercase",marginBottom:4}}>What most DTC brands pay today</div>
              <div style={{fontSize:32,letterSpacing:"-0.02em",fontWeight:500,fontVariantNumeric:"tabular-nums"}}>$8,000 – $20,000<span style={{fontSize:15,color:"var(--ink-4)",fontWeight:400,marginLeft:6}}>/ mo</span></div>
              <div style={{fontSize:12,color:"var(--ink-3)",marginTop:4}}>6–14 SaaS tools + freelancers + fractional marketing manager</div>
            </div>
            <div style={{fontSize:24,color:"var(--accent)"}}><Icon name="arrow" size={28}/></div>
            <div>
              <div className="mono" style={{fontSize:11,letterSpacing:".14em",color:"var(--accent)",textTransform:"uppercase",marginBottom:4}}>With AGOS</div>
              <div style={{fontSize:32,letterSpacing:"-0.02em",fontWeight:500,fontVariantNumeric:"tabular-nums"}}>$199 – $499<span style={{fontSize:15,color:"var(--ink-4)",fontWeight:400,marginLeft:6}}>/ mo</span></div>
              <div style={{fontSize:12,color:"var(--ink-3)",marginTop:4}}>One login · one invoice · one source of truth</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div className="mono" style={{fontSize:11,letterSpacing:".14em",color:"var(--ok)",padding:"4px 10px",background:"var(--ok-bg)",borderRadius:20,display:"inline-block"}}>▼ 94–97% COST</div>
            </div>
          </div>

          {/* FAQ */}
          <div style={{marginTop:72}}>
            <div className="section-head" style={{marginBottom:24}}>
          <h2 style={{fontSize:"clamp(28px,3.5vw,40px)"}}>Questions we hear on every demo call.</h2>
            </div>
            <div className="faq">
              {[
                {q:"Is AGOS actually autonomous, or is this AI-assisted?",a:"Both — by design. Agents draft, plan, analyze, and execute autonomously. But nothing that touches your customers (published content, sent emails, PDP changes) ships without a human approval. You're in the loop at the decision point, not the typing point."},
                {q:"Will AGOS train on my data?",a:"No. Your content, customer data, and compliance decisions never enter any model training pipeline. We use Claude by Anthropic under a zero-retention agreement. Your workspace is yours."},
                {q:"How is compliance actually enforced?",a:"Rule packs are versioned, installed, and run inline during generation. We ship packs for TGA (AU health), ACCC (AU general), FDA (US cosmetics + supplements), and custom brand-voice packs. Every flag carries a rule ID you can audit."},
                {q:"What if an agent makes a mistake?",a:"Three layers: (1) the compliance agent catches claims and regulated language, (2) the approvals queue catches everything else, (3) every published artifact carries a revision log — one click to revert or rollback."},
                {q:"Can I bring my own integrations?",a:"Scale and Enterprise include Shopify, Klaviyo, Meta, Google Ads, Gorgias, and Okendo out of the box. Custom webhooks and our public API on Enterprise."},
                {q:"What's the onboarding like?",a:"Starter and Growth: self-serve, ~30 min to first generation. Scale: white-glove onboarding with a CSM over 2 weeks. Enterprise: full integration and fine-tuning, 4–6 weeks."},
                {q:"Do you offer a free trial?",a:"14 days on any plan. Full feature access. No credit card required. Bring your brand guidelines and a real campaign — don't waste it on sandbox data."},
              ].map((f,i)=>(
                <details key={i} className="faq-row" open={i===0}>
                  <summary>{f.q}<span className="plus mono">+</span></summary>
                  <div className="ans">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <BigCTA/>
    </div>
  );
}
Object.assign(window, { Pricing });
