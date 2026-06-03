// AlertPanel.jsx — HAI algorithm results + beacon trail + event timeline
// Algorithm panel now runs a per-zone simulation independently of sensor data

import { useState, useEffect, useRef } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────
const ZONE_COLORS = { zone_a: "#00ffa3", zone_b: "#40c0ff", zone_c: "#f0c040" };
const ZONE_POS    = { zone_a: 16, zone_b: 50, zone_c: 84 };
const ZONE_LABELS = { zone_a: "Zone A", zone_b: "Zone B", zone_c: "Zone C" };

// Simulated people per zone
const ZONE_PEOPLE = {
  zone_a: ["Dr_Mehta", "Patient_01", "Nurse_Riya"],
  zone_b: ["Nurse_Priya", "Patient_02", "Dr_Singh"],
  zone_c: ["Dr_Singh", "Patient_03"],
};

const KMP_PATTERNS = [
  "Mold+Heat+Crowding",
  "Poor Vent+Contact",
  "Sterile Breach+Movement",
];

// ── Simulation engine ─────────────────────────────────────────────────────────
// Generates realistic algorithm output for a given zone + risk level
function generateSimAlgoResults(zone, riskLevel) {
  const people = ZONE_PEOPLE[zone];
  const source = people[0];

  // BFS — hops from source
  const bfs = { [source]: 0 };
  people.slice(1).forEach((p, i) => { bfs[p] = i % 2 === 0 ? 1 : 2; });
  // add one cross-zone contact at hop 2
  const crossZone = zone === "zone_a" ? "Nurse_Priya" : zone === "zone_b" ? "Dr_Mehta" : "Patient_02";
  bfs[crossZone] = 2;

  // Dijkstra chains
  const chains = [];
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    chains.push(`${source} → ${people[1] ?? "Patient_02"}`);
    chains.push(`${source} → ${crossZone}`);
  } else {
    chains.push(`${source} → ${people[1] ?? "Patient_02"}`);
  }

  // KMP pattern matches
  const kmp = {};
  KMP_PATTERNS.forEach((p, i) => {
    kmp[p] = {
      matched: riskLevel === "CRITICAL"
        ? true
        : riskLevel === "HIGH"
          ? i < 2
          : i < 1,
      index: riskLevel === "CRITICAL" ? Math.floor(Math.random() * 5) : null,
    };
  });

  // Greedy isolation
  const greedy = riskLevel === "CRITICAL"
    ? [zone, zone === "zone_a" ? "zone_b" : "zone_a"]
    : riskLevel === "HIGH"
      ? [zone]
      : [];

  return { bfs, dijkstra: chains, kmp, greedy, zone, riskLevel, source };
}

function getRiskLevel(score) {
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 35) return "MODERATE";
  return "LOW";
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const cardStyle = {
  background: "#0a0f1a",
  border: "1px solid #1a2d44",
  borderRadius: 14,
};

const emptyStyle = {
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: 11,
  color: "#1a3050",
};

