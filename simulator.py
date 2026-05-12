import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime

# MQTT Setup
BROKER = "localhost"
PORT = 1883
client = mqtt.Client()

# ICU Configuration
ZONES = ["BedA", "BedB", "BedC", "Corridor", "NursesStation"]
STAFF = ["Dr_Mehta", "Nurse_Priya", "Nurse_Raj", "Dr_Singh"]
PATIENTS = ["Patient_01", "Patient_02", "Patient_03"]

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✓ Connected to MQTT broker")
    else:
        print(f"✗ Connection failed with code {rc}")

client.on_connect = on_connect
client.connect(BROKER, PORT, keepalive=60)
client.loop_start()

def publish_sensor_data(zone):
    """Publish environmental sensor reading"""
    data = {
        "zone": zone,
        "timestamp": time.time(),
        "pm25": round(random.gauss(32, 10), 1),  # realistic ICU air
        "temperature": round(random.gauss(22.5, 1), 1),
        "humidity": round(random.gauss(55, 5), 1)
    }
    client.publish(f"icu/sensor/{zone}", json.dumps(data))
    return data

def publish_contact_event(staff, zone):
    """Publish staff proximity event (BLE RSSI)"""
    data = {
        "beacon_id": staff,
        "zone": zone,
        "timestamp": time.time(),
        "rssi": random.randint(-75, -45),  # -65 dBm = ~2m distance
        "duration_sec": random.randint(60, 600),
        "event": "PROXIMITY"
    }
    client.publish(f"icu/contact/{zone}", json.dumps(data))
    return data

print("ICU IoT Simulator Started")
print("Publishing to MQTT topics: icu/sensor/* and icu/contact/*\n")

try:
    iteration = 0
    while True:
        iteration += 1
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        # Publish sensor data from all zones
        for zone in ZONES:
            sensor = publish_sensor_data(zone)
            print(f"[{timestamp}] Sensor {zone}: PM2.5={sensor['pm25']}, T={sensor['temperature']}°C")
        
        # Publish contact events (staff movement)
        if iteration % 3 == 0:  # Every 3 cycles
            staff = random.choice(STAFF)
            zone = random.choice(ZONES)
            contact = publish_contact_event(staff, zone)
            print(f"[{timestamp}] Contact: {staff} at {zone} (RSSI {contact['rssi']} dBm)")
        
        time.sleep(2)  # Publish every 2 seconds
        
except KeyboardInterrupt:
    print("\n\n Simulator stopped")
    client.loop_stop()
    client.disconnect()