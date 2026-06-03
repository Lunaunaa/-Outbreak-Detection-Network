// useMqtt.js — WebSocket bridge to RPi
// Connects to bridge.js running on your Raspberry Pi
// Replace RPI_IP with your actual RPi IP (run `hostname -I` on RPi)

import { useState, useEffect, useRef, useCallback } from "react";

const RPI_IP = "10.90.115.80";
const WS_URL = `ws://${RPI_IP}:8080`;

// HAI Risk Formula: R = 0.35×norm(hum) + 0.20×norm(temp) + 0.25×norm(CO) + 0.20×norm(smoke)
function computeScore({ temp = 25, humidity = 50, co = 0, smoke = 0 }) {
  const normH = Math.min(humidity / 100, 1);
  const normT = Math.min((temp - 20) / 20, 1);
  const normC = Math.min(co / 4000, 1);
  const normS = Math.min(smoke / 4000, 1);

  return Math.round(
    (
      0.35 * normH +
      0.20 * normT +
      0.25 * normC +
      0.20 * normS
    ) * 100
  );
}

const DEFAULT_ZONE = { temp: 0, humidity: 0, co: 0, smoke: 0, rssi: null, score: 0, beacon: false };

const INITIAL = {
  zone_a: { ...DEFAULT_ZONE },
  zone_b: { ...DEFAULT_ZONE },
  zone_c: { ...DEFAULT_ZONE },
};

export function useMqtt() {
  const [data, setData]               = useState(INITIAL);
  const [alerts, setAlerts]           = useState([]);
  const [graphResults, setGraphResults] = useState(null);
  const [beaconHistory, setBeaconHistory] = useState([]);
  const [status, setStatus]           = useState("CONNECTING"); // CONNECTING | LIVE | DISCONNECTED
  const wsRef                         = useRef(null);
  const prevScores                    = useRef({ zone_a: 0, zone_b: 0, zone_c: 0 });

  const handleMessage = useCallback((raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const { topic, data: payload } = msg;
    let parsed;
    try { parsed = JSON.parse(payload); } catch { return; }

    setData((prev) => {
      const next = { ...prev };

      // ── DHT sensor readings ──────────────────────────────────────────────
      // Topic: icu/sensor/zone_a  →  { temp, humidity }
      if (topic.match(/^icu\/sensor\/zone_[abc]$/)) {
        const zone = topic.split("/")[2];                   // "zone_a" etc.
        const updated = {
          ...next[zone],
          temp:     parsed.temperature ?? parsed.temp ?? next[zone].temp,
          humidity: parsed.humidity    ?? next[zone].humidity,
        };
        updated.score = computeScore(updated);
        next[zone] = updated;
      }

      // ── Gas sensor readings ──────────────────────────────────────────────
      // Topic: icu/sensor/gas  →  { mq2, mq4, mq7 }
      // mq2=smoke, mq7=CO — broadcast to all zones (single sensor set)
      // NEW — each sensor goes to its own zone only
if (topic === "icu/sensor/gas") {

  // Zone A = MQ2
  next.zone_a = {
    ...next.zone_a,
    smoke: parsed.mq2 ?? next.zone_a.smoke,
  };
  next.zone_a.score = computeScore(next.zone_a);

  // Zone B = MQ4
  next.zone_b = {
    ...next.zone_b,
    co: parsed.mq4 ?? next.zone_b.co,
  };
  next.zone_b.score = computeScore(next.zone_b);

  // Zone C = MQ7
  next.zone_c = {
    ...next.zone_c,
    co: parsed.mq7 ?? next.zone_c.co,
  };
  next.zone_c.score = computeScore(next.zone_c);
}
      // ── BLE contact events ──────────────────────────────────────────────────────
      if (topic.match(/^icu\/contact\/zone_[abc]$/)) {
        const zone = topic.split("/")[2];
        const newEntry = {
          zone,
          rssi:   parsed.rssi ?? null,
          who:    parsed.beacon_id ?? "beacon",
          time:   new Date().toLocaleTimeString("en-IN", { hour12: false }),
       };

       // update zone beacon flag
       next[zone] = { ...next[zone], beacon: true, rssi: parsed.rssi ?? next[zone].rssi };

      // add to beacon history immediately (don't wait for listener.py)
      setBeaconHistory(h => [...h.slice(-20), newEntry]);

      // clear beacon flag after 5s
      setTimeout(() => {
        setData(d => ({ ...d, [zone]: { ...d[zone], beacon: false } }));
      }, 5000);
   }

      // ── Risk summary from listener.py ────────────────────────────────────
      // Topic: icu/risk/zone_x  →  { zone, risk_score, alert, algorithms }
      if (topic.match(/^icu\/risk\/zone_[abc]$/)) {
        const zone = topic.split("/")[2];
        next[zone] = {
          ...next[zone],
          score: parsed.risk_score ?? next[zone].score,
        };

        if (parsed.alert && parsed.algorithms) {
          setGraphResults(parsed.algorithms);
        }
        if (parsed.beacon_history) {
          setBeaconHistory(parsed.beacon_history);
        }
      }

      // ── Check for new critical alerts ────────────────────────────────────
      Object.keys(next).forEach((zone) => {
        const score = next[zone].score;
        if (score >= 75 && prevScores.current[zone] < 75) {
          setAlerts((a) => [
            { zone, score, time: new Date().toLocaleTimeString() },
            ...a,
          ].slice(0, 6));
        }
        prevScores.current[zone] = score;
      });

      return next;
    });
  }, []);

  useEffect(() => {
    let reconnectTimer;

    function connect() {
      setStatus("CONNECTING");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[MQTT bridge] connected");
        setStatus("LIVE");
      };

      ws.onmessage = (e) => { console.log("[WS RAW]", e.data); handleMessage(e.data); };

      ws.onclose = () => {
        console.warn("[MQTT bridge] disconnected — retrying in 3s");
        setStatus("DISCONNECTED");
        reconnectTimer = setTimeout(connect, 3000);   // auto-reconnect
      };

      ws.onerror = (e) => {
        console.error("[MQTT bridge] error", e);
        ws.close();
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [handleMessage]);

  return { data, alerts, graphResults, beaconHistory, status };
}