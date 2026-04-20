function StudioPage({ tweaks }) {
  const [type, setType] = useState("blog");
  const [tpl, setTpl] = useState("long-form-educational");
  const [title, setTitle] = useState("Pine Bark's Role in Circulatory Health — Autumn Edition");
  const [brief, setBrief] = useState("Educational blog, 800–1200 words. Focus on procyanidins and endothelial function. Reference internal study PLM-2024-07. Avoid therapeutic claims. Target audience: women 35–55, health-curious.");
  const [tone, setTone] = useState("Authoritative");
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState(null);

  const templates = {
    blog:    ["long-form-educational", "founder-note", "ingredient-deep-dive", "customer-story"],
    email:   ["promo-broadcast", "restock-alert", "win-back-30d", "subscription-upsell"],
    social:  ["carousel-3-up", "single-claim", "testimonial-pull", "before-after"],
    product: ["pdp-hero", "pdp-faq-block", "collection-banner", "bundle-offer"],
  };
  const currentTpls = templates[type];

  // Flagged phrases found in the content — keyed by id
  const flags = [
    {
      id: "TGA-001",
      sev: "warn",
      rule: "TGA §42DL — therapeutic claim",
      phrase: "may help reduce chronic inflammation in adults over 40 by up to 32%",
      suggestion: "may support healthy inflammatory response",
      note: "Quantified therapeutic claim without ARTG listing. Soften or remove the percentage.",
    },
    {
      id: "COPY-044",
      sev: "warn",
      rule: "Brand voice — superlative",
      phrase: "strongest peer-reviewed trials",
      suggestion: "peer-reviewed trials at comparable dosages",
      note: "Plasmaide voice avoids superlatives without cited ranking.",
    },
  ];

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 1400);
  };
  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 800);
    setTimeout(() => setSubmitted(false), 2400);
  };

  // Split text and wrap flagged phrases
  const renderWithFlags = (text, ids = []) => {
    let parts = [text];
    ids.forEach(id => {
      const f = flags.find(x => x.id === id);
      if (!f) return;
      const next = [];
      parts.forEach(p => {
        if (typeof p !== "string") { next.push(p); return; }
        const idx = p.indexOf(f.phrase);
        if (idx === -1) { next.push(p); return; }
        if (idx > 0) next.push(p.slice(0, idx));
        next.push(
          <span
            key={f.id}
            className={`flag-mark flag-${f.sev} ${selectedFlag === f.id ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); setSelectedFlag(selectedFlag === f.id ? null : f.id); }}
            title={`${f.id} · ${f.rule}`}
          >
            {f.phrase}
            <span className="flag-tag mono">{f.id}</span>
          </span>
        );
        if (idx + f.phrase.length < p.length) next.push(p.slice(idx + f.phrase.length));
      });
      parts = next;
    });
    return parts;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Content Studio</h1>
          <div className="page-sub">Compose with the writer agents · compliance checked inline before you hand to approvals.</div>
        </div>
        <div className="page-meta">
          <button className="btn ghost"><Icon name="doc"/> Drafts (7)</button>
          <button className="btn"><Icon name="plus"/> Blank draft</button>
          <button
            className={`btn primary ${generating ? "busy" : ""}`}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating
              ? <><span className="spinner"/> Generating…</>
              : <><Icon name="zap"/> Generate</>}
          </button>
        </div>
      </div>

      <div className="studio">
        {/* Composer */}
        <div className="studio-pane">
          <div className="section-head">
            <h2>Content type</h2>
          </div>
          <div className="content-types">
            {[
              { k: "blog",    n: "Blog",         s: "800–1400w · long" },
              { k: "email",   n: "Email",        s: "120–400w · DD" },
              { k: "social",  n: "Social",       s: "30–120w · IG/FB" },
              { k: "product", n: "Product",      s: "PDP · collections" },
            ].map(t => (
              <div key={t.k} className={`type-card ${type === t.k ? "active" : ""}`} onClick={() => { setType(t.k); setTpl(templates[t.k][0]); }}>
                <div className="ico mono">{t.n[0]}</div>
                <div className="name">{t.n}</div>
                <div className="sub">{t.s}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-body">
              <label className="field">
                <span className="lab">Template <span className="hint">· {currentTpls.length} available</span></span>
                <select className="select" value={tpl} onChange={e => setTpl(e.target.value)}>
                  {currentTpls.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label className="field">
                <span className="lab">Working title</span>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)}/>
              </label>

              <label className="field">
                <span className="lab">Brief <span className="hint">· fed to writer agent</span></span>
                <textarea className="textarea" value={brief} onChange={e => setBrief(e.target.value)}/>
              </label>

              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
                <label className="field" style={{margin:0}}>
                  <span className="lab">Tone</span>
                  <select className="select" value={tone} onChange={e => setTone(e.target.value)}>
                    <option>Authoritative</option>
                    <option>Warm &amp; conversational</option>
                    <option>Clinical</option>
                    <option>Founder voice</option>
                  </select>
                </label>
                <label className="field" style={{margin:0}}>
                  <span className="lab">Target length</span>
                  <select className="select">
                    <option>800 words</option>
                    <option>1,200 words</option>
                    <option>1,600 words</option>
                  </select>
                </label>
              </div>

              <label className="field" style={{marginTop:14, marginBottom:0}}>
                <span className="lab">Hero image</span>
                <div className="upload">
                  <Icon name="image" size={18}/>
                  <div style={{marginTop:6}}>Drop image or click to upload</div>
                  <span className="mono">PNG · JPG · WEBP · up to 8 MB</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="studio-pane">
          <div className="section-head">
            <h2>Preview <span className="desc">· {tpl}</span></h2>
            <div className="row">
              <div className="seg">
                <button className="on">Desktop</button>
                <button>Mobile</button>
                <button>Raw</button>
              </div>
            </div>
          </div>

          {/* Live compliance scan bar */}
          <div className={`compliance-bar ${generating ? "scanning" : "done"}`}>
            <div className="cb-left">
              {generating ? (
                <>
                  <span className="cb-pulse"/>
                  <span className="cb-label mono">SCANNING · tga-au v4.2 + pl-voice v1.7</span>
                </>
              ) : (
                <>
                  <SevChip sev="warn">2 WARNINGS</SevChip>
                  <span className="cb-rules mono">
                    {flags.map((f, i) => (
                      <button
                        key={f.id}
                        className={`cb-rule ${selectedFlag === f.id ? "active" : ""}`}
                        onClick={() => setSelectedFlag(selectedFlag === f.id ? null : f.id)}
                      >{f.id}</button>
                    ))}
                  </span>
                </>
              )}
            </div>
            <div className="cb-right">
              <span className="cb-stat mono">
                <span className="cb-stat-k">scan</span>
                <span className="cb-stat-v">{generating ? "…" : "342ms"}</span>
              </span>
              <span className="cb-stat mono">
                <span className="cb-stat-k">packs</span>
                <span className="cb-stat-v">tga-au · pl-voice</span>
              </span>
              <span className="cb-stat mono">
                <span className="cb-stat-k">tokens</span>
                <span className="cb-stat-v">1,284</span>
              </span>
              <button className="cb-details">Details <Icon name="chevR" size={12}/></button>
            </div>
          </div>

          {/* Expanded flag detail panel */}
          {selectedFlag && (() => {
            const f = flags.find(x => x.id === selectedFlag);
            return (
              <div className={`flag-detail flag-detail-${f.sev}`}>
                <div className="fd-head">
                  <div className="fd-lead">
                    <span className={`chip mono ${f.sev}`}><span className="dot"/>{f.sev === "warn" ? "WARNING" : f.sev.toUpperCase()}</span>
                    <span className="fd-id mono">{f.id}</span>
                    <span className="fd-rule">{f.rule}</span>
                  </div>
                  <button className="btn ghost" onClick={() => setSelectedFlag(null)}><Icon name="x"/></button>
                </div>
                <div className="fd-body">
                  <div className="fd-note">{f.note}</div>
                  <div className="fd-snippet">
                    <span className="fd-snippet-lab mono">FLAGGED</span>
                    <span className="fd-snippet-text">"{f.phrase}"</span>
                  </div>
                  <div className="fd-suggest">
                    <span className="fd-snippet-lab mono">SUGGESTED</span>
                    <span className="fd-snippet-text">"{f.suggestion}"</span>
                    <button className="btn">Apply fix</button>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="preview-head">
            <span>plasmaide.com/blog/pine-bark-circulatory-autumn</span>
            <span className="mono" style={{color:"var(--ink-4)"}}>v.2 · auto-saved 42s ago</span>
          </div>
          <div className={`preview-body preview-blog ${generating ? "is-generating" : ""}`}>
            <div className="mono" style={{fontSize:11, color:"var(--ink-4)", letterSpacing:"0.08em"}}>LONG-FORM · EDUCATIONAL</div>
            <h1 style={{marginTop:6}}>{title}</h1>
            <div className="dateline">Apr 20 · 8 min read · By the Plasmaide team</div>
            <div className="img-placeholder">hero image · 1600×900 · lifestyle shot of bottle + product</div>
            <p>Pine bark extract — specifically from the French maritime pine (<i>Pinus pinaster</i>) — has been studied for its effects on the circulatory system since the late 1980s. The active compounds are procyanidins, a class of bioflavonoids concentrated in the inner bark.</p>
            <p>In our autumn sourcing audit, we selected four harvest batches from the Les Landes forest in southwest France. Each batch was tested for procyanidin content, with an acceptance threshold of 70%. Two batches cleared, two did not.</p>
            <p>A growing body of research suggests that standardised pine bark extract {renderWithFlags("may help reduce chronic inflammation in adults over 40 by up to 32%", ["TGA-001"])}, according to a 2019 meta-analysis covering 14 randomised trials.</p>
            <p>The resulting extract is standardised and used in our Daily capsule, which contains 150mg per serve — aligned with the dosages used in the {renderWithFlags("strongest peer-reviewed trials", ["COPY-044"])}.</p>
            <div className="img-placeholder">inline diagram · endothelial function figure</div>
            <p style={{color:"var(--ink-4)"}}>— continues, 840 more words —</p>
          </div>

          {/* Submit bar */}
          <div className="submit-bar">
            <div className="sb-left">
              <span className="mono sb-status">
                <span className="sb-dot"/>
                {submitted ? "QUEUED FOR APPROVAL" : "READY · 2 warnings to review"}
              </span>
              <span className="sb-meta mono">1,284 words · 8 min read · 2 images</span>
            </div>
            <div className="sb-right">
              <button className="btn">Save draft</button>
              <button
                className={`btn primary ${submitting ? "busy" : ""} ${submitted ? "success" : ""}`}
                onClick={handleSubmit}
                disabled={submitting || submitted}
              >
                {submitting && <><span className="spinner"/> Submitting…</>}
                {submitted && <><Icon name="check"/> Submitted to queue</>}
                {!submitting && !submitted && <><Icon name="approve"/> Submit for approval <span className="kbd">⌘⏎</span></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.StudioPage = StudioPage;
