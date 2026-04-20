const { useState, useEffect, useRef } = React;

// AGOS Orbit logomark — a bright core (digital COO) surrounded by six nodes
// on a dashed orbit (the agents). Reads at 16px+.
function AgosGlyph({ size = 26, style = {} }) {
  const radius = Math.max(3, size * 0.22);
  const sats = [0, 60, 120, 180, 240, 300].map((deg, i) => {
    const r = (deg - 90) * Math.PI / 180;
    return <circle key={i} cx={12 + 7.5 * Math.cos(r)} cy={12 + 7.5 * Math.sin(r)} r="1.05" fill="#b7ccff"/>;
  });
  return (
    <div style={{
      width:size, height:size, borderRadius:radius,
      background:"linear-gradient(140deg,#2f6feb 0%,#0b1a3a 100%)",
      boxShadow:"inset 0 0 0 1px rgba(255,255,255,.14)",
      display:"grid", placeItems:"center", overflow:"hidden", flex:`0 0 ${size}px`,
      ...style,
    }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" style={{display:"block"}}>
        <circle cx="12" cy="12" r="7.5" stroke="rgba(255,255,255,.28)" strokeWidth="0.7" strokeDasharray="1.2 1.6"/>
        {sats}
        <circle cx="12" cy="12" r="3.2" fill="#fff"/>
        <circle cx="12" cy="12" r="1.3" fill="#2f6feb"/>
      </svg>
    </div>
  );
}

function Icon({ name, size=16 }) {
  const p = { width:size, height:size, viewBox:"0 0 16 16", fill:"none", stroke:"currentColor", strokeWidth:1.4, strokeLinecap:"round", strokeLinejoin:"round" };
  switch (name) {
    case "check": return <svg {...p}><path d="M3 8l3 3 7-7"/></svg>;
    case "x":     return <svg {...p}><path d="M4 4l8 8M12 4l-8 8"/></svg>;
    case "arrow": return <svg {...p}><path d="M3 8h10M9 4l4 4-4 4"/></svg>;
    case "chev":  return <svg {...p}><path d="M6 4l4 4-4 4"/></svg>;
    case "dash":  return <svg {...p}><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>;
    case "studio":return <svg {...p}><path d="M3 3h10v8H3z"/><path d="M3 7l3-2 3 3 4-4"/></svg>;
    case "approve":return <svg {...p}><path d="M3 8l3 3 7-7"/><path d="M3 13h10"/></svg>;
    case "zap":   return <svg {...p}><path d="M9 1L3 9h4l-1 6 6-8H8z"/></svg>;
    case "shield":return <svg {...p}><path d="M8 1L2 3v5c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V3z"/></svg>;
    case "spark": return <svg {...p}><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M4 12l2-2M10 6l2-2"/></svg>;
    case "cart":  return <svg {...p}><path d="M2 3h2l2 8h7l2-6H5"/><circle cx="6" cy="14" r="1"/><circle cx="12" cy="14" r="1"/></svg>;
    case "chat":  return <svg {...p}><path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7l-3 3v-3H4a2 2 0 0 1-2-2z"/></svg>;
    case "chart": return <svg {...p}><path d="M2 14h12M4 12V8M7 12V4M10 12V9M13 12V6"/></svg>;
    case "coin":  return <svg {...p}><circle cx="8" cy="8" r="6"/><path d="M8 5v6M6 7h3a1.5 1.5 0 0 1 0 3H6"/></svg>;
    case "mail":  return <svg {...p}><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 4l6 5 6-5"/></svg>;
    case "brush": return <svg {...p}><path d="M11 2l3 3-7 7-3-3z"/><path d="M4 13l-2 1 1-2"/></svg>;
    case "tag":   return <svg {...p}><path d="M2 8V2h6l6 6-6 6z"/><circle cx="5" cy="5" r="0.8" fill="currentColor"/></svg>;
    case "star":  return <svg {...p}><path d="M8 2l2 4 4 .6-3 3 .8 4L8 11.8 4.2 13.6 5 9.6 2 6.6 6 6z"/></svg>;
    case "brain": return <svg {...p}><path d="M6 3a2 2 0 0 0-2 2 2 2 0 0 0-1 3 2 2 0 0 0 1 3 2 2 0 0 0 2 2h1V3zM10 3a2 2 0 0 1 2 2 2 2 0 0 1 1 3 2 2 0 0 1-1 3 2 2 0 0 1-2 2H9V3z"/></svg>;
    case "people":return <svg {...p}><circle cx="5" cy="6" r="2"/><circle cx="11" cy="6" r="2"/><path d="M2 13c0-2 1.5-3 3-3s3 1 3 3M8 13c0-2 1.5-3 3-3s3 1 3 3"/></svg>;
    case "globe": return <svg {...p}><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2a9 9 0 0 1 0 12M8 2a9 9 0 0 0 0 12"/></svg>;
    case "lock":  return <svg {...p}><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>;
    case "refresh":return <svg {...p}><path d="M14 8a6 6 0 1 1-2-4.5"/><path d="M14 2v3h-3"/></svg>;
    default: return null;
  }
}

function Nav({ route, go }) {
  const items = [
    { k:"home",    l:"Product" },
    { k:"features",l:"How it works" },
    { k:"integrations",l:"Integrations" },
    { k:"pricing", l:"Pricing" },
    { k:"compare", l:"Compare" },
    { k:"usecases",l:"Use cases" },
    { k:"docs",    l:"Docs" },
    { k:"security",l:"Security" },
  ];
  return (
    <div className="topnav">
      <div className="inner">
        <a className="brand-lockup" href="#home" onClick={e=>{e.preventDefault();go("home");}}>
          <AgosGlyph size={34} />
          <span style={{fontSize:18,letterSpacing:"-0.015em",fontWeight:500}}>AGOS</span>
        </a>
        <nav className="nav-links">
          {items.map(it => (
            <a key={it.k} href={`#${it.k}`} className={route===it.k?"on":""} onClick={e=>{e.preventDefault();go(it.k);}}>{it.l}</a>
          ))}
        </nav>
        <div className="nav-cta">
          <a className="btn ghost" href="#" onClick={e=>e.preventDefault()}>Sign in</a>
          <a className="btn primary" href="#" onClick={e=>e.preventDefault()}>Book a demo <Icon name="arrow"/></a>
        </div>
      </div>
    </div>
  );
}

function Footer({ go }) {
  return (
    <footer>
      <div className="wrap">
        <div className="grid">
          <div>
            <div className="brand-lockup" style={{color:"#fff"}}>
              <AgosGlyph size={26} />
              <span>AGOS</span>
            </div>
            <p className="tag">The operating system for autonomous DTC growth. AI Powered with Human-in-the-loop by design.</p>
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <span className="mono" style={{fontSize:10,padding:"3px 8px",background:"rgba(255,255,255,.05)",border:"1px solid var(--nav-line)",borderRadius:10,color:"var(--nav-ink-2)",letterSpacing:".08em"}}>SOC 2 TYPE II · PLANNED</span>
              <span className="mono" style={{fontSize:10,padding:"3px 8px",background:"rgba(255,255,255,.05)",border:"1px solid var(--nav-line)",borderRadius:10,color:"var(--nav-ink-2)",letterSpacing:".08em"}}>GDPR · PLANNED</span>
            </div>
          </div>
          <div>
            <h5>Product</h5>
            <ul>
              <li><a href="#home" onClick={e=>{e.preventDefault();go("home");}}>Overview</a></li>
              <li><a href="#features" onClick={e=>{e.preventDefault();go("features");}}>How it works</a></li>
              <li><a href="#pricing" onClick={e=>{e.preventDefault();go("pricing");}}>Pricing</a></li>
              <li><a href="#">Changelog</a></li>
              <li><a href="#">Roadmap</a></li>
            </ul>
          </div>
          <div>
            <h5>Solutions</h5>
            <ul>
              <li><a href="#usecases" onClick={e=>{e.preventDefault();go("usecases");}}>Health & wellness</a></li>
              <li><a href="#usecases" onClick={e=>{e.preventDefault();go("usecases");}}>FMCG / CPG</a></li>
              <li><a href="#usecases" onClick={e=>{e.preventDefault();go("usecases");}}>Multi-brand</a></li>
              <li><a href="#usecases" onClick={e=>{e.preventDefault();go("usecases");}}>Regulated</a></li>
            </ul>
          </div>
          <div>
            <h5>Company</h5>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Customers</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#security" onClick={e=>{e.preventDefault();go("security");}}>Security</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
          <div>
            <h5>Resources</h5>
            <ul>
              <li><a href="#docs" onClick={e=>{e.preventDefault();go("docs");}}>Docs</a></li>
              <li><a href="#">Compliance library</a></li>
              <li><a href="#">API reference</a></li>
              <li><a href="#">Community</a></li>
              <li><a href="#">Status</a></li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <div>© 2026 AGOS · Parabolic Growth Pty Ltd</div>
          <div>v1.0</div>
        </div>
      </div>
    </footer>
  );
}

function Reveal({ children, delay=0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { setTimeout(() => el.classList.add("in"), delay); io.unobserve(el); }
      });
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <div className="reveal" ref={ref}>{children}</div>;
}

function BigCTA() {
  return (
    <section style={{padding:"48px 0 96px",borderBottom:0}}>
      <div className="wrap">
        <div className="bigcta">
          <div className="grid-bg"/>
          <h2>Your entire eCommerce team, <em style={{fontStyle:"normal",background:"linear-gradient(180deg,#b7ccff 20%,#7a9dff 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>autonomous</em>.</h2>
          <p>Replace $8–20K / month of fragmented tools, freelancers, and agencies with a single operating system.</p>
          <div className="cta-row">
            <a href="#" className="btn primary lg">Start 14-day free trial <Icon name="arrow"/></a>
            <a href="#" className="btn ghost lg">Book a demo</a>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Icon, Nav, Footer, Reveal, BigCTA, AgosGlyph });
