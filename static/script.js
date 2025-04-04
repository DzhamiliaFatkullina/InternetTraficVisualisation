// Map visualization with Leaflet.js
let map;
let markers = [];
let markerCluster;
let currentTimeFilter = 0;
let statsInterval, updateInterval;
let activityChart;
let useClusters = true;

// Initialize the map
function initMap() {
    // Create map centered on the world
    map = L.map('map-container').setView([20, 0], 2);
    
    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Initialize marker cluster group
    markerCluster = L.markerClusterGroup({
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        // Custom cluster icons
        iconCreateFunction: function (cluster) {
            const childCount = cluster.getChildCount();
            let size = 'small';
            if (childCount > 100) {
                size = 'large';
            } else if (childCount > 10) {
                size = 'medium';
            }
            return new L.DivIcon({
                html: '<div><span>' + childCount + '</span></div>',
                className: 'marker-cluster-' + size,
                iconSize: new L.Point(40, 40)
            });
        }
    });
    
    // Initialize stats and chart
    initStats();
    initChart();
    
    // Start updates
    updatePackages();
    statsInterval = setInterval(updateStats, 5000);
    updateInterval = setInterval(updatePackages, 1000);
    
    // Add event listeners
    document.getElementById('time-range').addEventListener('change', updateTimeFilter);
    document.getElementById('toggle-clusters').addEventListener('click', toggleClusters);
}

function initChart() {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => i),
            datasets: [{
                label: 'Packages per hour',
                data: Array(24).fill(0),
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function initStats() {
    updateStats();
}

function updateStats() {
    fetch('/stats')
        .then(response => response.json())
        .then(data => {
            document.getElementById('total-packages').textContent = data.total_packages;
            document.getElementById('suspicious-count').textContent = data.suspicious_count;
            
            const topLocationsList = document.getElementById('top-locations');
            topLocationsList.innerHTML = '';
            data.top_locations.forEach(([loc, count]) => {
                const li = document.createElement('li');
                li.textContent = `${loc[0]}, ${loc[1]} (${count} packages)`;
                topLocationsList.appendChild(li);
            });
            
            // Update chart
            activityChart.data.datasets[0].data = data.activity_by_hour;
            activityChart.update();
        });
}

function updateTimeFilter() {
    currentTimeFilter = parseInt(this.value) * 60;
    updatePackages();
}

function toggleClusters() {
    useClusters = !useClusters;
    updatePackages();
}

function updatePackages() {
    fetch('/api/packages')
        .then(response => response.json())
        .then(data => {
            // Clear old markers
            markers.forEach(marker => {
                if (markerCluster.hasLayer(marker)) {
                    markerCluster.removeLayer(marker);
                }
                if (map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }
            });
            markers = [];
            
            const now = Math.floor(Date.now() / 1000);
            const filteredData = currentTimeFilter > 0 
                ? data.filter(p => p.timestamp >= now - currentTimeFilter)
                : data;
            
            // Add new markers
            filteredData.forEach(pkg => {
                const date = new Date(pkg.timestamp * 1000).toLocaleString();
                const popupContent = `
                    <strong>IP:</strong> ${pkg.ip}<br>
                    <strong>Location:</strong> ${pkg.latitude.toFixed(2)}, ${pkg.longitude.toFixed(2)}<br>
                    <strong>Time:</strong> ${date}<br>
                    <strong>Status:</strong> ${pkg.suspicious ? 'Suspicious' : 'Normal'}
                `;
                
                const marker = L.circleMarker([pkg.latitude, pkg.longitude], {
                    radius: 5,
                    fillColor: pkg.suspicious ? '#F44336' : '#4CAF50',
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(popupContent);
                
                markers.push(marker);
                
                if (useClusters) {
                    markerCluster.addLayer(marker);
                } else {
                    marker.addTo(map);
                }
            });
            
            if (useClusters) {
                map.addLayer(markerCluster);
            }
        });
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initMap);