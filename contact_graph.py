import networkx as nx
from datetime import datetime
import json

class ContactGraph:
    """Dynamic contact graph for ICU outbreak detection"""
    
    def __init__(self):
        self.G = nx.DiGraph()
        self.events = []
        self.contamination_time = None
    
    def add_contact(self, person_a, person_b, zone, timestamp, duration_sec, pm25):
        """
        Add a contact event to the graph.
        Edge weight = exposure dose = duration × (PM2.5 / 35)
        """
        # Transmission probability factor based on PM2.5
        pm25_factor = max(pm25 / 35.0, 0.1)  # clamp to min 0.1
        weight = round(duration_sec * pm25_factor, 3)
        
        self.G.add_edge(person_a, person_b,
                        weight=weight,
                        zone=zone,
                        time=timestamp,
                        duration=duration_sec,
                        pm25=pm25)
        
        self.events.append({
            'source': person_a,
            'target': person_b,
            'zone': zone,
            'time': timestamp,
            'duration': duration_sec,
            'pm25': pm25,
            'weight': weight
        })
    
    def bfs_cluster(self, source, max_hops=2):
        """
        Algorithm 1: BFS Cluster Detection (O(V+E))
        Find all nodes within max_hops from source.
        Use when contamination is detected.
        """
        visited = {source: 0}
        queue = [(source, 0)]
        
        while queue:
            node, depth = queue.pop(0)
            if depth < max_hops:
                for neighbor in self.G.neighbors(node):
                    if neighbor not in visited:
                        visited[neighbor] = depth + 1
                        queue.append((neighbor, depth + 1))
        
        return visited
    
    def transmission_chain(self, source, target=None):
        """
        Algorithm 2: DP Transmission Chain Reconstruction (O(VE))
        Uses Bellman-Ford to find most likely transmission path.
        Lower weight = higher probability (we use -log probability as cost).
        """
        try:
            if target:
                path = nx.shortest_path(self.G, source, target, weight='weight')
                return path
            else:
                # All shortest paths from source
                paths = nx.single_source_dijkstra_path(self.G, source, weight='weight')
                return paths
        except nx.NetworkXNoPath:
            return None
    
    def kmp_pattern_match(self, pattern, stream):
        """
        Algorithm 3: KMP Pattern Matching (O(n+m))
        Match sensor event patterns against known outbreak signatures.
        pattern: list of event types, e.g., ['HIGH_PM25', 'STAFF_ENTER', 'CONTACT']
        stream: list of actual events
        """
        def build_failure_function(pat):
            m = len(pat)
            failure = [0] * m
            j = 0
            for i in range(1, m):
                while j > 0 and pat[i] != pat[j]:
                    j = failure[j - 1]
                if pat[i] == pat[j]:
                    j += 1
                failure[i] = j
            return failure
        
        if not pattern or not stream:
            return []
        
        failure = build_failure_function(pattern)
        matches = []
        j = 0
        
        for i in range(len(stream)):
            while j > 0 and stream[i] != pattern[j]:
                j = failure[j - 1]
            if stream[i] == pattern[j]:
                j += 1
            if j == len(pattern):
                matches.append(i - len(pattern) + 1)
                j = failure[j - 1]
        
        return matches
    
    def greedy_isolation_zones(self, flagged_nodes):
        """
        Algorithm 4: Greedy Isolation Zone Selection (NP-hard approx, O(n²))
        Find minimum set of zones to isolate that covers all flagged nodes.
        Greedy: repeatedly pick zone covering most uncovered flagged nodes.
        """
        if not flagged_nodes:
            return []
        
        # Build zone → nodes map
        zone_coverage = {}
        for u, v, data in self.G.edges(data=True):
            zone = data['zone']
            if zone not in zone_coverage:
                zone_coverage[zone] = set()
            if u in flagged_nodes:
                zone_coverage[zone].add(u)
            if v in flagged_nodes:
                zone_coverage[zone].add(v)
        
        # Greedy selection
        selected_zones = []
        covered = set()
        remaining_flagged = flagged_nodes.copy()
        
        while remaining_flagged:
            # Pick zone that covers most uncovered flagged nodes
            best_zone = max(zone_coverage.items(), 
                          key=lambda x: len(x[1] - covered))[0]
            selected_zones.append(best_zone)
            covered |= zone_coverage[best_zone]
            remaining_flagged -= zone_coverage[best_zone]
            zone_coverage.pop(best_zone)
        
        return selected_zones
    
    def inject_contamination(self, source_node):
        """
        Simulate a contamination event at source_node.
        Run all algorithms and return results.
        """
        self.contamination_time = datetime.now()
        
        results = {
            'source': source_node,
            'timestamp': str(self.contamination_time),
            'exposure_cluster': self.bfs_cluster(source_node, max_hops=2),
            'transmission_chains': self.transmission_chain(source_node),
            'isolation_zones': []
        }
        
        # Find high-risk nodes (within 1 hop = direct contact)
        direct_contacts = self.bfs_cluster(source_node, max_hops=1)
        if direct_contacts:
            flagged = set(direct_contacts.keys())
            results['isolation_zones'] = self.greedy_isolation_zones(flagged)
        
        return results