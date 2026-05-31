class ZoneModel:

    def __init__(self):

        self.risk = {
            "zone_a": 0,
            "zone_b": 0,
            "zone_c": 0
        }

        self.connections = {
            "zone_a": ["zone_b"],
            "zone_b": ["zone_a", "zone_c"],
            "zone_c": ["zone_b"]
        }

    def update_zone_risk(self, zone, risk):

        self.risk[zone] = risk

    def propagate_risk(self, source_zone):

        source_risk = self.risk[source_zone]

        for neighbor in self.connections[source_zone]:

            propagated = source_risk * 0.30

            self.risk[neighbor] += propagated

            print(
                f"Risk propagated "
                f"{source_zone} -> {neighbor} "
                f"(+{propagated:.2f})"
            )

    def show_risks(self):

        print("\nCurrent Risk Levels")

        for zone, risk in self.risk.items():

            print(zone, round(risk, 2))
