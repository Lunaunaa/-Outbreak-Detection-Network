// ZoneMap.jsx — Interactive ICU floor plan mirroring the physical cardboard model
// 3 rooms across top (Zone A left, Zone B center, Zone C right)
// Electronics/hub area at bottom center

import { useState } from "react";

const ZONE_COLORS = {
  zone_a: { safe: "#00ffa3", mid: "#f0c040", high: "#ff8c42", crit: "#ff3b5c" },
  zone_b: { safe: "#00ffa3", mid: "#f0c040", high: "#ff8c42", crit: "#ff3b5c" },
  zone_c: { safe: "#00ffa3", mid: "#f0c040", high: "#ff8c42", crit: "#ff3b5c" },
};

function getRiskColor(score) {
  if (score >= 75) return "#ff3b5c";
  if (score >= 55) return "#ff8c42";
  if (score >= 35) return "#f0c040";
  return "#00ffa3";
}

function getRiskLabel(score) {
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 35) return "MODERATE";
  return "SAFE";
}

// ── Animated pulse ring for beacon ──────────────────────────────────────────
function BeaconPulse({ x, y, color }) {
  return (
    <g>
      <circle cx={x} cy={y} r={6} fill={color} opacity={0.9} />
      <circle cx={x} cy={y} r={6} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6}>
        <animate attributeName="r" values="6;14" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r={6} fill="none" stroke={color} strokeWidth={1} opacity={0.3}>
        <animate attributeName="r" values="6;20" dur="1.5s" begin="0.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0" dur="1.5s" begin="0.4s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

// ── Sensor dot ───────────────────────────────────────────────────────────────
function SensorDot({ x, y, color, label }) {
  return (
    <g>
      <circle cx={x} cy={y} r={4} fill={`${color}33`} stroke={color} strokeWidth={1} />
      <circle cx={x} cy={y} r={2} fill={color} />
      <text x={x} y={y + 12} textAnchor="middle" fill={color} fontSize={7}
        fontFamily="'Share Tech Mono', monospace" opacity={0.7}>{label}</text>
    </g>
  );
}

// ── Risk fill bar inside room ─────────────────────────────────────────────────
function RiskBar({ x, y, w, score, color }) {
  const fill = Math.max(2, (score / 100) * w);
  return (
    <g>
      <rect x={x} y={y} width={w} height={4} rx={2} fill="#0d1828" />
      <rect x={x} y={y} width={fill} height={4} rx={2} fill={color}
        style={{ transition: "width 0.6s ease, fill 0.5s ease" }} />
    </g>
  );
}

// ── Main floor plan SVG ──────────────────────────────────────────────────────
export default function ZoneMap({ data }) {
  const [hovered, setHovered] = useState(null);

  const zones = [
    { id: "zone_a", label: "Zone A", x: 18,  y: 22, w: 98, h: 110, sensorX: 52,  sensorY: 80,  beaconX: 78,  beaconY: 55 },
    { id: "zone_b", label: "Zone B", x: 128, y: 22, w: 98, h: 110, sensorX: 163, sensorY: 80,  beaconX: 188, beaconY: 55 },
    { id: "zone_c", label: "Zone C", x: 238, y: 22, w: 98, h: 110, sensorX: 274, sensorY: 80,  beaconX: 298, beaconY: 55 },
  ];

  return (
    <div style={{
      background: "#0a0f1a",
      border: "1px solid #1a2d44",
      borderRadius: 14,
      padding: "14px 18px",
    }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 10, letterSpacing: 3, color: "#2a5070" }}>
          ◫ ICU FLOOR PLAN — LIVE
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[["SAFE","#00ffa3"],["MODERATE","#f0c040"],["HIGH","#ff8c42"],["CRITICAL","#ff3b5c"]].map(([l,c]) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ width:6, height:6, borderRadius:2, background:c }} />
              <span style={{ fontFamily:"'Rajdhani', sans-serif", fontSize:8, color:"#2a4060", letterSpacing:1 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG floor plan */}
      <svg viewBox="0 0 356 210" style={{ width: "100%", height: "auto" }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {zones.map(z => {
            const color = getRiskColor(data[z.id]?.score || 0);
            return (
              <radialGradient key={z.id} id={`grad-${z.id}`} cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor={color} stopOpacity="0.08" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </radialGradient>
            );
          })}
        </defs>

        {/* outer border of model */}
        <rect x={10} y={14} width={336} height={188} rx={6}
          fill="none" stroke="#1a2d44" strokeWidth={1} strokeDasharray="4 3" />

        {/* hub / electronics area at bottom */}
        <rect x={118} y={148} width={120} height={44} rx={6}
          fill="#060c17" stroke="#1a3050" strokeWidth={1} />
        <text x={178} y={165} textAnchor="middle" fill="#1a4060" fontSize={8}
          fontFamily="'Rajdhani', sans-serif" letterSpacing={2}>HUB</text>
        <text x={178} y={177} textAnchor="middle" fill="#1a3050" fontSize={7}
          fontFamily="'Share Tech Mono', monospace">ESP32 + RPi</text>

        {/* connecting lines from hub to zones */}
        {zones.map(z => (
          <line key={z.id}
            x1={178} y1={148}
            x2={z.x + z.w / 2} y2={z.y + z.h}
            stroke="#1a3050" strokeWidth={0.8} strokeDasharray="3 3" />
        ))}

        {/* zone rooms */}
        {zones.map(z => {
          const score = data[z.id]?.score || 0;
          const color = getRiskColor(score);
          const isHov = hovered === z.id;
          const hasBcn = data[z.id]?.beacon;

          return (
            <g key={z.id}
              onMouseEnter={() => setHovered(z.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}>

              {/* room fill */}
              <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={6}
                fill={`url(#grad-${z.id})`} />

              {/* room border */}
              <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={6}
                fill="none" stroke={color} strokeWidth={isHov ? 1.5 : 1}
                opacity={isHov ? 1 : 0.5}
                style={{ transition: "stroke-width 0.2s, opacity 0.2s" }} />

              {/* corner glow when critical */}
              {score >= 75 && (
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={6}
                  fill="none" stroke={color} strokeWidth={3} opacity={0.15}
                  filter="url(#glow)" />
              )}

              {/* zone label */}
              <text x={z.x + 8} y={z.y + 16} fill={color} fontSize={9}
                fontFamily="'Rajdhani', sans-serif" letterSpacing={2} opacity={0.7}>
                ICU ROOM
              </text>
              <text x={z.x + 8} y={z.y + 30} fill={color} fontSize={14}
                fontFamily="'Share Tech Mono', monospace" fontWeight="700">
                {z.label}
              </text>

              {/* risk score */}
              <text x={z.x + z.w - 8} y={z.y + 22} textAnchor="end"
                fill={color} fontSize={18} fontFamily="'Share Tech Mono', monospace" fontWeight="700"
                style={{ filter: score >= 75 ? `drop-shadow(0 0 6px ${color})` : "none" }}>
                {score}
              </text>
              <text x={z.x + z.w - 8} y={z.y + 32} textAnchor="end"
                fill={color} fontSize={7} fontFamily="'Rajdhani', sans-serif" letterSpacing={1.5}>
                {getRiskLabel(score)}
              </text>

              {/* risk bar */}
              <RiskBar x={z.x + 8} y={z.y + 38} w={z.w - 16} score={score} color={color} />

              {/* sensor readings */}
              <text x={z.x + 8} y={z.y + 60} fill="#2a4060" fontSize={8}
                fontFamily="'Share Tech Mono', monospace">
                {data[z.id]?.temp?.toFixed(1) || "--"}°C
              </text>
              <text x={z.x + 8} y={z.y + 72} fill="#2a4060" fontSize={8}
                fontFamily="'Share Tech Mono', monospace">
                {data[z.id]?.humidity?.toFixed(1) || "--"}%
              </text>
              <text x={z.x + z.w - 8} y={z.y + 60} textAnchor="end" fill="#2a4060" fontSize={8}
                fontFamily="'Share Tech Mono', monospace">
                CO {data[z.id]?.co || "--"}
              </text>
              <text x={z.x + z.w - 8} y={z.y + 72} textAnchor="end" fill="#2a4060" fontSize={8}
                fontFamily="'Share Tech Mono', monospace">
                MQ2 {data[z.id]?.smoke || "--"}
              </text>

              {/* DHT sensor dot */}
              <SensorDot x={z.sensorX} y={z.sensorY} color={color} label="DHT" />

              {/* beacon pulse if detected */}
              {hasBcn && (
                <BeaconPulse x={z.beaconX} y={z.beaconY} color="#00ffa3" />
              )}

              {/* bed icon */}
              <rect x={z.x + z.w/2 - 14} y={z.y + 88} width={28} height={16} rx={3}
                fill="#0d1828" stroke="#1a3050" strokeWidth={0.8} />
              <rect x={z.x + z.w/2 - 10} y={z.y + 86} width={10} height={6} rx={2}
                fill="#0d1828" stroke="#1a3050" strokeWidth={0.8} />

              {/* hover tooltip */}
              {isHov && (
                <g>
                  <rect x={z.x + z.w/2 - 40} y={z.y - 36} width={80} height={30} rx={4}
                    fill="#0d1828" stroke={`${color}66`} strokeWidth={0.8} />
                  <text x={z.x + z.w/2} y={z.y - 22} textAnchor="middle"
                    fill={color} fontSize={9} fontFamily="'Share Tech Mono', monospace">
                    T:{data[z.id]?.temp?.toFixed(1)}° H:{data[z.id]?.humidity?.toFixed(0)}%
                  </text>
                  <text x={z.x + z.w/2} y={z.y - 11} textAnchor="middle"
                    fill="#4a6080" fontSize={8} fontFamily="'Share Tech Mono', monospace">
                    CO:{data[z.id]?.co} SMOKE:{data[z.id]?.smoke}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* gas sensor in hub area */}
        <SensorDot x={148} y={168} color="#ff8c42" label="MQ2/4/7" />

        {/* MQTT flow indicators */}
        {zones.map((z, i) => (
          <g key={`flow-${z.id}`}>
            <circle cx={z.x + z.w/2} cy={148 + (i % 2 === 0 ? 10 : 16)} r={2}
              fill="#1a4060" opacity={0.6}>
              <animate attributeName="opacity" values="0.6;0.1;0.6" dur={`${1.2 + i * 0.3}s`} repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </svg>

      {/* zone summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
        {zones.map(z => {
          const score = data[z.id]?.score || 0;
          const color = getRiskColor(score);
          return (
            <div key={z.id} style={{
              background: `${color}0d`,
              border: `1px solid ${color}33`,
              borderRadius: 8,
              padding: "6px 10px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              transition: "all 0.5s",
            }}>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color }}>
                {z.label}
              </span>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13,
                color, fontWeight: 700,
                textShadow: score >= 75 ? `0 0 8px ${color}` : "none" }}>
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}