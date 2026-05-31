from zone_model import ZoneModel

z = ZoneModel()

z.update_zone_risk("zone_a", 80)

z.propagate_risk("zone_a")

z.show_risks()