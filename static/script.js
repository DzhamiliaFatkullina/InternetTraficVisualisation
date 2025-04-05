let map, markerCluster;
let showNormalPackages = true;
let activityChart;
let updateInterval;

function initMap() {
    // Map setup with dark theme
    map = L.map('map-container', {
        minZoom: 2,
        maxBounds: [[-90, -180], [90, 180]],
        zoomControl: false,
        attributionControl: false
    }).setView([20, 0], 2);
    
    // Dark map tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    
    // Custom zoom control
    L.control.zoom({
        position: 'topright'
    }).addTo(map);
    
    // Cluster configuration
    markerCluster = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: false,
        showCoverageOnHover: false,
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
        this.querySelector('span').textContent = showNormalPackages ? 
            'HIDE NORMAL PACKAGES' : 'SHOW NORMAL PACKAGES';
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
                        fillColor: pkg.suspicious ? '#ff5555' : '#64ffda',
                        color: pkg.suspicious ? '#ff0000' : '#172a45',
                        weight: 1.5,
                        fillOpacity: 0.9,
                        isSuspicious: pkg.suspicious
                    }).bindPopup(createPopup(pkg));
                    
                    markerCluster.addLayer(marker);
                }
            });
            
            map.addLayer(markerCluster);
        })
        .catch(err => console.error('Error fetching packages:', err));
}

function createPopup(pkg) {
    return `
        <div class="popup-content">
            <strong>IP:</strong> ${pkg.ip}<br>
            <strong>Country:</strong> ${pkg.country}<br>
            <strong>Type:</strong>
                ${pkg.suspicious ? 'SUSPICIOUS' : 'NORMAL'}
            </span><br>
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
                    `<li>
                        <span>${country}</span>
                        <span>${stats.total} (${stats.suspicious})</span>
                    </li>`)
                .join('');
            
            updateChart(data.country_stats);
        })
        .catch(err => console.error('Error fetching stats:', err));
}

function updateChart(data) {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    
    if (window.activityChart) {
        window.activityChart.destroy();
    }
    
    const chartData = {
        labels: data.map(d => d.country),
        datasets: [{
            label: 'Suspicious',
            data: data.map(d => d.suspicious),
            backgroundColor: 'rgba(255, 85, 85, 0.7)',
            borderWidth: 0,
            borderRadius: 2
        }, {
            label: 'Normal',
            data: data.map(d => d.normal),
            backgroundColor: 'rgba(100, 255, 218, 0.7)',
            borderWidth: 0,
            borderRadius: 2
        }]
    };
    
    window.activityChart = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { 
                    position: 'top',
                    labels: {
                        color: '#ccd6f6',
                        font: {
                            family: 'Roboto Mono',
                            size: 10
                        },
                        boxWidth: 12,
                        padding: 10
                    }
                },
                tooltip: {
                    backgroundColor: '#172a45',
                    titleColor: '#64ffda',
                    bodyColor: '#e6f1ff',
                    borderColor: '#303f60',
                    borderWidth: 1,
                    padding: 10,
                    titleFont: {
                        family: 'Roboto Mono',
                        size: 12
                    },
                    bodyFont: {
                        family: 'Inter',
                        size: 12
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    stacked: true,
                    grid: {
                        color: 'rgba(48, 63, 96, 0.5)'
                    },
                    ticks: {
                        color: '#8892b0',
                        font: {
                            family: 'Roboto Mono',
                            size: 10
                        }
                    }
                },
                x: { 
                    stacked: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#8892b0',
                        font: {
                            family: 'Roboto Mono',
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', initMap);

// Clean up on page exit
window.addEventListener('beforeunload', () => {
    clearInterval(updateInterval);
});