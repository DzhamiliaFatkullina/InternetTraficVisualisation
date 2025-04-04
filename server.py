from flask import Flask, request, jsonify, render_template
from collections import deque, defaultdict
from datetime import datetime
import time

app = Flask(__name__)

# Constants
MAX_PACKAGE_STORAGE = 1000
REQUIRED_PACKAGE_KEYS = ['ip', 'latitude', 'longitude', 'timestamp', 'suspicious']
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# In-memory storage for received packages
received_packages = deque(maxlen=MAX_PACKAGE_STORAGE)


@app.route('/api/packages', methods=['POST'])
def receive_package():
    """
    Endpoint to receive and store packages from clients.
    
    Expected JSON format:
    {
        "ip": str,
        "latitude": float,
        "longitude": float,
        "timestamp": float (unix timestamp),
        "suspicious": bool
    }
    
    Returns:
        - 200 with success status if package is valid
        - 400 with error message if package is invalid
    """
    package = request.get_json()
    
    if not is_valid_package(package):
        return jsonify({'error': 'Invalid package format'}), 400
    
    try:
        enriched_package = enrich_package_data(package)
        store_package(enriched_package)
        
        print(f"Received package from {enriched_package['ip']} "
              f"at {enriched_package['human_time']}")
              
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/packages', methods=['GET'])
def get_packages():
    """Endpoint to retrieve all stored packages"""
    return jsonify(list(received_packages))


@app.route('/')
def index():
    """Serve the main dashboard page"""
    return render_template('index.html')


@app.route('/stats')
def get_stats():
    """Endpoint to retrieve statistics about received packages"""
    stats = {
        'total_packages': len(received_packages),
        'suspicious_count': count_suspicious_packages(),
        'top_locations': get_top_locations(),
        'activity_by_hour': get_activity_by_hour()
    }
    return jsonify(stats)


def is_valid_package(package):
    """Validate that the package contains all required fields"""
    return all(key in package for key in REQUIRED_PACKAGE_KEYS)


def enrich_package_data(package):
    """Add additional processed data to the package"""
    enriched = package.copy()
    enriched['human_time'] = datetime.fromtimestamp(
        package['timestamp']
    ).strftime(DATE_FORMAT)
    return enriched


def store_package(package):
    """Store the package in memory"""
    received_packages.append(package)


def count_suspicious_packages():
    """Count how many packages were marked as suspicious"""
    return sum(1 for package in received_packages if package['suspicious'])


def get_top_locations(max_locations=5):
    """
    Get most frequent locations
    
    Args:
        max_locations: Number of top locations to return
        
    Returns:
        List of tuples containing ((lat, long), count) sorted by count
    """
    location_counts = defaultdict(int)
    
    for package in received_packages:
        # Round coordinates to group nearby locations
        loc_key = (
            round(package['latitude'], 2), 
            round(package['longitude'], 2))
        location_counts[loc_key] += 1
    
    return sorted(
        location_counts.items(), 
        key=lambda x: x[1], 
        reverse=True
    )[:max_locations]


def get_activity_by_hour():
    """Get package counts grouped by hour of day (0-23)"""
    hourly_activity = [0] * 24
    
    for package in received_packages:
        hour = datetime.fromtimestamp(package['timestamp']).hour
        hourly_activity[hour] += 1
        
    return hourly_activity

# Add these new endpoints to your existing Flask app

@app.route('/api/map_data')
def get_map_data():
    """Endpoint to get data optimized for map visualization"""
    map_data = {
        'points': [],
        'heatmap_data': [],
        'location_clusters': []
    }
    
    for package in received_packages:
        map_data['points'].append({
            'lat': package['latitude'],
            'lng': package['longitude'],
            'ip': package['ip'],
            'time': package['human_time'],
            'suspicious': package['suspicious']
        })
        map_data['heatmap_data'].append([package['latitude'], package['longitude'], 1])
    
    # Add clustering information for dense areas
    map_data['location_clusters'] = get_location_clusters()
    
    return jsonify(map_data)

@app.route('/api/activity_data')
def get_activity_data():
    """Endpoint to get data for time-based activity visualization"""
    return jsonify({
        'hourly_activity': get_activity_by_hour(),
        'daily_activity': get_activity_by_day()
    })

def get_location_clusters(radius_km=50):
    """
    Identify clusters of locations within a given radius
    Returns list of clusters with center coordinates and count
    """
    from geopy.distance import great_circle
    
    locations = [(p['latitude'], p['longitude']) for p in received_packages]
    clusters = []
    
    while locations:
        loc = locations.pop()
        cluster = {
            'center': loc,
            'count': 1,
            'points': [loc]
        }
        
        i = 0
        while i < len(locations):
            if great_circle(loc, locations[i]).km <= radius_km:
                cluster['points'].append(locations.pop(i))
                cluster['count'] += 1
                # Update center to be centroid of all points
                cluster['center'] = (
                    sum(p[0] for p in cluster['points']) / cluster['count'],
                    sum(p[1] for p in cluster['points']) / cluster['count']
                )
            else:
                i += 1
                
        clusters.append(cluster)
    
    return sorted(clusters, key=lambda x: x['count'], reverse=True)

def get_activity_by_day():
    """Get package count by day of week (0-6 where 0 is Monday)"""
    activity = [0] * 7
    for p in received_packages:
        day = datetime.fromtimestamp(p['timestamp']).weekday()
        activity[day] += 1
    return activity

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)