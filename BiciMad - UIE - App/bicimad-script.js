/* =====================================================
   CONFIGURACIÓN
   ===================================================== */
const CONFIG = {
    apiUrl: 'http://localhost:5678/webhook/bicimad',
    updateInterval: 30000,
    mapCenter: [40.4168, -3.7038],
    mapZoom: 13
};

/* =====================================================
   VARIABLES GLOBALES
   ===================================================== */
let map;
let stationMarkers = {};
let allStations = [];
let markersLayer;
let darkMode = false;
let selectedStation = null;
let trendData = [];
let lightTiles, darkTiles;

// Gráficas
let trendChart = null;
let distributionChart = null;

/* =====================================================
   INICIALIZACIÓN
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando BiciMAD mejorado...');
    initMap();
    setupEventListeners();
    fetchStations();
    setInterval(fetchStations, CONFIG.updateInterval);
});

/* =====================================================
   INICIALIZAR MAPA
   ===================================================== */
function initMap() {
    map = L.map('map').setView(CONFIG.mapCenter, CONFIG.mapZoom);
    
    lightTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CartoDB',
        maxZoom: 19
    });

    markersLayer = L.layerGroup().addTo(map);
}

/* =====================================================
   EVENT LISTENERS
   ===================================================== */
function setupEventListeners() {
    // Navegación de vistas
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.currentTarget.dataset.view;
            switchView(view);
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // Búsqueda
    document.getElementById('nav-search').addEventListener('click', toggleSearchPanel);
    document.getElementById('close-search').addEventListener('click', closeSearchPanel);
    document.getElementById('search-input').addEventListener('input', handleSearch);

    // Filtros
    document.getElementById('filter-bikes').addEventListener('change', () => updateMap(allStations));
    document.getElementById('filter-bases').addEventListener('change', () => updateMap(allStations));
    document.getElementById('filter-inactive').addEventListener('change', () => updateMap(allStations));

    // Modo oscuro
    document.getElementById('toggle-dark').addEventListener('click', toggleDarkMode);

    // Controles mapa
    document.getElementById('reset-view').addEventListener('click', () => {
        map.setView(CONFIG.mapCenter, CONFIG.mapZoom);
    });

    document.getElementById('export-csv').addEventListener('click', exportCSV);

    // Panel de detalles
    document.getElementById('close-details').addEventListener('click', closeDetailsPanel);

    // Menú hamburguesa
    document.getElementById('navbar-toggle').addEventListener('click', () => {
        document.getElementById('navbar-menu').classList.toggle('active');
    });
}

/* =====================================================
   CAMBIAR VISTA
   ===================================================== */
function switchView(viewName) {
    // Ocultar todas las vistas
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    
    // Mostrar la vista seleccionada
    const viewElement = document.getElementById(`${viewName}-view`);
    if (viewElement) {
        viewElement.classList.add('active');
        
        if (viewName === 'analytics') {
            // Inicializar gráficas si es necesario
            setTimeout(() => {
                initCharts();
            }, 100);
        }
    }
}

/* =====================================================
   OBTENER DATOS
   ===================================================== */
