function Compare({ go }) {
  const cols = ["AGOS","DIY stack","Point solutions","Agency"];
  const rows = [
    {f:"Monthly cost",v:["$199 – $499","$8,000 – $20,000","$3,000 – $8,000","$6,000 – $25,000"],hl:[true,false,false,false]},
    {f:"Setup time",v:["30 min","4 – 8 weeks","1 – 2 weeks / tool","2 – 6 weeks"],hl:[true,false,false,false]},
    {f:"12-agent architecture",v:["yes","no","no","no"]},
    {f:"Compliance rule packs (TGA, ACCC, FDA)",v:["built-in","manual docs","no","consultant-led"]},
    {f:"Human-in-the-loop approvals",v:["native","Slack + Google Docs","no","email threads"]},
    {f:"Multi-brand in one workspace",v:["yes","no","per-seat license","per-contract"]},
    {f:"24 / 7 availability",v:["always","office hours","tool uptime","AU business hrs"]},
    {f:"Response time to your team",v:["seconds","days","hours","24–72h"]},
    {f:"Integrations (Shopify, Klaviyo, Meta)",v:["native","glue code","per-tool","via agency"]},
    {f:"Audit log + versioning",v:["every action","varies","varies","no"]},
    {f:"Data trains AI models",v:["never","tool-by-tool","often","n/a"]},
    {f:"Scales with you",v:["yes","renegotiate each SaaS","yes, linearly","re-scope contract"]},
  ];
  const cell = (v,isAgos,i)=> {
    const yes = ["yes","native","built-in","always","every action","never","seconds"];
    const no = ["no"];
    const cls = yes.includes(v) ? "c-yes" : no.includes(v) ? "c-no" : "c-mid";
    return <div key={i} className={isAgos?"agos-col":""}>
      {yes.includes(v) ? <span className="c-yes"><Icon name="check" size={14}/> {v}</span>
      : no.includes(v) ? <span className="c-no"><Icon name="x" size={14}/> {v}</span>
      : <span className={cls}>{v}</span>}
    </div>;
  };
  return (
    <div>
      <section className="dark" style={{paddingTop:96,paddingBottom:60}}>
        <div className="wrap">
          <h2 style={{color:"#fff",fontSize:"clamp(36px,5vw,60px)",letterSpacing:"-0.03em",lineHeight:1.05,fontWeight:500,margin:"14px 0 14px",maxWidth:820,textWrap:"balance"}}>One login. One bill. One system.</h2>
          <p style={{fontSize:18,color:"var(--nav-ink)",maxWidth:640,margin:0,lineHeight:1.55}}>We built AGOS because we ran Plasmaide's stack for two years and hated it. Here's how it actually stacks up.</p>
        </div>
      </section>

      {/* three cards */}
      <section style={{paddingTop:56,paddingBottom:40,borderBottom:0}}>
        <div className="wrap">
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
            {[
              {t:"vs. DIY stack",d:"You personally wire Jasper + Klaviyo + Triple Whale + Gorgias + three freelancers. The glue is Slack and your calendar.",pro:["You know every tool"],con:["Every handoff loses context","Nothing shares a memory","Weekly ops tax: 6–12h","No unified view"]},
              {t:"vs. point solutions",d:"You buy a best-of-breed tool for each function. Each tool is excellent at its one thing and blind to the others.",pro:["Each tool is polished","Pick whatever's hot"],con:["N vendors, N invoices","N security reviews","Data silos","Compliance lives nowhere"]},
              {t:"vs. agency",d:"You outsource to a retainer. Someone else does the work — usually on their schedule, occasionally on yours.",pro:["Hands off"],con:["$6K–$25K / month","Office hours only","Not your IP","Ramp-up on every brief","You're one of 12 clients"]},
            ].map((c,i)=>(
              <div key={i} style={{border:"1px solid var(--line)",borderRadius:12,padding:26,background:"var(--panel)",display:"flex",flexDirection:"column",gap:14}}>
                <div style={{fontSize:18,fontWeight:500,letterSpacing:"-0.015em"}}>{c.t}</div>
                <p style={{margin:0,color:"var(--ink-3)",fontSize:14,lineHeight:1.55}}>{c.d}</p>
                <div style={{marginTop:4,paddingTop:14,borderTop:"1px dashed var(--line-3)",display:"flex",flexDirection:"column",gap:8}}>
                  {c.pro.map((p,j)=>(<div key={j} style={{fontSize:13,display:"flex",gap:8,color:"var(--ink-2)"}}><span style={{color:"var(--ok)",marginTop:1}}><Icon name="check" size={13}/></span>{p}</div>))}
                  {c.con.map((p,j)=>(<div key={j} style={{fontSize:13,display:"flex",gap:8,color:"var(--ink-3)"}}><span style={{color:"var(--bad)",marginTop:1}}><Icon name="x" size={13}/></span>{p}</div>))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* matrix */}
      <section style={{paddingTop:24}}>
        <div className="wrap">
          <div className="section-head">
          <h2>Twelve dimensions, four contenders.</h2>
            <p>No weasel words. No "partial support" asterisks. Numbers where we have them, behaviors where we don't.</p>
          </div>

          <div className="compare-tbl">
            <div className="row">
              <div className="hd">Capability</div>
              {cols.map((c,i)=>(<div key={c} className={`hd ${i===0?"agos":""}`}>{c}</div>))}
            </div>
            {rows.map((r,i)=>(
              <div className="row" key={i}>
                <div className="cell-feat">{r.f}</div>
                {r.v.map((v,j)=> cell(v, j===0, j))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <BigCTA/>
    </div>
  );
}
Object.assign(window, { Compare });
