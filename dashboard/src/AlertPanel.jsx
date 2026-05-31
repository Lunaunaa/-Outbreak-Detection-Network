// AlertPanel.jsx — Full HAI algorithm results + beacon trail + event timeline
// Receives data from useMqtt → graphResults, alerts, beaconHistory

import { useState } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────
const ZONE_COLORS = { zone_a: "#00ffa3", zone_b: "#40c0ff", zone_c: "#f0c040" };
const ZONE_POS    = { zone_a: 16, zone_b: 50, zone_c: 84 }; // % x position on map

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

  // group by hops
  const byHop = {};
  Object.entries(bfs).forEach(([node, hops]) => {
    byHop[hops] = [...(byHop[hops] || []), node];
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Object.entries(byHop).sort(([a],[b]) => a-b).map(([hop, nodes]) => (
        <div key={hop} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            fontFamily: "'Share Tech Mono', monospace", fontSize: 10,
            color: hop === "0" ? "#ff3b5c" : hop === "1" ? "#ff8c42" : "#f0c040",
            minWidth: 52,
          }}>HOP {hop}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {nodes.map(n => (
              <Tag key={n} color={hop === "0" ? "#ff3b5c" : hop === "1" ? "#ff8c42" : "#f0c040"}>
                {n}
              </Tag>
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

// ── Beacon trail map ─────────────────────────────────────────────────────────
function BeaconTrail({ history }) {
  if (!history || history.length === 0)
    return (
      <div style={{ ...cardStyle, padding: "14px 18px" }}>
        <SectionLabel color="#2a5070">◉ BEACON TRAIL</SectionLabel>
        <div style={emptyStyle}>No beacon movement recorded</div>
      </div>
    );

  // last 12 events
  const recent = [...history].slice(-12);

  return (
    <div style={{ ...cardStyle, padding: "14px 18px" }}>
      <SectionLabel color="#00ffa3">◉ BEACON TRAIL</SectionLabel>

      {/* floor plan with dot trail */}
      <div style={{ position: "relative", height: 56, background: "#060c17",
        borderRadius: 8, border: "1px solid #1a2d44", marginBottom: 12, overflow: "hidden" }}>

        {/* zone labels */}
        {Object.entries(ZONE_COLORS).map(([z, c]) => (
          <div key={z} style={{
            position: "absolute", top: 6,
            left: `${ZONE_POS[z]}%`, transform: "translateX(-50%)",
            fontFamily: "'Rajdhani', sans-serif", fontSize: 9,
            color: `${c}88`, letterSpacing: 2,
          }}>{z.replace("_", " ").toUpperCase()}</div>
        ))}

        {/* dividers */}
        {[33, 67].map(p => (
          <div key={p} style={{ position: "absolute", top: 0, bottom: 0,
            left: `${p}%`, width: 1, background: "#1a2d44" }} />
        ))}

        {/* trail dots */}
        {recent.map((ev, i) => {
          const x = ZONE_POS[ev.zone] || 50;
          const opacity = 0.3 + (i / recent.length) * 0.7;
          const isLast  = i === recent.length - 1;
          const color   = ZONE_COLORS[ev.zone] || "#00ffa3";
          return (
            <div key={i} style={{
              position: "absolute",
              left: `${x + (Math.sin(i * 1.7) * 4)}%`,
              top: `${30 + Math.cos(i * 1.3) * 12}%`,
              transform: "translate(-50%,-50%)",
              width: isLast ? 10 : 6,
              height: isLast ? 10 : 6,
              borderRadius: "50%",
              background: color,
              opacity,
              boxShadow: isLast ? `0 0 10px ${color}` : "none",
              transition: "all 0.3s",
            }} />
          );
        })}

        {/* connecting line */}
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible" }}>
          <polyline
            points={recent.map((ev, i) => {
              const x = (ZONE_POS[ev.zone] || 50);
              const y = 50 + Math.cos(i * 1.3) * 12;
              return `${x}%,${y}%`;
            }).join(" ")}
            fill="none"
            stroke="#ff3b5c"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.4"
          />
        </svg>
      </div>

      {/* history list */}
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
        {/* vertical line */}
        <div style={{ position: "absolute", left: 5, top: 0, bottom: 0,
          width: 1, background: "linear-gradient(to bottom, #ff3b5c44, transparent)" }} />

        {alerts.map((a, i) => (
          <div key={i} style={{ position: "relative", paddingBottom: 10 }}>
            {/* dot */}
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
const TABS = ["BFS", "DIJKSTRA", "KMP", "GREEDY"];

export default function AlertPanel({ graphResults, alerts, beaconHistory }) {
  const [activeTab, setActiveTab] = useState("BFS");
  const triggered = !!graphResults;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* DAA algorithms card */}
      <div style={{ ...cardStyle, padding: "14px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <SectionLabel color={triggered ? "#00ffa3" : "#1a4060"} >
            {triggered ? "◈ DAA ALGORITHMS — TRIGGERED" : "◈ DAA ALGORITHMS"}
          </SectionLabel>
          {triggered && <Tag color="#ff3b5c">RISK ≥ 75</Tag>}
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

        {/* tab content */}
        <div style={{ minHeight: 60 }}>
          {activeTab === "BFS"      && <BFSPanel      bfs={graphResults?.bfs} />}
          {activeTab === "DIJKSTRA" && <DijkstraPanel chains={graphResults?.dijkstra} />}
          {activeTab === "KMP"      && <KMPPanel      kmp={graphResults?.kmp} />}
          {activeTab === "GREEDY"   && <GreedyPanel   zones={graphResults?.greedy} />}
        </div>
      </div>

      {/* Beacon trail */}
      <BeaconTrail history={beaconHistory} />

      {/* Event timeline */}
      <EventTimeline alerts={alerts} />

    </div>
  );
}

// ── shared styles ─────────────────────────────────────────────────────────────
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