async function fetchStations() {
    console.log('📡 Actualizando datos de BiciMAD...');
    
    try {
        const response = await fetch(CONFIG.apiUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const stations = await response.json();
        allStations = stations;

        updateMap(allStations);
        updateStats(allStations);
        updateTrendData(allStations);
        
        document.getElementById('loading').style.display = 'none';
        console.log(`✅ ${allStations.length} estaciones actualizadas`);
    } catch (error) {
        console.error('❌ Error al obtener datos:', error);
        showError('Error al conectar con el servidor');
    }
}

function showError(message) {
    document.getElementById('loading').innerHTML = `
        <div style="text-align: center; color: var(--danger);">
            <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px; display: block;"></i>
            <p>${message}</p>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 10px 16px; background: var(--primary); color: var(--bg-dark); border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                Reintentar
            </button>
        </div>
    `;
}

/* =====================================================
   DETERMINAR CLASE DE OCUPACIÓN
   ===================================================== */
function getOccupancyClass(station) {
    if (!station.is_active) return 'station-inactive';
    const occupancyRate = station.dock_bikes / station.total_bases;
    if (occupancyRate > 0.5) return 'occupancy-high';
    if (occupancyRate > 0.2) return 'occupancy-medium';
    return 'occupancy-low';
}

/* =====================================================
   ACTUALIZAR MAPA
   ===================================================== */
function updateMap(stations) {
    markersLayer.clearLayers();
    stationMarkers = {};

    const showBikes = document.getElementById('filter-bikes').checked;
    const showBases = document.getElementById('filter-bases').checked;
    const showInactive = document.getElementById('filter-inactive').checked;

    let visibleCount = 0;

    stations.forEach(station => {
        const hasAvailableBikes = station.dock_bikes > 0;
        const hasFreeBases = station.free_bases > 0;
        const isActive = station.is_active;

        if (!showInactive && !isActive) return;
        if (showBikes && !showBases && !hasAvailableBikes) return;
        if (!showBikes && showBases && !hasFreeBases) return;
        if (showBikes && showBases && !hasAvailableBikes && !hasFreeBases) return;

        const coords = [station.latitude, station.longitude];
        const occupancyClass = getOccupancyClass(station);

        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="station-marker ${occupancyClass}"><i class="fas fa-bicycle"></i></div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        const marker = L.marker(coords, { icon: icon })
            .bindPopup(createPopupContent(station), { maxWidth: 300 })
            .on('click', () => showDetails(station));

        markersLayer.addLayer(marker);
        stationMarkers[station.station_id] = marker;
        visibleCount++;
    });

    const now = new Date();
    document.getElementById('last-update-time').textContent = 
        now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    console.log(`📍 ${visibleCount} estaciones visibles`);
}

/* =====================================================
   CREAR CONTENIDO DEL POPUP
   ===================================================== */
function createPopupContent(station) {
    const isActive = station.is_active;
    const statusText = isActive ? 'Activa' : 'Inactiva';
    const occupancyPercent = ((station.dock_bikes / station.total_bases) * 100).toFixed(0);

    return `
        <div style="min-width: 250px;">
            <div class="popup-header">
                <i class="fas fa-bicycle"></i>
                <h3>${station.name}</h3>
            </div>
            <div class="popup-body">
                <div class="popup-row">
                    <span class="label"><i class="fas fa-bicycle"></i> Bicis disponibles</span>
                    <span class="value">${station.dock_bikes}</span>
                </div>
                <div class="popup-row">
                    <span class="label"><i class="fas fa-parking"></i> Bases libres</span>
                    <span class="value">${station.free_bases}</span>
                </div>
                <div class="popup-row">
                    <span class="label"><i class="fas fa-layer-group"></i> Total bases</span>
                    <span class="value">${station.total_bases}</span>
                </div>
                <div class="popup-row">
                    <span class="label"><i class="fas fa-percentage"></i> Ocupación</span>
                    <span class="value">${occupancyPercent}%</span>
                </div>
                <div class="popup-row">
                    <span class="label"><i class="fas fa-bookmark"></i> Reservas</span>
                    <span class="value">${station.reservations_count || 0}</span>
                </div>
                <div style="margin-top: 12px;">
                    <span class="status-badge ${isActive ? 'active' : 'inactive'}">
                        <i class="fas fa-${isActive ? 'check-circle' : 'times-circle'}"></i> ${statusText}
                    </span>
                </div>
            </div>
        </div>
    `;
}

/* =====================================================
   PANEL DE DETALLES
   ===================================================== */
function showDetails(station) {
    selectedStation = station;
    const panel = document.getElementById('details-panel');
    const isActive = station.is_active;
    const occupancyPercent = ((station.dock_bikes / station.total_bases) * 100).toFixed(0);

    document.getElementById('details-name').textContent = station.name;
    
    const detailsHTML = `
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-bicycle"></i> Bicis disponibles</span>
            <span class="detail-value">${station.dock_bikes}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-parking"></i> Bases libres</span>
            <span class="detail-value">${station.free_bases}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-layer-group"></i> Total bases</span>
            <span class="detail-value">${station.total_bases}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-percentage"></i> Ocupación</span>
            <span class="detail-value">${occupancyPercent}%</span>
        </div>
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-bookmark"></i> Reservas</span>
            <span class="detail-value">${station.reservations_count || 0}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-map-marker-alt"></i> Dirección</span>
            <span class="detail-value" style="font-size: 13px;">${station.address || 'N/A'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label"><i class="fas fa-lightbulb"></i> Iluminación</span>
            <span class="detail-value">${station.light ? 'Sí' : 'No'}</span>
        </div>
        <div style="margin-top: 12px;">
            <span class="status-badge ${isActive ? 'active' : 'inactive'}">
                <i class="fas fa-${isActive ? 'check-circle' : 'times-circle'}"></i> ${isActive ? 'Activa' : 'Inactiva'}
            </span>
        </div>
    `;

    document.getElementById('details-content').innerHTML = detailsHTML;
    panel.classList.add('active');
}

function closeDetailsPanel() {
    document.getElementById('details-panel').classList.remove('active');
    selectedStation = null;
}

/* =====================================================
   BÚSQUEDA
   ===================================================== */
function toggleSearchPanel() {
    const panel = document.getElementById('search-panel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        document.getElementById('search-input').focus();
    }
}

function closeSearchPanel() {
    document.getElementById('search-panel').style.display = 'none';
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    
    if (query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }

    const results = allStations.filter(station => 
        station.name.toLowerCase().includes(query) ||
        station.address?.toLowerCase().includes(query)
    ).slice(0, 10);

    resultsContainer.innerHTML = results.map(station => `
        <div class="search-result-item" onclick="zoomToStation(${station.station_id})">
            <div class="result-info">
                <div class="result-name">${station.name}</div>
                <div class="result-stats">
                    ${station.dock_bikes} bicis • ${station.free_bases} bases libres
                </div>
            </div>
            <div class="result-distance">
                <i class="fas fa-arrow-right"></i>
            </div>
        </div>
    `).join('');
}

function zoomToStation(stationId) {
    const station = allStations.find(s => s.station_id === stationId);
    if (station && stationMarkers[stationId]) {
        map.setView([station.latitude, station.longitude], 15);
        stationMarkers[stationId].openPopup();
        showDetails(station);
        closeSearchPanel();
    }
}

/* =====================================================
   ACTUALIZAR ESTADÍSTICAS
   ===================================================== */
function updateStats(stations) {
    const activeStations = stations.filter(s => s.is_active);
    const totalBikes = activeStations.reduce((sum, s) => sum + s.dock_bikes, 0);
    const totalFreeBases = activeStations.reduce((sum, s) => sum + s.free_bases, 0);
    const totalBases = activeStations.reduce((sum, s) => sum + s.total_bases, 0);

    let totalOccupancy = 0;
    activeStations.forEach(s => {
        if (s.total_bases > 0) totalOccupancy += (s.dock_bikes / s.total_bases);
    });
    const avgOccupancy = activeStations.length > 0 
        ? (totalOccupancy / activeStations.length * 100).toFixed(1)
        : 0;

    const systemUsage = totalBases > 0 
        ? ((totalBikes / totalBases) * 100).toFixed(1)
        : 0;

    // Quick stats
    document.getElementById('quick-stations').textContent = activeStations.length;
    document.getElementById('quick-bikes').textContent = totalBikes;
    document.getElementById('quick-occupancy').textContent = `${avgOccupancy}%`;

    // Analytics stats
    document.getElementById('stat-total-stations').textContent = stations.length;
    document.getElementById('stat-total-bikes').textContent = totalBikes;
    document.getElementById('stat-total-bases').textContent = totalBases;
    document.getElementById('stat-avg-usage').textContent = `${systemUsage}%`;

    // Top 5 estaciones
    updateTopStations(activeStations);
}

function updateTopStations(stations) {
    const topStations = stations
        .sort((a, b) => b.dock_bikes - a.dock_bikes)
        .slice(0, 5);

    const html = topStations.map((station, index) => `
        <div class="station-rank-item">
            <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="background: var(--primary); color: var(--bg-dark); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">#${index + 1}</span>
                    <span class="rank-name">${station.name}</span>
                </div>
                <span style="font-size: 11px; color: var(--text-secondary);">${station.address}</span>
            </div>
            <div class="rank-value">${station.dock_bikes}</div>
        </div>
    `).join('');

    document.getElementById('top-stations-list').innerHTML = html;
}

/* =====================================================
   DATOS DE TENDENCIA
   ===================================================== */
function updateTrendData(stations) {
    const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const totalBikes = stations.reduce((sum, s) => sum + (s.is_active ? s.dock_bikes : 0), 0);

    trendData.push({
        time: now,
        bikes: totalBikes
    });

    if (trendData.length > 24) {
        trendData.shift();
    }
}

/* =====================================================
   GRÁFICAS
   ===================================================== */
function initCharts() {
    initTrendChart();
    initDistributionChart();
}

function initTrendChart() {
    const ctx = document.getElementById('trend-chart');
    if (!ctx) return;

    if (trendChart) trendChart.destroy();

    const labels = trendData.map(d => d.time);
    const data = trendData.map(d => d.bikes);

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Bicis Disponibles',
                data: data,
                borderColor: '#00d084',
                backgroundColor: 'rgba(0, 208, 132, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#00d084',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
}

function initDistributionChart() {
    const ctx = document.getElementById('distribution-chart');
    if (!ctx) return;

    if (distributionChart) distributionChart.destroy();

    const activeStations = allStations.filter(s => s.is_active);
    
    let highCount = 0, mediumCount = 0, lowCount = 0;
    activeStations.forEach(s => {
        const rate = s.dock_bikes / s.total_bases;
        if (rate > 0.5) highCount++;
        else if (rate > 0.2) mediumCount++;
        else lowCount++;
    });

    distributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Alta (>50%)', 'Media (20-50%)', 'Baja (<20%)'],
            datasets: [{
                data: [highCount, mediumCount, lowCount],
                backgroundColor: [
                    '#22c55e',
                    '#eab308',
                    '#ef4444'
                ],
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.9)',
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

/* =====================================================
   MODO OSCURO
   ===================================================== */
function toggleDarkMode() {
    darkMode = !darkMode;
    
    if (darkMode) {
        document.body.classList.remove('light-mode');
        map.removeLayer(lightTiles);
        darkTiles.addTo(map);
    } else {
        document.body.classList.add('light-mode');
        map.removeLayer(darkTiles);
        lightTiles.addTo(map);
    }
}

/* =====================================================
   EXPORTAR CSV
   ===================================================== */
function exportCSV() {
    if (allStations.length === 0) {
        alert('No hay datos para exportar');
        return;
    }

    let csv = 'ID,Nombre,Bicis Disponibles,Bases Libres,Total Bases,Activa,Ocupación %,Latitud,Longitud,Dirección\n';
    
    allStations.forEach(station => {
        const occupancy = ((station.dock_bikes / station.total_bases) * 100).toFixed(0);
        csv += `${station.station_id},`;
        csv += `"${station.name}",`;
        csv += `${station.dock_bikes},`;
        csv += `${station.free_bases},`;
        csv += `${station.total_bases},`;
        csv += `${station.is_active ? 'Sí' : 'No'},`;
        csv += `${occupancy},`;
        csv += `${station.latitude},${station.longitude},`;
        csv += `"${station.address || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bicimad-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
