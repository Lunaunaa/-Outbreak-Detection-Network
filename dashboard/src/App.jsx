import { useState, useEffect, useRef } from "react";
import { useMqtt } from "./useMqtt";
import AlertPanel from "./AlertPanel";
import ZoneMap from "./ZoneMap";

// ── Palette & constants ──────────────────────────────────────────────────────
const ZONES = [
  { id: "zone_a", label: "Zone A", position: "left" },
  { id: "zone_b", label: "Zone B", position: "center" },
  { id: "zone_c", label: "Zone C", position: "right" },
];

const RISK_LEVELS = [
  { max: 40,  label: "SAFE",     color: "#00ffa3", glow: "0 0 24px #00ffa355" },
  { max: 60,  label: "MODERATE", color: "#f0c040", glow: "0 0 24px #f0c04055" },
  { max: 75,  label: "ELEVATED", color: "#ff8c42", glow: "0 0 24px #ff8c4255" },
  { max: 101, label: "CRITICAL", color: "#ff3b5c", glow: "0 0 30px #ff3b5c88" },
];

function getRisk(score) {
  return RISK_LEVELS.find((r) => score < r.max) || RISK_LEVELS[3];
}

// ── Simulated sensor data (replace with real WebSocket later) ────────────────

// ── Animated number ──────────────────────────────────────────────────────────
function AnimNum({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const diff = value - prev.current;
    const steps = 12;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplay(+(prev.current + (diff * i) / steps).toFixed(decimals));
      if (i >= steps) { clearInterval(iv); prev.current = value; }
    }, 30);
    return () => clearInterval(iv);
  }, [value]);
  return <span>{display}</span>;
}

