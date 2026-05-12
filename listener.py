import paho.mqtt.client as mqtt
import json
import time
from contact_graph import ContactGraph
from collections import defaultdict
from datetime import datetime, timedelta

# Create the contact graph
graph = ContactGraph()

# Track current contacts (zone → people currently there)
current_zone_occupancy = defaultdict(set)
zone_contact_log = []

# MQTT Setup
BROKER = "localhost"
PORT = 1883
client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✓ Connected to MQTT broker")
        client.subscribe("icu/sensor/+")
        client.subscribe("icu/contact/+")
    else:
        print(f"✗ Connection failed: {rc}")

def on_message(client, userdata, msg):
    """Handle incoming MQTT messages"""
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode())
        
        if "sensor" in topic:
            handle_sensor_message(topic, payload)
        elif "contact" in topic:
            handle_contact_message(topic, payload)
    except Exception as e:
        print(f"Error processing message: {e}")

def handle_sensor_message(topic, data):
    """Process environmental sensor data"""
    zone = topic.split('/')[-1]
    pm25 = data.get('pm25', 30)
    temp = data.get('temperature', 22)
    humidity = data.get('humidity', 55)
    
    # Flag if PM2.5 is high (potential aerosolized transmission risk)
    if pm25 > 40:
        print(f"⚠️  HIGH_PM25 in {zone}: {pm25} µg/m³ at {datetime.now().strftime('%H:%M:%S')}")

def handle_contact_message(topic, data):
    """Process staff proximity (BLE) data"""
    zone = topic.split('/')[-1]
    beacon_id = data.get('beacon_id')
    rssi = data.get('rssi')
    duration = data.get('duration_sec', 60)
    
    # RSSI threshold: -65 dBm = within 2m (contact)
    if rssi > -65:
        current_zone_occupancy[zone].add(beacon_id)
        
        # When someone enters a zone, they might contact previous occupants
        if len(current_zone_occupancy[zone]) > 1:
            # Create edges between all people in same zone
            people = list(current_zone_occupancy[zone])
            for i in range(len(people) - 1):
                person_a = people[i]
                person_b = people[-1]  # newly arrived person
                
                # Estimate PM2.5 for that zone (you'd get real value from sensor)
                pm25 = 35  # default
                
                graph.add_contact(person_a, person_b, zone, 
                                time.time(), duration, pm25)
                
                print(f"📍 Contact logged: {person_a} ↔ {person_b} in {zone}")
    else:
        # Person left zone (RSSI dropped)
        current_zone_occupancy[zone].discard(beacon_id)

def analyze_graph():
    """Periodically analyze the contact graph for outbreaks"""
    while True:
        time.sleep(30)  # Analyze every 30 seconds
        
        if graph.G.number_of_nodes() > 2:
            print(f"\n Graph snapshot: {graph.G.number_of_nodes()} nodes, {graph.G.number_of_edges()} edges")

def simulate_contamination_alert(source_node):
    """
    Simulate receiving a positive culture result.
    Run all outbreak detection algorithms.
    """
    print(f"\n CONTAMINATION ALERT: {source_node} tested POSITIVE")
    print("=" * 60)
    
    results = graph.inject_contamination(source_node)
    
    print(f"\n Exposure Cluster (within 2 hops):")
    for node, hops in sorted(results['exposure_cluster'].items(), key=lambda x: x[1]):
        print(f"   {node} ({hops} hops away)")
    
    print(f"\n Transmission Chains:")
    if results['transmission_chains']:
        for target, chain in list(results['transmission_chains'].items())[:5]:  # show first 5
            print(f"   {' → '.join(chain)}")
    
    print(f"\n ISOLATE THESE ZONES:")
    for zone in results['isolation_zones']:
        print(f"     {zone}")
    
    print("=" * 60)

# Set up MQTT callbacks
client.on_connect = on_connect
client.on_message = on_message

# Connect and start listening
print("🔌 Starting MQTT listener...")
client.connect(BROKER, PORT, keepalive=60)
client.loop_start()

time.sleep(2)

# Demo: Wait for some data, then inject contamination
print("\n⏳ Listening for sensor/contact data...")
print("(Run simulator.py in another terminal)\n")

try:
    contamination_injected = False
    start_time = time.time()
    
    while True:
        # After 15 seconds, inject a contamination event for demo
        if time.time() - start_time > 15 and not contamination_injected:
            # Pick a random person to be the contamination source
            all_nodes = list(graph.G.nodes())
            if all_nodes:
                source = all_nodes[0]
                simulate_contamination_alert(source)
                contamination_injected = True
        
        time.sleep(1)

except KeyboardInterrupt:
    print("\n\n Listener stopped")
    client.loop_stop()
    client.disconnect()