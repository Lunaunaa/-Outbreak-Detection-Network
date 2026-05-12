from contact_graph import ContactGraph
import time

# Create graph
g = ContactGraph()

# Add sample contacts (simulated ICU data)
g.add_contact("Dr_Mehta", "Patient_01", "BedA", time.time(), 300, 42.0)
g.add_contact("Patient_01", "Nurse_Priya", "BedA", time.time() + 600, 200, 42.0)
g.add_contact("Nurse_Priya", "Patient_02", "BedB", time.time() + 1200, 150, 35.0)
g.add_contact("Dr_Singh", "Patient_02", "BedB", time.time() + 1500, 100, 35.0)
g.add_contact("Patient_02", "Nurse_Raj", "Corridor", time.time() + 1800, 50, 28.0)

print("Graph created with", g.G.number_of_nodes(), "nodes and", g.G.number_of_edges(), "edges")

# Test BFS
print("\n=== BFS Cluster Detection ===")
cluster = g.bfs_cluster("Dr_Mehta", max_hops=2)
print("Exposed nodes from Dr_Mehta:", cluster)

# Test transmission chain
print("\n=== Transmission Chain ===")
chain = g.transmission_chain("Dr_Mehta", "Patient_02")
print("Chain from Dr_Mehta to Patient_02:", chain)

# Test contamination injection
print("\n=== Contamination Injection ===")
results = g.inject_contamination("Patient_01")
print("Exposure cluster:", results['exposure_cluster'])
print("Isolation zones:", results['isolation_zones'])

# Test KMP pattern matching
print("\n=== KMP Pattern Matching ===")
signature = ["HIGH_PM25", "STAFF_ENTER", "CONTACT"]
stream = ["LOW_PM25", "STAFF_ENTER", "HIGH_PM25", "STAFF_ENTER", "CONTACT"]
matches = g.kmp_pattern_match(signature, stream)
print("Pattern matches at positions:", matches)