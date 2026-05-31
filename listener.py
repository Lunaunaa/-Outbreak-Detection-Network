import paho.mqtt.client as mqtt
import json
import time
from datetime import datetime
from contact_graph import ContactGraph

# ================= CONFIG =================
BROKER = "localhost"
PORT   = 1883

# ── Gas thresholds (raw ADC 0–4095 from ESP32) ──
THRESHOLDS = {
    "mq2": 1500,   # Smoke — sterile environment compromise
    "mq4": 1800,   # Methane — sanitation failure indicator
    "mq7": 800,    # CO — poor ventilation (primary HAI driver)
}

# ── DHT thresholds (HAI-specific, based on WHO ICU guidelines) ──
HUMIDITY_MOLD_RISK    = 60   # % — above this, mold/fungal growth accelerates
HUMIDITY_HIGH_RISK    = 70   # % — above this, bacterial survival rate spikes
TEMP_PATHOGEN_OPTIMAL = 30   # °C — warm zone, pathogens reproduce faster
TEMP_HIGH_ALERT       = 34   # °C — critical thermal stress + infection risk

# ── Min-Max normalization ranges for risk score formula ──
NORM = {
    "humidity": (30, 90),    # % expected ICU range
    "temp"    : (18, 40),    # °C expected ICU range
    "mq7"     : (0,  4095),  # CO raw ADC
    "mq2"     : (0,  4095),  # Smoke raw ADC
}

# ── Risk score weights (must sum to 1.0) ──
# Humidity weighted highest — strongest HAI environmental predictor
WEIGHTS = {
    "humidity": 0.35,
    "temp"    : 0.20,
    "co"      : 0.25,   # MQ7
    "smoke"   : 0.20,   # MQ2
}

# ================= STATE =================
graph = ContactGraph()

# Latest gas readings — updated on every icu/sensor/gas message
latest_gas = {"mq2": 0, "mq4": 0, "mq7": 0}

# Demo staff presence — hardcoded so graph has edges from first alert
# BLE beacon moves ER_Beacon on top of these in real time
zone_presence = {
    "zone_a": ["Dr_Mehta", "Patient_01"],
    "zone_b": ["Nurse_Priya", "Patient_02"],
    "zone_c": ["Dr_Singh"],
}

contamination_triggered = False


# ================= HAI RISK SCORE FORMULA =================
# R = w1×norm(humidity) + w2×norm(temp) + w3×norm(CO) + w4×norm(smoke)
# norm(x) = (x - min) / (max - min)   ← Min-Max normalization
# R ∈ [0.0, 1.0]  multiplied ×100 → readable 0–100 score
# Higher R = higher Hospital Acquired Infection environment risk

def normalize(value, key):
    lo, hi = NORM[key]
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))

def compute_hai_risk_score(temp, humidity, mq2, mq7):
    """
    Discrete Maths — weighted linear combination with Min-Max normalization.
    Returns env_risk_score in range [0, 100].
    """
    r = (
        WEIGHTS["humidity"] * normalize(humidity, "humidity") +
        WEIGHTS["temp"]     * normalize(temp,     "temp")     +
        WEIGHTS["co"]       * normalize(mq7,      "mq7")      +
        WEIGHTS["smoke"]    * normalize(mq2,      "mq2")
    )
    return round(r * 100, 2)


# ================= HAI RISK INTERPRETATION =================
def interpret_risk(score):
    if score >= 75:
        return " CRITICAL — Immediate HAI outbreak risk"
    elif score >= 55:
        return " HIGH    — Elevated infection environment"
    elif score >= 35:
        return " MODERATE — Monitor closely"
    else:
        return " LOW     — Environment within safe range"


# ================= SPECIFIC HAI ALERTS =================
def hai_alerts(temp, humidity, mq2, mq4, mq7, zone):
    """
    Prints specific HAI-relevant warnings based on individual sensor readings.
    Each alert maps to a real clinical risk.
    """
    alerts = []

    # Humidity — primary driver of mold, fungal, and bacterial HAI
    if humidity > HUMIDITY_HIGH_RISK:
        alerts.append("  CRITICAL HUMIDITY — High bacterial & fungal survival rate (HAI risk)")
    elif humidity > HUMIDITY_MOLD_RISK:
        alerts.append("  MOLD RISK ZONE — Humidity favors Aspergillus & Candida growth")

    # Temperature — pathogen reproduction rate increases exponentially above 30°C
    if temp > TEMP_HIGH_ALERT:
        alerts.append("  CRITICAL TEMP — Rapid pathogen reproduction zone")
    elif temp > TEMP_PATHOGEN_OPTIMAL:
        alerts.append("  WARM ZONE — Above optimal pathogen growth threshold (30°C)")

    # CO (MQ7) — ventilation quality, primary HAI spread mechanism
    if mq7 > THRESHOLDS["mq7"]:
        alerts.append("  POOR VENTILATION — High CO indicates inadequate air exchange (HAI spreads via aerosol)")

    # Smoke/VOC (MQ2) — sterile environment compromise
    if mq2 > THRESHOLDS["mq2"]:
        alerts.append("  STERILE ENVIRONMENT BREACH — Smoke/VOC detected in ICU zone")

    # Methane (MQ4) — sanitation failure
    if mq4 > THRESHOLDS["mq4"]:
        alerts.append("  SANITATION FAILURE — Methane spike indicates decomposition or drain issue")

    # Combined condition — most dangerous HAI scenario
    if humidity > HUMIDITY_MOLD_RISK and mq7 > THRESHOLDS["mq7"]:
        alerts.append("COMPOUND RISK — High humidity + poor ventilation = highest HAI probability")

    for a in alerts:
        print(f"   {a} [{zone}]")

    return alerts


