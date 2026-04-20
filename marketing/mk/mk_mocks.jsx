// Inline product-screenshot-style mocks

function MockDashboard() {
  return (
    <div className="mock">
      <div className="mock-body" style={{padding:12}}>
        {/* KPI row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",border:"1px solid var(--line)",borderRadius:6,overflow:"hidden",background:"#fff"}}>
          {[
            {l:"REVENUE",v:"A$32.1k",d:"+2.8%",up:true,sp:"M0,18 L10,15 L20,16 L30,12 L40,14 L50,9 L60,11 L70,6"},
            {l:"ORDERS",v:"284",d:"-1.2%",up:false,sp:"M0,14 L10,16 L20,13 L30,15 L40,12 L50,14 L60,10 L70,12"},
            {l:"AOV",v:"A$113",d:"+4.1%",up:true,sp:"M0,16 L10,14 L20,15 L30,12 L40,13 L50,10 L60,11 L70,8"},
            {l:"NEW CUST",v:"142",d:"+8.9%",up:true,sp:"M0,18 L10,16 L20,14 L30,15 L40,12 L50,10 L60,8 L70,6"},
          ].map((k,i)=>(
            <div key={i} style={{padding:"8px 10px",borderRight:i<3?"1px solid var(--line)":"0"}}>
              <div style={{fontSize:8,letterSpacing:".14em",color:"var(--ink-4)",fontWeight:500}}>{k.l}</div>
              <div style={{fontSize:16,fontWeight:500,letterSpacing:"-0.02em",marginTop:2,fontVariantNumeric:"tabular-nums"}}>{k.v}</div>
              <div style={{fontFamily:"'Geist Mono',monospace",fontSize:9,color:k.up?"var(--ok)":"var(--bad)",background:k.up?"var(--ok-bg)":"var(--bad-bg)",display:"inline-block",padding:"1px 4px",borderRadius:3,marginTop:2}}>{k.up?"▲":"▼"}{k.d}</div>
              <svg width="100%" height="22" viewBox="0 0 70 22" style={{marginTop:4,display:"block"}}>
                <path d={k.sp} fill="none" stroke="var(--accent)" strokeWidth="1.2"/>
                <path d={k.sp+" L70,22 L0,22 Z"} fill="var(--accent)" opacity=".12"/>
              </svg>
            </div>
          ))}
        </div>

        {/* pipeline + alerts */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 180px",gap:10,marginTop:10}}>
          <div style={{border:"1px solid var(--line)",borderRadius:6,overflow:"hidden",background:"#fff"}}>
            <div style={{padding:"6px 10px",background:"var(--panel-2)",borderBottom:"1px solid var(--line)",fontSize:8,letterSpacing:".12em",color:"var(--ink-4)",fontWeight:600,display:"flex",justifyContent:"space-between"}}>
              <span>CONTENT PIPELINE</span><span className="tnum mono" style={{color:"var(--ink-3)"}}>18 PENDING</span>
            </div>
            {[
              {t:"Pine Bark's Role in Circulatory Health",s:"pending",sc:"var(--warn)",bg:"var(--warn-bg)"},
              {t:"Your April restock is here — free shipping",s:"published",sc:"var(--ok)",bg:"var(--ok-bg)"},
              {t:"3 ways pine bark supports skin elasticity",s:"escalated",sc:"var(--esc)",bg:"var(--esc-bg)"},
              {t:"Founder note: why we don't add stearate",s:"published",sc:"var(--ok)",bg:"var(--ok-bg)"},
            ].map((r,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"14px 1fr 70px",gap:6,alignItems:"center",padding:"5px 10px",borderBottom:i<3?"1px solid var(--line-2)":"0",fontSize:10}}>
                <div style={{width:12,height:12,borderRadius:2,background:"var(--line-2)",color:"var(--ink-3)",display:"grid",placeItems:"center",fontSize:8,fontWeight:600}}>B</div>
                <div style={{fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.t}</div>
                <div style={{fontSize:8,padding:"1px 5px",color:r.sc,background:r.bg,borderRadius:8,fontFamily:"'Geist Mono',monospace",textAlign:"center",letterSpacing:".04em"}}>{r.s.toUpperCase()}</div>
              </div>
            ))}
          </div>
          <div style={{border:"1px solid var(--line)",borderRadius:6,overflow:"hidden",background:"#fff"}}>
            <div style={{padding:"6px 10px",background:"var(--panel-2)",borderBottom:"1px solid var(--line)",fontSize:8,letterSpacing:".12em",color:"var(--ink-4)",fontWeight:600}}>ALERTS · 4</div>
            {[
              {t:"TGA claim · blog #9211",sc:"var(--esc)"},
              {t:"DotDigital sync lag 4h",sc:"var(--warn)"},
              {t:"Meta AU budget overrun",sc:"var(--bad)"},
              {t:"Gorgias surge +38%",sc:"var(--warn)"},
            ].map((a,i)=>(
              <div key={i} style={{display:"flex",gap:6,padding:"5px 10px",borderBottom:i<3?"1px solid var(--line-2)":"0",fontSize:10,alignItems:"center"}}>
                <div style={{width:3,alignSelf:"stretch",background:a.sc,borderRadius:2}}/>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MockApprovals() {
  return (
    <div className="mock">
      <div className="mock-body" style={{padding:0,background:"#fff"}}>
        <div style={{display:"grid",gridTemplateColumns:"170px 1fr"}}>
          <div style={{borderRight:"1px solid var(--line)"}}>
            <div style={{display:"flex",borderBottom:"1px solid var(--line)",background:"var(--panel-2)"}}>
              <div style={{flex:1,padding:"8px",fontSize:10,fontWeight:500,textAlign:"center",borderBottom:"2px solid var(--accent)",color:"var(--ink)"}}>Content <span className="mono" style={{color:"var(--accent)",background:"var(--accent-bg)",padding:"1px 5px",borderRadius:6,fontSize:8}}>3</span></div>
              <div style={{flex:1,padding:"8px",fontSize:10,fontWeight:500,textAlign:"center",color:"var(--ink-3)"}}>Financial <span className="mono" style={{background:"var(--line-2)",padding:"1px 5px",borderRadius:6,fontSize:8}}>2</span></div>
            </div>
            {[
              {t:"Pine Bark's Role…",sel:true,flags:[["esc","TGA-001"]]},
              {t:"3 ways pine bark supports…",sel:false,flags:[["bad","COSM-012"]]},
              {t:"April restock email",sel:false,flags:[["ok","CLEAN"]]},
            ].map((r,i)=>(
              <div key={i} style={{padding:"8px 10px",borderBottom:i<2?"1px solid var(--line-2)":"0",background:r.sel?"var(--accent-bg)":"transparent",boxShadow:r.sel?"inset 2px 0 0 var(--accent)":"none"}}>
                <div style={{fontSize:10,fontWeight:500,marginBottom:3}}>{r.t}</div>
                <div style={{display:"flex",gap:3}}>
                  {r.flags.map(([s,l],j)=>(
                    <span key={j} style={{fontSize:8,fontFamily:"'Geist Mono',monospace",padding:"1px 4px",borderRadius:6,color:s==="ok"?"var(--ok)":s==="esc"?"var(--esc)":"var(--bad)",background:s==="ok"?"var(--ok-bg)":s==="esc"?"var(--esc-bg)":"var(--bad-bg)"}}>{l}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{padding:10,display:"flex",flexDirection:"column",gap:8}}>
            <div style={{fontSize:10,color:"var(--ink-4)",letterSpacing:".12em",fontFamily:"'Geist Mono',monospace"}}>BLOG · ap_501</div>
            <div style={{fontSize:12,fontWeight:500,letterSpacing:"-0.01em",lineHeight:1.3}}>Pine Bark's Role in Circulatory Health — Autumn</div>
            <div style={{padding:"6px 8px",border:"1px solid var(--line)",borderRadius:4,background:"var(--panel-2)",fontSize:10,lineHeight:1.5,color:"var(--ink-2)"}}>
              …<mark style={{background:"var(--warn-bg)",color:"var(--warn)",borderBottom:"1px dashed var(--warn)",padding:"0 1px"}}>may help reduce chronic inflammation by up to 32%</mark>…
            </div>
            <div style={{fontSize:9,color:"var(--ok)",background:"var(--ok-bg)",border:"1px dashed color-mix(in srgb,var(--ok) 30%,transparent)",padding:"4px 6px",borderRadius:4,fontFamily:"'Geist Mono',monospace"}}>FIX · cite study PLM-2024-07</div>
            <div style={{display:"flex",gap:5,marginTop:"auto"}}>
              <button style={{padding:"4px 8px",fontSize:9,background:"var(--accent)",color:"#fff",border:0,borderRadius:4,fontWeight:500,flex:1}}>✓ Approve</button>
              <button style={{padding:"4px 8px",fontSize:9,background:"#fff",color:"var(--ink-2)",border:"1px solid var(--line-3)",borderRadius:4,fontWeight:500}}>Changes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockSettings() {
  return (
    <div className="mock">
      <div className="mock-body">
        {[
          {n:"Health supplements — AU",d:"TGA-aligned claims for Australian market",t:["installed","au-region"],on:true},
          {n:"General marketing",d:"Baseline absolutes + superlatives checks",t:["installed"],on:true},
          {n:"Brand voice",d:"Plasmaide tone · avoid \"cure\", \"guarantee\"",t:["installed","brand"],on:true},
        ].map((r,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,padding:"8px 4px",borderBottom:i<2?"1px solid var(--line-2)":"0",alignItems:"center"}}>
            <div>
              <div style={{fontSize:11,fontWeight:500}}>{r.n}</div>
              <div style={{fontSize:9,color:"var(--ink-4)",marginTop:1}}>{r.d}</div>
              <div style={{display:"flex",gap:3,marginTop:4}}>
                {r.t.map(tg=>(<span key={tg} style={{fontSize:8,padding:"1px 5px",border:"1px solid var(--line-3)",borderRadius:8,color:"var(--ink-3)",fontFamily:"'Geist Mono',monospace"}}>{tg}</span>))}
              </div>
            </div>
            <div style={{width:26,height:15,background:r.on?"var(--accent)":"var(--line-3)",borderRadius:8,position:"relative"}}>
              <div style={{width:11,height:11,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:r.on?13:2,transition:"left 120ms",boxShadow:"0 1px 2px rgba(0,0,0,.2)"}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockStudio() {
  return (
    <div className="mock">
      <div className="mock-head">CONTENT STUDIO · BLOG · COMPLIANCE INLINE</div>
      <div className="mock-body">
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
          {[["B","Blog",true],["E","Email",false],["S","Social",false],["P","Product",false]].map(([k,n,on],i)=>(
            <div key={i} style={{padding:"8px 6px",border:`1px solid ${on?"var(--accent)":"var(--line)"}`,borderRadius:4,background:on?"var(--accent-bg)":"#fff",textAlign:"center"}}>
              <div style={{width:16,height:16,borderRadius:3,background:on?"var(--accent)":"var(--line-2)",color:on?"#fff":"var(--ink-3)",display:"grid",placeItems:"center",fontSize:9,margin:"0 auto 4px",fontWeight:600}}>{k}</div>
              <div style={{fontSize:9,fontWeight:500}}>{n}</div>
            </div>
          ))}
        </div>
        <div style={{padding:"6px 8px",border:"1px solid var(--line)",background:"var(--panel-2)",borderRadius:4,fontSize:10,display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
          <span style={{fontSize:8,padding:"1px 4px",background:"var(--warn-bg)",color:"var(--warn)",borderRadius:6,fontFamily:"'Geist Mono',monospace"}}>2 WARNINGS</span>
          <span style={{color:"var(--ink-3)",fontSize:9,fontFamily:"'Geist Mono',monospace"}}>TGA-001 · COPY-044</span>
          <span style={{marginLeft:"auto",fontSize:8,color:"var(--ink-4)",fontFamily:"'Geist Mono',monospace"}}>342ms</span>
        </div>
        <div style={{border:"1px solid var(--line)",borderRadius:4,background:"#fff",padding:10,fontSize:10,lineHeight:1.5}}>
          <div style={{fontWeight:500,fontSize:12,letterSpacing:"-0.01em",marginBottom:4}}>Pine Bark's Role in Circulatory Health</div>
          <div style={{color:"var(--ink-4)",fontSize:9,fontFamily:"'Geist Mono',monospace",marginBottom:6}}>Apr 20 · 8 min read</div>
          <p style={{margin:"0 0 6px",color:"var(--ink-2)"}}>Pine bark extract — from <i>Pinus pinaster</i> — has been studied since the late 1980s…</p>
          <div style={{padding:"3px 5px",background:"var(--warn-bg)",borderLeft:"2px solid var(--warn)",borderRadius:2,fontSize:9,color:"var(--warn)"}}>…may reduce chronic inflammation by up to 32%… <span style={{fontFamily:"'Geist Mono',monospace",fontSize:8}}>[ TGA-001 ]</span></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MockDashboard, MockApprovals, MockSettings, MockStudio });
