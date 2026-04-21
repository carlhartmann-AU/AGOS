function Contact({ go }) {
  const [form, setForm] = React.useState({ name: '', email: '', company: '', message: '' });
  const [status, setStatus] = React.useState('idle'); // idle | sending | success | error
  const [errorMsg, setErrorMsg] = React.useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch('https://formspree.io/f/mzdyaaaa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setForm({ name: '', email: '', company: '', message: '' });
      } else {
        setStatus('error');
        setErrorMsg(data?.errors?.[0]?.message || 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  };

  return (
    <div>
      <section className="hero" style={{ borderTop: 0, paddingBottom: 80 }}>
        <div className="grid-bg" />
        <div className="wrap inner" style={{ maxWidth: 640 }}>
          <div className="eyebrow" style={{ marginBottom: 20 }}>
            <span className="dot" />
            <span>Get in touch</span>
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(32px,4vw,52px)', marginTop: 0 }}>
            Talk to the team
          </h1>
          <p className="sub-lead" style={{ fontSize: 16 }}>
            Whether you want a demo, have a question about pricing, or just want to see if AGOS is the right fit — we'll get back to you within one business day.
          </p>

          {status === 'success' ? (
            <div style={{
              marginTop: 32, padding: '28px 32px', background: 'rgba(15,138,95,.12)',
              border: '1px solid rgba(15,138,95,.3)', borderRadius: 12, color: '#6dd9a7',
            }}>
              <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>Message sent</div>
              <p style={{ margin: 0, color: 'var(--nav-ink)', fontSize: 14, lineHeight: 1.6 }}>
                Thanks — we'll be in touch within one business day.
              </p>
              <button
                onClick={() => setStatus('idle')}
                style={{ marginTop: 16, background: 'none', border: '1px solid rgba(15,138,95,.4)', color: '#6dd9a7', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={submit} style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--nav-ink-2)', fontFamily: "'Geist Mono',monospace" }}>Name *</span>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="Jane Smith"
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--nav-ink-2)', fontFamily: "'Geist Mono',monospace" }}>Email *</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="jane@brand.com"
                    style={inputStyle}
                  />
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--nav-ink-2)', fontFamily: "'Geist Mono',monospace" }}>Company</span>
                <input
                  type="text"
                  value={form.company}
                  onChange={set('company')}
                  placeholder="Acme Supplements"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--nav-ink-2)', fontFamily: "'Geist Mono',monospace" }}>Message *</span>
                <textarea
                  required
                  value={form.message}
                  onChange={set('message')}
                  placeholder="Tell us about your brand and what you're hoping AGOS can do for you..."
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', height: 'auto', lineHeight: 1.55, paddingTop: 10, paddingBottom: 10 }}
                />
              </label>

              {status === 'error' && (
                <div style={{ padding: '10px 14px', background: 'rgba(192,37,37,.1)', border: '1px solid rgba(192,37,37,.3)', borderRadius: 6, color: '#f9a8a8', fontSize: 13 }}>
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="btn primary lg"
                style={{ alignSelf: 'flex-start', opacity: status === 'sending' ? 0.7 : 1, cursor: status === 'sending' ? 'wait' : 'pointer' }}
              >
                {status === 'sending' ? 'Sending…' : 'Send message'}
                {status !== 'sending' && <Icon name="arrow" />}
              </button>
            </form>
          )}
        </div>
      </section>

      <section style={{ padding: '64px 0' }}>
        <div className="wrap" style={{ maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'Book a demo', desc: "See AGOS live with your brand's real use cases. 30 minutes, no slides.", ico: 'dash' },
              { label: 'Enterprise enquiries', desc: 'Custom pricing, SSO, audit logs, white-label, and SLA. Talk to our team.', ico: 'shield' },
            ].map((c, i) => (
              <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '22px 24px', background: 'var(--panel)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'grid', placeItems: 'center', marginBottom: 12, border: '1px solid var(--accent-line)' }}>
                  <Icon name={c.ico} size={18} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{c.label}</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const inputStyle = {
  background: 'rgba(255,255,255,.06)',
  border: '1px solid var(--nav-line)',
  borderRadius: 7,
  color: '#fff',
  padding: '0 14px',
  height: 40,
  fontSize: 14,
  width: '100%',
  outline: 'none',
  fontFamily: "'Geist',system-ui,sans-serif",
  transition: 'border-color 140ms',
};

Object.assign(window, { Contact });
