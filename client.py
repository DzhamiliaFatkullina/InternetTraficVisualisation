import csv
import json
import time
import requests
from datetime import datetime

def send_packages(csv_file):
    with open(csv_file, 'r') as file:
        reader = csv.DictReader(file)
        packages = list(reader)
    
    processed_packages = []
    for package in packages:
        try:
            processed_packages.append({
                'ip': package['ip'],
                'latitude': float(package['latitude']),
                'longitude': float(package['longitude']),
                'timestamp': int(float(package['timestamp'])),
                'suspicious': int(float(package['suspicious']))
            })
        except (ValueError, KeyError) as e:
            print(f"Skipping invalid package: {package}. Error: {e}")
            continue
    
    if not processed_packages:
        print("No valid packages found")
        return
    
    # Sort packages by timestamp (oldest first)
    processed_packages.sort(key=lambda x: x['timestamp'])
    first_time = processed_packages[0]['timestamp']
    last_send_time = time.time()
    
    for package in processed_packages:
        # Calculate delay based on timestamp difference
        current_package_time = package['timestamp']
        delay = current_package_time - first_time - (time.time() - last_send_time)
        
        if delay > 0:
            time.sleep(delay)
        
        try:
            response = requests.post(
                'http://localhost:5000/api/packages',
                json=package
            )
            print(f"Sent package from {package['ip']} at {current_package_time}. Status: {response.status_code}")
            last_send_time = time.time()
        except requests.exceptions.RequestException as e:
            print(f"Failed to send package: {e}")

if __name__ == '__main__':
    send_packages('ip_addresses.csv')