// Sparkline component
function Sparkline({ data, width = 160, height = 36, color = "var(--accent)", style = "area", showPoint = true }) {
  if (!data || !data.length) return <div style={{height}}/>;
  const w = width, h = height;
  const pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = (max - min) || 1;
  const step = (w - pad * 2) / (data.length - 1 || 1);

  const pts = data.map((v, i) => [pad + i * step, h - pad - ((v - min) / range) * (h - pad * 2)]);
  const line = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const area = line + ` L${pts[pts.length-1][0]},${h - pad} L${pts[0][0]},${h - pad} Z`;

  const last = pts[pts.length - 1];

  if (style === "bars") {
    const bw = Math.max(1.5, step * 0.6);
    return (
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:"block"}}>
        {pts.map(([x, y], i) => (
          <rect key={i} x={x - bw/2} y={y} width={bw} height={h - pad - y} fill={color} opacity="0.85" rx="0.5"/>
        ))}
      </svg>
    );
  }

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:"block"}}>
      {style === "area" && (
        <>
          <defs>
            <linearGradient id={`sg-${color.replace(/[^a-z]/gi,'')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#sg-${color.replace(/[^a-z]/gi,'')})`}/>
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {showPoint && (
        <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} stroke="var(--panel)" strokeWidth="1.5"/>
      )}
    </svg>
  );
}

window.Sparkline = Sparkline;