# ================= CONTACT EDGE BUILDER =================
def build_contact_edges(zone, env_risk_score, timestamp):
    """
    Adds graph edges between all people co-present in a zone.
    Edge weight = duration × env_risk_score / 35 (DAA — feeds DP + BFS)
    """
    people = zone_presence.get(zone, [])
    if len(people) < 2:
        return
    for i in range(len(people)):
        for j in range(i + 1, len(people)):
            graph.add_contact(
                person_a     = people[i],
                person_b     = people[j],
                zone         = zone,
                timestamp    = timestamp,
                duration_sec = 120,
                pm25         = env_risk_score
            )
            print(f"   📎 Contact edge: {people[i]} ↔ {people[j]} (risk={env_risk_score}, zone={zone})")


# ================= ALGORITHM RUNNER =================
def run_algorithms(trigger_node, env_risk_score):
    global contamination_triggered
    contamination_triggered = True

    print("\n" + "="*55)
    print(" HIGH RISK EVENT — ALGORITHMS TRIGGERED")
    print(f"   Source node     : {trigger_node}")
    print(f"   Env Risk Score  : {env_risk_score}/100")
    print(f"   Time            : {datetime.now().strftime('%H:%M:%S')}")
    print("="*55)

    results = graph.inject_contamination(trigger_node)

    # Algorithm 1 — BFS O(V+E)
    print("\n[BFS — Exposure Cluster Detection  O(V+E)]")
    for node, hops in results["exposure_cluster"].items():
        print(f"   {node} — {hops} hop(s) from source")

    # Algorithm 2 — DP / Dijkstra O(VE)
    print("\n[DP — HAI Transmission Chain  O(VE)]")
    chains = results["transmission_chains"]
    if chains:
        for target, path in chains.items():
            print(f"   {' → '.join(path)}")
    else:
        print("   No chain data yet")

    # Algorithm 4 — Greedy Set Cover O(n²)
    print("\n[Greedy — Minimum Isolation Zones  O(n²)]")
    zones = results["isolation_zones"]
    print(f"   Sanitize/Isolate: {', '.join(zones) if zones else 'none flagged yet'}")

    # Algorithm 3 — KMP Pattern Matching O(n+m)
    print("\n[KMP — HAI Outbreak Pattern Matching  O(n+m)]")
    stream = [e["event_type"] for e in graph.events if "event_type" in e]

    patterns = {
        "Mold+Heat+Crowding"     : ["HIGH_HUMIDITY", "HIGH_TEMP",     "CONTACT"],
        "Poor Vent+Contact"      : ["HIGH_CO",       "CONTACT",       "HIGH_HUMIDITY"],
        "Sterile Breach+Movement": ["HIGH_SMOKE",    "CONTACT",       "CONTACT"],
    }
    for name, pattern in patterns.items():
        matches = graph.kmp_pattern_match(pattern, stream)
        status  = f"MATCHED at {matches}" if matches else "no match yet"
        print(f"   {name}: {status}")

    print("="*55 + "\n")


# ================= MQTT CALLBACKS =================
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("\n✓ Connected to MQTT Broker")
        client.subscribe("icu/sensor/#")
        client.subscribe("icu/contact/#")
        print("✓ Subscribed: icu/sensor/# | icu/contact/#")
    else:
        print(f"✗ MQTT Connection Failed: rc={rc}")


