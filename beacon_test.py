import asyncio
from bleak import BleakScanner

TARGET_MAC = "EA:26:53:F0:00:01"

def get_zone(rssi):

    if rssi >= -41:
        return "zone_a"

    elif rssi >= -46:
        return "zone_b"

    else:
        return "zone_c"


async def scan():

    print("Scanning beacon...\n")

    while True:

        devices = await BleakScanner.discover(return_adv=True)

        found = False

        for address, (device, adv) in devices.items():

            if address.upper() == TARGET_MAC:

                found = True

                rssi = adv.rssi
                zone = get_zone(rssi)

                print(
                    f"Beacon={device.name} | "
                    f"RSSI={rssi} | "
                    f"Zone={zone}"
                )

        if not found:
            print("Beacon not detected")

        await asyncio.sleep(1)

asyncio.run(scan())