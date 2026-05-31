import networkx as nx
from datetime import datetime
import math

class ContactGraph:
    """
    Dynamic contact graph for ICU HAI (Hospital Acquired Infection)
    environment risk tracking and staff/patient exposure analysis.

    Graph model:
      Nodes  = people (staff / patients)
      Edges  = co-presence in a zone during a time window
      Weight = HAI Exposure Dose = duration_sec × env_risk_factor

    env_risk_factor derived from the weighted sensor risk score R ∈ [0,1]:
      R = 0.35×norm(humidity) + 0.20×norm(temp) + 0.25×norm(CO) + 0.20×norm(smoke)
      env_risk_factor = max(R, 0.1)   ← clamp so isolated zones still have weight

    Edge weight formula (Discrete Maths — weighted graph theory):
      W(u,v) = duration_sec × env_risk_factor
      Higher W = higher HAI transmission dose between u and v
    """

    # ── Normalization ranges (same as listener.py) ──
    NORM = {
        "humidity": (30, 90),
        "temp"    : (18, 40),
        "mq7"     : (0,  4095),
        "mq2"     : (0,  4095),
    }
    WEIGHTS = {
        "humidity": 0.35,
        "temp"    : 0.20,
        "co"      : 0.25,
        "smoke"   : 0.20,
    }

    def __init__(self):
        self.G = nx.DiGraph()
        self.events = []             # event log — used by KMP pattern matching
        self.contamination_time = None

    # ─────────────────────────────────────────────────────────
    # Internal: Min-Max normalization
    # ─────────────────────────────────────────────────────────
    @staticmethod
    def _normalize(value, lo, hi):
        return max(0.0, min(1.0, (value - lo) / (hi - lo)))

    # ─────────────────────────────────────────────────────────
    # HAI Risk Score — same formula as listener.py
    # Kept here so contact_graph can be used standalone in tests
    # ─────────────────────────────────────────────────────────
    def compute_env_risk(self, humidity, temp, mq2=0, mq7=0):
        """
        R = w1×norm(H) + w2×norm(T) + w3×norm(CO) + w4×norm(Smoke)
        Returns R ∈ [0.0, 1.0]
        """
        r = (
            self.WEIGHTS["humidity"] * self._normalize(humidity, *self.NORM["humidity"]) +
            self.WEIGHTS["temp"]     * self._normalize(temp,     *self.NORM["temp"])     +
            self.WEIGHTS["co"]       * self._normalize(mq7,      *self.NORM["mq7"])      +
            self.WEIGHTS["smoke"]    * self._normalize(mq2,      *self.NORM["mq2"])
        )
        return round(r, 4)

    # ─────────────────────────────────────────────────────────
    # Add contact edge
    # pm25 param kept for API compatibility — receives env_risk_score (0–100)
    # ─────────────────────────────────────────────────────────
    def add_contact(self, person_a, person_b, zone, timestamp, duration_sec, pm25):
        """
        Add a directed contact edge person_a → person_b.

        Edge weight = HAI Exposure Dose
          W = duration_sec × env_risk_factor
          env_risk_factor = max(env_risk_score / 35.0, 0.1)

        Dividing by 35 keeps weights on same scale as original formula
        (35 = WHO safe PM2.5 limit, reused as risk normalization anchor).
        Higher weight = higher infection transmission dose.
        """
        env_risk_factor = max(pm25 / 35.0, 0.1)
        weight = round(duration_sec * env_risk_factor, 3)

        self.G.add_edge(
            person_a, person_b,
            weight       = weight,
            zone         = zone,
            time         = timestamp,
            duration     = duration_sec,
            env_risk     = pm25,       # HAI risk score 0–100
        )

        # Append to event log with event_type for KMP stream
        self.events.append({
            'event_type' : 'CONTACT',
            'source'     : person_a,
            'target'     : person_b,
            'zone'       : zone,
            'time'       : timestamp,
            'duration'   : duration_sec,
            'env_risk'   : pm25,
            'weight'     : weight,
        })

    # ─────────────────────────────────────────────────────────
    # Algorithm 1: BFS Cluster Detection  O(V+E)
    # ─────────────────────────────────────────────────────────
    def bfs_cluster(self, source, max_hops=2):
        """
        BFS from source node up to max_hops.
        Finds all staff/patients exposed to the HAI risk source
        within 2 contact hops.

        Returns dict: { person: hop_distance }

        Complexity: O(V+E) where V=people, E=contact events
        """
        if source not in self.G:
            return {source: 0}

        visited = {source: 0}
        queue   = [(source, 0)]

        while queue:
            node, depth = queue.pop(0)
            if depth < max_hops:
                for neighbor in self.G.neighbors(node):
                    if neighbor not in visited:
                        visited[neighbor] = depth + 1
                        queue.append((neighbor, depth + 1))

        return visited

    # ─────────────────────────────────────────────────────────
    # Algorithm 2: DP Transmission Chain  O(VE)
    # ─────────────────────────────────────────────────────────
    def transmission_chain(self, source, target=None):
        """
        Dijkstra shortest path (DP-based) on the weighted contact graph.
        Finds the most likely HAI transmission route between people.

        Lower cumulative edge weight = more time spent in high-risk
        environment together = higher transmission probability.

        Complexity: O(VE) — Bellman-Ford bound (directed graph)
        Returns: path list (if target given) or dict of all paths from source
        """
        if source not in self.G:
            return None
        try:
            if target:
                return nx.shortest_path(self.G, source, target, weight='weight')
            else:
                return nx.single_source_dijkstra_path(self.G, source, weight='weight')
        except nx.NetworkXNoPath:
            return None

    # ─────────────────────────────────────────────────────────
    # Algorithm 3: KMP Pattern Matching  O(n+m)
    # ─────────────────────────────────────────────────────────
    def kmp_pattern_match(self, pattern, stream):
        """
        Knuth-Morris-Pratt string matching on event type sequences.
        Detects recurring HAI outbreak patterns in the sensor event log.

        HAI-relevant patterns (defined in listener.py):
          ["HIGH_HUMIDITY", "HIGH_TEMP",  "CONTACT"]  → mold+heat+crowding
          ["HIGH_CO",       "CONTACT",    "HIGH_HUMIDITY"] → poor vent during contact
          ["HIGH_SMOKE",    "CONTACT",    "CONTACT"]   → sterile breach + movement

        pattern : list of event_type strings
        stream  : list of event_type strings (from self.events)
        Returns : list of match start indices

        Complexity: O(n+m) where n=stream length, m=pattern length
        """
        def build_failure(pat):
            m       = len(pat)
            failure = [0] * m
            j       = 0
            for i in range(1, m):
                while j > 0 and pat[i] != pat[j]:
                    j = failure[j - 1]
                if pat[i] == pat[j]:
                    j += 1
                failure[i] = j
            return failure

        if not pattern or not stream:
            return []

        failure = build_failure(pattern)
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

    # ─────────────────────────────────────────────────────────
    # Algorithm 4: Greedy Isolation Zones  O(n²) approx
    # ─────────────────────────────────────────────────────────
    def greedy_isolation_zones(self, flagged_nodes):
        """
        Set Cover approximation (NP-hard, greedy gives ln(n) approximation).
        Finds minimum number of zones to sanitize/isolate that covers
        all flagged (exposed) people.

        Greedy strategy: repeatedly pick the zone that covers the most
        uncovered flagged nodes until all are covered.

        Complexity: O(n²) where n = number of flagged nodes
        """
        if not flagged_nodes:
            return []

        # Build zone → set of flagged people in that zone
        zone_coverage = {}
        for u, v, data in self.G.edges(data=True):
            zone = data['zone']
            if zone not in zone_coverage:
                zone_coverage[zone] = set()
            if u in flagged_nodes:
                zone_coverage[zone].add(u)
            if v in flagged_nodes:
                zone_coverage[zone].add(v)

        if not zone_coverage:
            return []

        selected_zones    = []
        covered           = set()
        remaining_flagged = set(flagged_nodes)

        while remaining_flagged and zone_coverage:
            best_zone = max(
                zone_coverage.items(),
                key=lambda x: len(x[1] - covered)
            )[0]
            selected_zones.append(best_zone)
            covered           |= zone_coverage[best_zone]
            remaining_flagged -= zone_coverage[best_zone]
            zone_coverage.pop(best_zone)

        return selected_zones

    # ─────────────────────────────────────────────────────────
    # HAI Risk Event — runs all 4 algorithms
    # ─────────────────────────────────────────────────────────
    def inject_contamination(self, source_node):
        """
        Triggered when env_risk_score >= 75 or gas threshold breached.
        Runs BFS → DP → Greedy → results returned to listener.py.
        KMP run separately in listener using self.events stream.
        """
        self.contamination_time = datetime.now()

        exposure_cluster    = self.bfs_cluster(source_node, max_hops=2)
        transmission_chains = self.transmission_chain(source_node)

        # Direct contacts (1 hop) = primary isolation candidates
        direct_contacts = self.bfs_cluster(source_node, max_hops=1)
        flagged         = set(direct_contacts.keys())
        isolation_zones = self.greedy_isolation_zones(flagged)

        return {
            'source'             : source_node,
            'timestamp'          : str(self.contamination_time),
            'exposure_cluster'   : exposure_cluster,
            'transmission_chains': transmission_chains,
            'isolation_zones'    : isolation_zones,
        }