def on_message(client, userdata, msg):
    global latest_gas, contamination_triggered

    try:
        topic    = msg.topic
        data     = json.loads(msg.payload.decode())
        parts    = topic.split("/")
        category = parts[1]   # sensor / contact
        zone     = parts[2]   # zone_a / zone_b / zone_c / gas

        timestamp = time.time()

        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] {topic}")

        # ============ GAS SENSORS (icu/sensor/gas) ============
        if zone == "gas":
            mq2 = data.get("mq2", 0)
            mq4 = data.get("mq4", 0)
            mq7 = data.get("mq7", 0)
            latest_gas = {"mq2": mq2, "mq4": mq4, "mq7": mq7}

            print(f"   MQ2 (Smoke/VOC)   : {mq2}")
            print(f"   MQ4 (Methane)     : {mq4}")
            print(f"   MQ7 (CO/Ventil.)  : {mq7}")

            # Gas-only alerts
            if mq2 > THRESHOLDS["mq2"]:
                print("     STERILE BREACH — Smoke/VOC in ICU")
                graph.events.append({"event_type": "HIGH_SMOKE", "time": timestamp})

            if mq7 > THRESHOLDS["mq7"]:
                print("     POOR VENTILATION — CO elevated, aerosol HAI risk")
                graph.events.append({"event_type": "HIGH_CO", "time": timestamp})

            if mq4 > THRESHOLDS["mq4"]:
                print("     SANITATION FAILURE — Methane spike detected")

            # Trigger algorithms if any gas alert fires
            any_gas_alert = (mq2 > THRESHOLDS["mq2"] or mq7 > THRESHOLDS["mq7"])
            if any_gas_alert and not contamination_triggered:
                busiest = max(zone_presence, key=lambda z: len(zone_presence[z]))
                people  = zone_presence[busiest]
                if people:
                    # Compute risk using latest DHT from state if available
                    score = compute_hai_risk_score(25, 55, mq2, mq7)  # fallback temp/humidity
                    run_algorithms(people[0], score)

        # ============ DHT ZONES (icu/sensor/zone_a/b/c) ============
        elif category == "sensor":
            temp     = data.get("temperature", 0)
            humidity = data.get("humidity", 0)
            mq2      = latest_gas.get("mq2", 0)
            mq7      = latest_gas.get("mq7", 0)

            # ── Compute HAI Risk Score (Discrete Maths formula) ──
            score = compute_hai_risk_score(temp, humidity, mq2, mq7)

            print(f"   Zone          : {zone}")
            print(f"   Temp          : {temp} °C")
            print(f"   Humidity      : {humidity} %")
            print(f"   HAI Risk Score: {score}/100  {interpret_risk(score)}")

            # Specific HAI alerts
            mq4 = latest_gas.get("mq4", 0)
            alerts = hai_alerts(temp, humidity, mq2, mq4, mq7, zone)

            # Log event types for KMP
            if humidity > HUMIDITY_MOLD_RISK:
                graph.events.append({"event_type": "HIGH_HUMIDITY", "time": timestamp})
            if temp > TEMP_PATHOGEN_OPTIMAL:
                graph.events.append({"event_type": "HIGH_TEMP", "time": timestamp})

            # Build contact graph edges weighted by risk score
            build_contact_edges(zone, score, timestamp)

            # Trigger algorithms on compound risk
            if score >= 75 and not contamination_triggered:
                busiest = max(zone_presence, key=lambda z: len(zone_presence[z]))
                people  = zone_presence[busiest]
                if people:
                    run_algorithms(people[0], score)

        # ============ BLE CONTACT (icu/contact/zone_x) ============
        elif category == "contact":
            beacon_id = data.get("beacon_id", "Unknown")
            rssi      = data.get("rssi", -99)

            print(f"   BLE Beacon : {beacon_id}")
            print(f"   RSSI       : {rssi} dBm")

            # Move beacon to new zone
            for z in zone_presence:
                if beacon_id in zone_presence[z]:
                    zone_presence[z].remove(beacon_id)
            if zone in zone_presence:
                zone_presence[zone].append(beacon_id)
                print(f"   📍 {beacon_id} moved to {zone}")

            graph.events.append({"event_type": "CONTACT", "time": timestamp, "who": beacon_id, "zone": zone})
            print(f"   Zone presence: {zone_presence}")

    except Exception as e:
        print(f"ERROR: {e}")


# ================= MAIN =================
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

print("🏥 HAI Environment Risk Monitor Starting...")
print(f"   Broker     : {BROKER}:{PORT}")
print(f"   Thresholds : Humidity>{HUMIDITY_MOLD_RISK}% | Temp>{TEMP_PATHOGEN_OPTIMAL}°C | CO>{THRESHOLDS['mq7']} | Smoke>{THRESHOLDS['mq2']}")
print(f"   Risk Formula: R = 0.35×norm(H) + 0.20×norm(T) + 0.25×norm(CO) + 0.20×norm(Smoke)")

client.connect(BROKER, PORT, 60)
client.loop_forever()