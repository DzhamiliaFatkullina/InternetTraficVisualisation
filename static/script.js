let map, markerCluster;
let showNormalPackages = true;
let activityChart;

function initMap() {
    // Map setup
    map = L.map('map-container', {
        minZoom: 2,
        maxBounds: [[-90, -180], [90, 180]]
    }).setView([20, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Cluster configuration
    markerCluster = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: false,
        iconCreateFunction: cluster => {
            const childCount = cluster.getChildCount();
            const suspiciousCount = cluster.getAllChildMarkers()
                .filter(m => m.options.isSuspicious).length;
            
            return L.divIcon({
                html: `
                    <div class="cluster-marker">
                        <span>${childCount}</span>
                        ${suspiciousCount > 0 ? `<span class="suspicious-count">${suspiciousCount}</span>` : ''}
                    </div>
                `,
                className: 'cluster-icon',
                iconSize: [40, 40]
            });
        }
    });
    
    // Initial load
    updatePackages();
    updateStats();
    updateInterval = setInterval(() => {
        updatePackages();
        updateStats();
    }, 3000);
    
    // Event listener for toggle
    document.getElementById('toggle-normal').addEventListener('click', function() {
        showNormalPackages = !showNormalPackages;
        this.textContent = showNormalPackages ? 'Hide Normal Packages' : 'Show Normal Packages';
        updatePackages();
    });
}

function updatePackages() {
    fetch('/api/packages')
        .then(res => res.json())
        .then(packages => {
            markerCluster.clearLayers();
            
            packages.forEach(pkg => {
                if (pkg.suspicious || showNormalPackages) {
                    const marker = L.circleMarker([pkg.latitude, pkg.longitude], {
                        radius: 6,
                        fillColor: pkg.suspicious ? '#ff0000' : '#4CAF50',
                        color: '#fff',
                        weight: 1,
                        fillOpacity: 0.8,
                        isSuspicious: pkg.suspicious
                    }).bindPopup(createPopup(pkg));
                    
                    markerCluster.addLayer(marker);
                }
            });
            
            map.addLayer(markerCluster);
        });
}

function createPopup(pkg) {
    return `
        <div class="popup-content">
            <strong>IP:</strong> ${pkg.ip}<br>
            <strong>Country:</strong> ${pkg.country}<br>
            <strong>Type:</strong> ${pkg.suspicious ? 'Suspicious' : 'Normal'}<br>
            <strong>Time:</strong> ${pkg.human_time}
        </div>
    `;
}

function updateStats() {
    fetch('/stats')
        .then(res => res.json())
        .then(data => {
            document.getElementById('total-packages').textContent = data.total_packages;
            document.getElementById('suspicious-count').textContent = data.suspicious_count;
            
            const locationsList = document.getElementById('top-locations');
            locationsList.innerHTML = data.top_countries
                .map(([country, stats]) => 
                    `<li>${country}: ${stats.total} (${stats.suspicious} suspicious)</li>`)
                .join('');
            
            updateChart(data.country_stats);
        });
}

function updateChart(data) {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    
    if (window.activityChart) {
        window.activityChart.destroy();
    }
    
    window.activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.country),
            datasets: [{
                label: 'Suspicious',
                data: data.map(d => d.suspicious),
                backgroundColor: 'rgba(255, 99, 132, 0.7)',
                borderWidth: 0
            }, {
                label: 'Normal',
                data: data.map(d => d.normal),
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            animation: false, 
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Packages by Country' }
            },
            scales: {
                y: { beginAtZero: true, stacked: true },
                x: { stacked: true }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', initMap);