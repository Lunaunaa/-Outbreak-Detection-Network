from contact_graph import ContactGraph
import time

# ═══════════════════════════════════════════════════════════
# HAI Environment Risk — Algorithm Test Suite
# Tests all 4 DAA algorithms with realistic ICU sensor values
#
# env_risk_score passed to add_contact() is computed from:
#   R = 0.35×norm(humidity) + 0.20×norm(temp) + 0.25×norm(CO) + 0.20×norm(smoke)
#   score = R × 100
#
# Sample values used below reflect real ICU HAI scenarios:
#   score=72 → humid ICU bay, elevated CO (poor ventilation)
#   score=55 → moderate risk corridor
#   score=38 → lower risk nurses station
# ═══════════════════════════════════════════════════════════

g = ContactGraph()

# ── Verify formula directly ──
print("=== HAI Risk Score Formula Verification ===")
# Scenario: humidity=75%, temp=33°C, mq2=800, mq7=900 → should be HIGH risk
score_test = g.compute_env_risk(humidity=75, temp=33, mq2=800, mq7=900)
print(f"Humidity=75%, Temp=33°C, CO=900, Smoke=800 → R={score_test} ({score_test*100:.1f}/100)")

score_safe = g.compute_env_risk(humidity=45, temp=22, mq2=100, mq7=100)
print(f"Humidity=45%, Temp=22°C, CO=100, Smoke=100 → R={score_safe} ({score_safe*100:.1f}/100)")

# ── Build contact graph with HAI-realistic risk scores ──
# Zone A (ICU Bay) — high humidity + poor ventilation → score ~72
# Zone B (ICU Bay) — moderate risk → score ~55
# Corridor — lower risk → score ~38

print("\n=== Building HAI Contact Graph ===")
t = time.time()

g.add_contact("Dr_Mehta",   "Patient_01", "zone_a",   t,        300, 72.0)
g.add_contact("Patient_01", "Nurse_Priya","zone_a",   t+600,    200, 72.0)
g.add_contact("Nurse_Priya","Patient_02", "zone_b",   t+1200,   150, 55.0)
g.add_contact("Dr_Singh",   "Patient_02", "zone_b",   t+1500,   100, 55.0)
g.add_contact("Patient_02", "Nurse_Raj",  "zone_c",   t+1800,    50, 38.0)

print(f"Graph: {g.G.number_of_nodes()} nodes, {g.G.number_of_edges()} edges")
print("Nodes (people):", list(g.G.nodes()))

# ── Algorithm 1: BFS Cluster Detection O(V+E) ──
print("\n=== Algorithm 1: BFS Cluster Detection  O(V+E) ===")
print("Scenario: High env risk detected in zone_a — who is exposed?")
cluster = g.bfs_cluster("Dr_Mehta", max_hops=2)
for person, hops in cluster.items():
    risk_label = "PRIMARY" if hops == 0 else ("DIRECT CONTACT" if hops == 1 else "SECONDARY EXPOSURE")
    print(f"   {person} — {hops} hop(s) [{risk_label}]")

# ── Algorithm 2: DP Transmission Chain O(VE) ──
print("\n=== Algorithm 2: DP Transmission Chain  O(VE) ===")
print("Scenario: Trace HAI spread path from Dr_Mehta to Patient_02")
chain = g.transmission_chain("Dr_Mehta", "Patient_02")
if chain:
    print("   Transmission path:", " → ".join(chain))
    print("   Interpretation: HAI most likely traveled this route")
else:
    print("   No direct path found")

print("\nAll paths from Dr_Mehta (shortest exposure dose):")
all_paths = g.transmission_chain("Dr_Mehta")
if all_paths:
    for target, path in all_paths.items():
        print(f"   → {target}: {' → '.join(path)}")

# ── Algorithm 3: KMP Pattern Matching O(n+m) ──
print("\n=== Algorithm 3: KMP Pattern Matching  O(n+m) ===")

# Inject some events into the stream to simulate a real timeline
g.events.append({"event_type": "HIGH_HUMIDITY", "time": t})
g.events.append({"event_type": "HIGH_TEMP",     "time": t+10})
g.events.append({"event_type": "CONTACT",       "time": t+20})
g.events.append({"event_type": "HIGH_CO",       "time": t+30})
g.events.append({"event_type": "CONTACT",       "time": t+40})
g.events.append({"event_type": "HIGH_HUMIDITY", "time": t+50})
g.events.append({"event_type": "HIGH_HUMIDITY", "time": t+60})
g.events.append({"event_type": "HIGH_TEMP",     "time": t+70})
g.events.append({"event_type": "CONTACT",       "time": t+80})

stream = [e["event_type"] for e in g.events if "event_type" in e]
print("Event stream:", stream)

# Test all 3 HAI outbreak patterns
patterns = {
    "Mold+Heat+Crowding"  : ["HIGH_HUMIDITY", "HIGH_TEMP",  "CONTACT"],
    "Poor Vent+Contact"   : ["HIGH_CO",       "CONTACT",    "HIGH_HUMIDITY"],
    "Sterile Breach"      : ["HIGH_SMOKE",    "CONTACT",    "CONTACT"],
}
for name, pattern in patterns.items():
    matches = g.kmp_pattern_match(pattern, stream)
    print(f"   Pattern '{name}': {matches if matches else 'no match'}")

# ── Algorithm 4: Greedy Isolation Zones O(n²) ──
print("\n=== Algorithm 4: Greedy Isolation Zones  O(n²) ===")
print("Scenario: HAI risk triggered — which zones must be sanitized?")
results = g.inject_contamination("Patient_01")

print("Exposure cluster (BFS):")
for person, hops in results["exposure_cluster"].items():
    print(f"   {person} — {hops} hop(s)")

print("Isolation zones (Greedy Set Cover):")
if results["isolation_zones"]:
    for z in results["isolation_zones"]:
        print(f"    ISOLATE/SANITIZE: {z}!!!")
else:
    print("   None flagged")

print("\nTransmission chains (DP):")
if results["transmission_chains"]:
    for target, path in results["transmission_chains"].items():
        print(f"   {' → '.join(path)}")

print("\n✓ All algorithm tests complete")