// ── Radial risk gauge ────────────────────────────────────────────────────────
function RiskGauge({ score }) {
  const risk = getRisk(score);
  const pct  = score / 100;
  const r    = 38, cx = 48, cy = 52;
  const arc  = 2 * Math.PI * r;
  const dash = arc * pct;

  return (
    <svg width="96" height="72" viewBox="0 0 96 72">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2235" strokeWidth="7" strokeDasharray={`${arc * 0.75} ${arc * 0.25}`} strokeDashoffset={arc * 0.125} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={risk.color} strokeWidth="7"
        strokeDasharray={`${Math.min(dash, arc * 0.75)} ${arc}`}
        strokeDashoffset={arc * 0.125}
        strokeLinecap="round"
        style={{ filter: risk.glow, transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fill={risk.color} fontSize="16" fontWeight="700" fontFamily="'Share Tech Mono', monospace">{score}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill={risk.color} fontSize="7" fontFamily="'Rajdhani', sans-serif" letterSpacing="1.5">{risk.label}</text>
    </svg>
  );
}

// ── Zone card ────────────────────────────────────────────────────────────────
function ZoneCard({ zone, data }) {
  const risk  = getRisk(data.score);
  const pulse = data.score >= 75;

  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(160deg, #0d1525 0%, #0a1020 100%)",
      border: `1px solid ${risk.color}44`,
      borderRadius: 16,
      padding: "18px 20px 14px",
      overflow: "hidden",
      boxShadow: pulse ? risk.glow : "0 4px 24px #00000066",
      animation: pulse ? "pulseBorder 1.2s ease-in-out infinite" : "none",
      transition: "box-shadow 0.5s ease, border-color 0.5s ease",
      minWidth: 0,
    }}>
      {/* corner accent */}
      <div style={{ position:"absolute", top:0, left:0, width:40, height:40,
        background:`linear-gradient(135deg, ${risk.color}33 0%, transparent 60%)`,
        borderRadius:"16px 0 40px 0" }} />

      {/* header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div>
          <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:11, letterSpacing:3, color:"#4a6080", marginBottom:2 }}>ICU ROOM</div>
          <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:20, color:"#e0eeff", letterSpacing:1 }}>{zone.label}</div>
        </div>
        <RiskGauge score={data.score} />
      </div>

      {/* beacon badge */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
        <div style={{ width:7, height:7, borderRadius:"50%",
          background: data.beacon ? "#00ffa3" : "#2a3a50",
          boxShadow: data.beacon ? "0 0 8px #00ffa3" : "none",
          transition:"all 0.3s" }} />
        <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:10, color: data.beacon ? "#00ffa3" : "#2a3a50", letterSpacing:1.5 }}>
          {data.beacon ? `BEACON DETECTED  RSSI ${data.rssi}` : "NO BEACON"}
        </span>
      </div>

      {/* sensor grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 12px" }}>
        {[
          { label:"TEMP",     value:<><AnimNum value={data.temp} decimals={1} />°C</>, icon:"🌡" },
          { label:"HUMIDITY", value:<><AnimNum value={data.humidity} decimals={1} />%</>,  icon:"💧" },
          { label:"CO",       value:<><AnimNum value={data.co} />ppm</>,  icon:"☁" },
          { label:"SMOKE",    value:<><AnimNum value={data.smoke} />adc</>, icon:"🔥" },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{ background:"#0b1828", borderRadius:8, padding:"7px 10px" }}>
            <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, letterSpacing:2, color:"#3a5070", marginBottom:2 }}>{icon} {label}</div>
            <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:13, color:"#a0c4e8" }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Alert log ────────────────────────────────────────────────────────────────
function AlertLog({ alerts }) {
  return (
    <div style={{ background:"#0a0f1a", border:"1px solid #ff3b5c33", borderRadius:14, padding:"14px 18px" }}>
      <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:10, letterSpacing:3, color:"#ff3b5c", marginBottom:10 }}>⚠ ALERT LOG</div>
      {alerts.length === 0
        ? <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:11, color:"#2a3a50" }}>— no critical events —</div>
        : alerts.map((a, i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0",
            borderBottom:"1px solid #111d2e", fontFamily:"'Share Tech Mono', monospace", fontSize:11 }}>
            <span style={{ color:"#ff6b80" }}>{a.zone.toUpperCase()} CRITICAL</span>
            <span style={{ color:"#ff3b5c" }}>score={a.score}</span>
            <span style={{ color:"#2a4060" }}>{a.time}</span>
          </div>
        ))
      }
    </div>
  );
}

// ── Graph algorithm results ──────────────────────────────────────────────────
function GraphPanel({ results }) {
  if (!results) return (
    <div style={{ background:"#0a0f1a", border:"1px solid #1a2d44", borderRadius:14, padding:"14px 18px" }}>
      <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:10, letterSpacing:3, color:"#1a4060", marginBottom:6 }}>DAA ALGORITHMS</div>
      <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:11, color:"#1a3050" }}>Waiting for risk ≥ 75 trigger…</div>
    </div>
  );

  const items = [
    { tag:"BFS",    color:"#00ffa3", value: results.bfs.join(" | ") },
    { tag:"DIJKSTRA", color:"#40c0ff", value: results.dp },
    { tag:"KMP",    color:"#f0c040", value: results.kmp },
    { tag:"GREEDY", color:"#ff8c42", value: `Isolate: ${results.greedy.join(", ")}` },
  ];

  return (
    <div style={{ background:"#0a0f1a", border:"1px solid #00ffa333", borderRadius:14, padding:"14px 18px" }}>
      <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:10, letterSpacing:3, color:"#00ffa3", marginBottom:10 }}>◈ DAA ALGORITHMS — TRIGGERED</div>
      {items.map(({ tag, color, value }) => (
        <div key={tag} style={{ display:"flex", gap:10, padding:"5px 0", borderBottom:"1px solid #0d1828",
          alignItems:"flex-start", fontFamily:"'Share Tech Mono', monospace", fontSize:11 }}>
          <span style={{ color, minWidth:72, letterSpacing:1 }}>{tag}</span>
          <span style={{ color:"#6080a0" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Scanline overlay ─────────────────────────────────────────────────────────
function Scanlines() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:999,
      backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,20,40,0.15) 2px, rgba(0,20,40,0.15) 4px)",
    }} />
  );
}

// ── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({ data }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const maxScore = Math.max(...Object.values(data).map(d => d.score));
  const sysRisk  = getRisk(maxScore);

  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"12px 28px", background:"#060c17", borderBottom:"1px solid #0d1e30",
      position:"sticky", top:0, zIndex:100 }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:28, height:28, borderRadius:6, background:"linear-gradient(135deg,#00ffa3,#0080ff)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>⚕</div>
        <div>
          <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, letterSpacing:4, color:"#2a5070" }}>REAL-TIME MONITORING</div>
          <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:15, color:"#c0deff", letterSpacing:1 }}>ICU HAI RISK DASHBOARD</div>
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:24 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, letterSpacing:3, color:"#2a5070" }}>SYSTEM RISK</div>
          <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:14, color:sysRisk.color, filter:sysRisk.glow }}>{sysRisk.label}</div>
        </div>
        <div style={{ width:1, height:32, background:"#0d2030" }} />
        <div style={{ textAlign:"right" }}>
          <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, letterSpacing:3, color:"#2a5070" }}>SYSTEM TIME</div>
          <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:13, color:"#4a7090" }}>
            {time.toLocaleTimeString("en-IN", { hour12:false })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Floor plan mini-map ──────────────────────────────────────────────────────
function FloorMap({ data }) {
  return (
    <div style={{ background:"#0a0f1a", border:"1px solid #1a2d44", borderRadius:14, padding:"14px 18px" }}>
      <div style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:10, letterSpacing:3, color:"#2a5070", marginBottom:12 }}>◫ FLOOR PLAN</div>
      <div style={{ display:"flex", gap:6, height:64 }}>
        {ZONES.map((z) => {
          const risk = getRisk(data[z.id].score);
          return (
            <div key={z.id} style={{ flex:1, borderRadius:8, background:`${risk.color}18`,
              border:`1.5px solid ${risk.color}55`, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", transition:"all 0.5s",
              boxShadow: data[z.id].score >= 75 ? risk.glow : "none" }}>
              <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:9, color:risk.color, letterSpacing:1 }}>{z.label}</div>
              <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:12, color:risk.color, fontWeight:700 }}>{data[z.id].score}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
        {RISK_LEVELS.map(r => (
          <div key={r.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:r.color }} />
            <span style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:9, color:"#2a4060", letterSpacing:1 }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { data, alerts, graphResults, beaconHistory, status } = useMqtt();

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060c17; }
        @keyframes pulseBorder {
          0%,100% { box-shadow: 0 0 20px #ff3b5c44; }
          50%      { box-shadow: 0 0 40px #ff3b5c99; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #060c17; }
        ::-webkit-scrollbar-thumb { background: #1a3050; border-radius: 2px; }
      `}</style>

      <Scanlines />

      <div style={{ minHeight:"100vh", background:"#060c17", color:"#e0eeff" }}>
        <TopBar data={data} />

        <div style={{ padding:"20px 24px", maxWidth:1200, margin:"0 auto" }}>

          {/* Zone cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:16 }}>
            {ZONES.map((z) => (
              <ZoneCard key={z.id} zone={z} data={data[z.id]} />
            ))}
          </div>

          {/* Bottom row */}
          <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16, marginTop:16 }}>
            <ZoneMap data={data} />
            <AlertPanel graphResults={graphResults} alerts={alerts} beaconHistory={beaconHistory} />
          </div>

        </div>
      </div>
    </>
  );
}