from flask import Flask, request, jsonify, render_template
from collections import deque, defaultdict
from datetime import datetime
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
from functools import lru_cache

app = Flask(__name__)

# Configuration
MAX_PACKAGE_STORAGE = 1000
REQUIRED_KEYS = ['ip', 'latitude', 'longitude', 'timestamp', 'suspicious']
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# Data storage
received_packages = deque(maxlen=MAX_PACKAGE_STORAGE)

# Geocoding setup with English language
geolocator = Nominatim(user_agent="network_package_tracker", timeout=10)
geocode = RateLimiter(geolocator.reverse, min_delay_seconds=1)

@lru_cache(maxsize=1000)
def get_country(lat, lon):
    try:
        location = geocode(f"{lat}, {lon}", exactly_one=True, language='en')
        return location.raw.get('address', {}).get('country', 'Unknown')
    except Exception:
        return "Unknown"

@app.route('/api/packages', methods=['POST'])
def receive_package():
    package = request.get_json()
    
    if not all(key in package for key in REQUIRED_KEYS):
        return jsonify({'error': 'Invalid package format'}), 400
    
    try:
        package['country'] = get_country(package['latitude'], package['longitude'])
        package['human_time'] = datetime.fromtimestamp(package['timestamp']).strftime(DATE_FORMAT)
        received_packages.append(package)
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/packages', methods=['GET'])
def get_packages():
    return jsonify(list(received_packages))

@app.route('/stats')
def get_stats():
    country_stats = defaultdict(lambda: {'total': 0, 'suspicious': 0, 'normal': 0})
    total_packages = len(received_packages)
    suspicious_count = 0
    
    for p in received_packages:
        country_stats[p['country']]['total'] += 1
        if p['suspicious']:
            country_stats[p['country']]['suspicious'] += 1
            suspicious_count += 1
        else:
            country_stats[p['country']]['normal'] += 1
    
    stats = [{
        'country': country,
        'total': data['total'],
        'suspicious': data['suspicious'],
        'normal': data['normal'],
        'suspicious_percent': round((data['suspicious'] / data['total']) * 100, 2) if data['total'] > 0 else 0
    } for country, data in country_stats.items()]
    
    return jsonify({
        'total_packages': total_packages,
        'suspicious_count': suspicious_count,
        'country_stats': sorted(stats, key=lambda x: x['suspicious'], reverse=True)[:10],
        'top_countries': sorted(country_stats.items(), key=lambda x: x[1]['total'], reverse=True)[:5]
    })

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)