function Tag({ color, children }) {
  return (
    <span style={{
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 10, letterSpacing: 1.5,
      background: `${color}18`, color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function SectionLabel({ color = "#2a5070", children }) {
  return (
    <div style={{
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: 10, letterSpacing: 3,
      color, marginBottom: 10,
    }}>{children}</div>
  );
}

// ── BFS panel ────────────────────────────────────────────────────────────────
function BFSPanel({ bfs }) {
  if (!bfs || Object.keys(bfs).length === 0)
    return <div style={emptyStyle}>No exposure data yet</div>;

  const byHop = {};
  Object.entries(bfs).forEach(([node, hops]) => {
    byHop[hops] = [...(byHop[hops] || []), node];
  });

  const hopColors = { "0": "#ff3b5c", "1": "#ff8c42", "2": "#f0c040" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Object.entries(byHop).sort(([a],[b]) => a-b).map(([hop, nodes]) => (
        <div key={hop} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            fontFamily: "'Share Tech Mono', monospace", fontSize: 10,
            color: hopColors[hop] ?? "#f0c040", minWidth: 52,
          }}>HOP {hop}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {nodes.map(n => (
              <Tag key={n} color={hopColors[hop] ?? "#f0c040"}>{n}</Tag>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Dijkstra panel ───────────────────────────────────────────────────────────
function DijkstraPanel({ chains }) {
  if (!chains || chains.length === 0)
    return <div style={emptyStyle}>No transmission path yet</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {chains.map((chain, i) => {
        const nodes = chain.split(/\s*[-→>]+\s*/);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
            {nodes.map((n, j) => (
              <span key={j} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Tag color="#40c0ff">{n.trim()}</Tag>
                {j < nodes.length - 1 && (
                  <span style={{ color: "#40c0ff", fontSize: 12, opacity: 0.5 }}>→</span>
                )}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── KMP panel ────────────────────────────────────────────────────────────────
function KMPPanel({ kmp }) {
  if (!kmp || Object.keys(kmp).length === 0)
    return <div style={emptyStyle}>No pattern data yet</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Object.entries(kmp).map(([name, result]) => (
        <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "4px 0", borderBottom: "1px solid #0d1828" }}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#4a6080" }}>
            {name}
          </span>
          {result.matched
            ? <Tag color="#00ffa3">MATCHED</Tag>
            : <Tag color="#2a4060">NO MATCH</Tag>
          }
        </div>
      ))}
    </div>
  );
}

// ── Greedy panel ─────────────────────────────────────────────────────────────
function GreedyPanel({ zones }) {
  if (!zones || zones.length === 0)
    return <div style={emptyStyle}>No isolation needed</div>;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 11, color: "#4a6080", letterSpacing: 1 }}>
        ISOLATE:
      </span>
      {zones.map(z => (
        <Tag key={z} color="#ff3b5c">{z.toUpperCase()}</Tag>
      ))}
    </div>
  );
}

// ── Algorithm simulation panel ───────────────────────────────────────────────
function AlgoSimPanel({ graphResults, liveScores }) {
  // simResults cycles through zones every 4s
  const [simResults, setSimResults] = useState(() =>
    generateSimAlgoResults("zone_a", "MODERATE")
  );
  const [activeTab, setActiveTab]   = useState("BFS");
  const [simZone, setSimZone]       = useState("zone_a");
  const [scanning, setScanning]     = useState(false);
  const zoneKeys = ["zone_a", "zone_b", "zone_c"];
  const zoneIdx  = useRef(0);

  useEffect(() => {
    const tick = () => {
      setScanning(true);
      setTimeout(() => {
        zoneIdx.current = (zoneIdx.current + 1) % 3;
        const zone  = zoneKeys[zoneIdx.current];
        const score = liveScores?.[zone] ?? 30 + Math.random() * 60;
        const level = getRiskLevel(score);
        setSimZone(zone);
        setSimResults(generateSimAlgoResults(zone, level));
        setScanning(false);
      }, 600);
    };

    const interval = setInterval(tick, 4000);
    return () => clearInterval(interval);
  }, [liveScores]);

  // If real graphResults arrive (risk ≥ 75 triggered), show those instead
  const results   = graphResults ?? simResults;
  const triggered = !!graphResults;
  const zoneColor = ZONE_COLORS[simZone] ?? "#00ffa3";
  const TABS      = ["BFS", "DIJKSTRA", "KMP", "GREEDY"];

  return (
    <div style={{ ...cardStyle, padding: "14px 18px" }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionLabel color={triggered ? "#00ffa3" : zoneColor}>
          {triggered ? "◈ DAA ALGORITHMS — TRIGGERED" : "◈ DAA ALGORITHMS — SIMULATION"}
        </SectionLabel>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {triggered && <Tag color="#ff3b5c">RISK ≥ 75</Tag>}
          {/* scanning indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: scanning ? "#f0c040" : zoneColor,
              boxShadow: `0 0 6px ${scanning ? "#f0c040" : zoneColor}`,
              transition: "all 0.3s",
            }} />
            <span style={{
              fontFamily: "'Share Tech Mono', monospace", fontSize: 9,
              color: zoneColor, letterSpacing: 1,
            }}>{scanning ? "SCANNING..." : ZONE_LABELS[simZone]}</span>
          </div>
        </div>
      </div>

      {/* zone selector pills */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {zoneKeys.map(z => (
          <div key={z} style={{
            fontFamily: "'Share Tech Mono', monospace", fontSize: 9,
            padding: "2px 8px", borderRadius: 10,
            border: `1px solid ${simZone === z ? ZONE_COLORS[z] : "#1a2d44"}44`,
            background: simZone === z ? `${ZONE_COLORS[z]}18` : "transparent",
            color: simZone === z ? ZONE_COLORS[z] : "#1a3050",
            transition: "all 0.4s",
            letterSpacing: 1,
          }}>{z.replace("_", " ").toUpperCase()}</div>
        ))}
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            fontFamily: "'Share Tech Mono', monospace", fontSize: 10,
            letterSpacing: 1.5, padding: "4px 10px", borderRadius: 4,
            border: `1px solid ${activeTab === t ? "#00ffa344" : "#1a2d44"}`,
            background: activeTab === t ? "#00ffa318" : "transparent",
            color: activeTab === t ? "#00ffa3" : "#2a4060",
            cursor: "pointer", transition: "all 0.2s",
          }}>{t}</button>
        ))}
      </div>

      {/* tab content — fade in on zone change */}
      <div style={{
        minHeight: 80,
        opacity: scanning ? 0.3 : 1,
        transition: "opacity 0.3s",
      }}>
        {activeTab === "BFS"      && <BFSPanel      bfs={results?.bfs} />}
        {activeTab === "DIJKSTRA" && <DijkstraPanel chains={results?.dijkstra} />}
        {activeTab === "KMP"      && <KMPPanel      kmp={results?.kmp} />}
        {activeTab === "GREEDY"   && <GreedyPanel   zones={results?.greedy} />}
      </div>
    </div>
  );
}

// ── Beacon trail ─────────────────────────────────────────────────────────────
function BeaconTrail({ history }) {
  if (!history || history.length === 0)
    return (
      <div style={{ ...cardStyle, padding: "14px 18px" }}>
        <SectionLabel color="#2a5070">◉ BEACON TRAIL</SectionLabel>
        <div style={emptyStyle}>No beacon movement recorded</div>
      </div>
    );

  const recent = [...history].slice(-12);

  return (
    <div style={{ ...cardStyle, padding: "14px 18px" }}>
      <SectionLabel color="#00ffa3">◉ BEACON TRAIL</SectionLabel>

      <div style={{ position: "relative", height: 56, background: "#060c17",
        borderRadius: 8, border: "1px solid #1a2d44", marginBottom: 12, overflow: "hidden" }}>
        {Object.entries(ZONE_COLORS).map(([z, c]) => (
          <div key={z} style={{
            position: "absolute", top: 6,
            left: `${ZONE_POS[z]}%`, transform: "translateX(-50%)",
            fontFamily: "'Rajdhani', sans-serif", fontSize: 9,
            color: `${c}88`, letterSpacing: 2,
          }}>{z.replace("_", " ").toUpperCase()}</div>
        ))}
        {[33, 67].map(p => (
          <div key={p} style={{ position: "absolute", top: 0, bottom: 0,
            left: `${p}%`, width: 1, background: "#1a2d44" }} />
        ))}
        {recent.map((ev, i) => {
          const x       = ZONE_POS[ev.zone] || 50;
          const opacity = 0.3 + (i / recent.length) * 0.7;
          const isLast  = i === recent.length - 1;
          const color   = ZONE_COLORS[ev.zone] || "#00ffa3";
          return (
            <div key={i} style={{
              position: "absolute",
              left: `${x + (Math.sin(i * 1.7) * 4)}%`,
              top: `${30 + Math.cos(i * 1.3) * 12}%`,
              transform: "translate(-50%,-50%)",
              width: isLast ? 10 : 6, height: isLast ? 10 : 6,
              borderRadius: "50%", background: color, opacity,
              boxShadow: isLast ? `0 0 10px ${color}` : "none",
              transition: "all 0.3s",
            }} />
          );
        })}
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible" }}>
          <polyline
            points={recent.map((ev, i) => {
              const x = ZONE_POS[ev.zone] || 50;
              const y = 50 + Math.cos(i * 1.3) * 12;
              return `${x}%,${y}%`;
            }).join(" ")}
            fill="none" stroke="#ff3b5c" strokeWidth="1"
            strokeDasharray="3 3" opacity="0.4"
          />
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 100, overflowY: "auto" }}>
        {[...recent].reverse().map((ev, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center",
            fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: ZONE_COLORS[ev.zone] || "#00ffa3",
              boxShadow: `0 0 6px ${ZONE_COLORS[ev.zone] || "#00ffa3"}`,
            }} />
            <span style={{ color: ZONE_COLORS[ev.zone] || "#00ffa3" }}>
              {ev.zone?.toUpperCase()}
            </span>
            <span style={{ color: "#2a4060" }}>
              {typeof ev.time === "number"
                ? new Date(ev.time * 1000).toLocaleTimeString("en-IN", { hour12: false })
                : ev.time}
            </span>
            <span style={{ color: "#1a3050" }}>{ev.who}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Event timeline ────────────────────────────────────────────────────────────
function EventTimeline({ alerts }) {
  if (!alerts || alerts.length === 0)
    return (
      <div style={{ ...cardStyle, padding: "14px 18px" }}>
        <SectionLabel color="#2a5070">⏱ EVENT TIMELINE</SectionLabel>
        <div style={emptyStyle}>Waiting for events…</div>
      </div>
    );

  return (
    <div style={{ ...cardStyle, padding: "14px 18px" }}>
      <SectionLabel color="#ff3b5c">⏱ LIVE EVENT TIMELINE</SectionLabel>
      <div style={{ position: "relative", paddingLeft: 16 }}>
        <div style={{ position: "absolute", left: 5, top: 0, bottom: 0,
          width: 1, background: "linear-gradient(to bottom, #ff3b5c44, transparent)" }} />
        {alerts.map((a, i) => (
          <div key={i} style={{ position: "relative", paddingBottom: 10 }}>
            <div style={{ position: "absolute", left: -13, top: 4,
              width: 7, height: 7, borderRadius: "50%",
              background: i === 0 ? "#ff3b5c" : "#2a4060",
              boxShadow: i === 0 ? "0 0 8px #ff3b5c" : "none",
            }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11,
                color: i === 0 ? "#ff6b80" : "#3a5070" }}>
                {a.zone?.toUpperCase()} — CRITICAL
              </span>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10,
                color: "#1a3050" }}>{a.time}</span>
            </div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 11,
              color: "#2a4060", letterSpacing: 1 }}>
              score={a.score} · algorithms triggered
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main AlertPanel ──────────────────────────────────────────────────────────
export default function AlertPanel({ graphResults, alerts, beaconHistory, liveScores }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <AlgoSimPanel graphResults={graphResults} liveScores={liveScores} />
      <BeaconTrail history={beaconHistory} />
      <EventTimeline alerts={alerts} />
    </div>
  );
}