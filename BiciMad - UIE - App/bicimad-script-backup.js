/* =====================================================
   CONFIGURACIÓN
   ===================================================== */
const CONFIG = {
    apiUrl: 'http://localhost:5678/webhook/bicimad', // tu webhook n8n
    updateInterval: 30000, // 30 segundos
    mapCenter: [40.4168, -3.7038], // Centro de Madrid
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

// Capas del mapa
let lightTiles;
let darkTiles;

/* =====================================================
   INICIALIZACIÓN DEL MAPA
   ===================================================== */
function initMap() {
    map = L.map('map').setView(CONFIG.mapCenter, CONFIG.mapZoom);
    
    // Capa clara
    lightTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors | BiciMAD EMT Madrid',
        maxZoom: 19
    }).addTo(map);

    // Capa oscura
    darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CartoDB',
        maxZoom: 19
    });

    // Capa para marcadores
    markersLayer = L.layerGroup().addTo(map);
}

/* =====================================================
   OBTENER DATOS DE ESTACIONES
   ===================================================== */
async function fetchStations() {
    console.log('🔄 Actualizando datos de BiciMAD...');

    try {
        const response = await fetch(CONFIG.apiUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        // NUEVO: tu webhook devuelve un array directamente
        const stations = await response.json();

        allStations = stations; // Guardar todas las estaciones
        updateMap(allStations);
        updateStats(allStations);
        document.getElementById('loading').style.display = 'none';
        console.log(`✅ ${allStations.length} estaciones actualizadas`);
    } catch (error) {
        console.error('❌ Error al obtener datos:', error);
        showError('Error al conectar con el servidor');
    }
}

function showError(message) {
    document.getElementById('loading').innerHTML = `
        <div style="color: #dc2626; text-align: center;">
            <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px;"></i>
            <p>${message}</p>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #00a650; color: white; border: none; border-radius: 5px; cursor: pointer;">
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
   CREAR CONTENIDO DEL POPUP
   ===================================================== */
function createPopupContent(station) {
    const isActive = station.is_active;
    const statusClass = isActive ? 'status-active' : 'status-inactive';
    const statusText = isActive ? 'Activa' : 'Inactiva';

    return `
        <div class="popup-content">
            <h3><i class="fas fa-bicycle"></i> ${station.name}</h3>
            <div class="info-row">
                <span class="label"><i class="fas fa-bicycle"></i> Bicis disponibles:</span>
                <span class="value">${station.dock_bikes}</span>
            </div>
            <div class="info-row">
                <span class="label"><i class="fas fa-parking"></i> Bases libres:</span>
                <span class="value">${station.free_bases}</span>
            </div>
            <div class="info-row">
                <span class="label"><i class="fas fa-layer-group"></i> Total bases:</span>
                <span class="value">${station.total_bases}</span>
            </div>
            <div class="info-row">
                <span class="label"><i class="fas fa-bookmark"></i> Reservas:</span>
                <span class="value">${station.reservations_count || 0}</span>
            </div>
            <span class="status-badge ${statusClass}">
                <i class="fas fa-${isActive ? 'check-circle' : 'times-circle'}"></i> ${statusText}
            </span>
            <div class="address">
                <i class="fas fa-map-marker-alt"></i> ${station.address || 'Dirección no disponible'}
            </div>
        </div>
    `;
}

/* =====================================================
   ACTUALIZAR MAPA CON ESTACIONES
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

        const coords = [station.latitude, station.longitude]; // NUEVO

        const occupancyClass = getOccupancyClass(station);

        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="station-marker ${occupancyClass}"><i class="fas fa-bicycle"></i></div>`,
            iconSize: [35, 35],
            iconAnchor: [17.5, 17.5]
        });

        const marker = L.marker(coords, { icon: icon })
            .bindPopup(createPopupContent(station));

        markersLayer.addLayer(marker);
        stationMarkers[station.station_id] = marker; // NUEVO
        visibleCount++;
    });

    const now = new Date();
    document.getElementById('last-update').textContent = 
        now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    console.log(`📍 ${visibleCount} estaciones visibles en el mapa`);
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

    document.getElementById('active-stations').textContent = activeStations.length;
    document.getElementById('available-bikes').textContent = totalBikes;
    document.getElementById('free-bases').textContent = totalFreeBases;
    document.getElementById('avg-occupancy').textContent = `${avgOccupancy}%`;

    document.getElementById('stats-total').textContent = stations.length;
    document.getElementById('stats-bikes').textContent = totalBikes;
    document.getElementById('stats-bases').textContent = totalBases;
    document.getElementById('stats-usage').textContent = `${systemUsage}%`;
}

/* =====================================================
   EVENT LISTENERS
   ===================================================== */
document.getElementById('filter-bikes').addEventListener('change', () => updateMap(allStations));
document.getElementById('filter-bases').addEventListener('change', () => updateMap(allStations));
document.getElementById('filter-inactive').addEventListener('change', () => updateMap(allStations));

document.getElementById('toggle-dark').addEventListener('click', function() {
    if (darkMode) {
        map.removeLayer(darkTiles);
        lightTiles.addTo(map);
        this.innerHTML = '<i class="fas fa-moon"></i> Modo Nocturno';
        this.classList.remove('active');
    } else {
        map.removeLayer(lightTiles);
        darkTiles.addTo(map);
        this.innerHTML = '<i class="fas fa-sun"></i> Modo Diurno';
        this.classList.add('active');
    }
    darkMode = !darkMode;
});

document.getElementById('reset-view').addEventListener('click', () => {
    map.setView(CONFIG.mapCenter, CONFIG.mapZoom);
});

document.getElementById('export-csv').addEventListener('click', () => {
    if (allStations.length === 0) return alert('No hay datos para exportar');

    let csv = 'ID,Nombre,Bicis Disponibles,Bases Libres,Total Bases,Activa,Latitud,Longitud,Dirección\n';
    
    allStations.forEach(station => {
        csv += `${station.station_id},`;
        csv += `"${station.name}",`;
        csv += `${station.dock_bikes},`;
        csv += `${station.free_bases},`;
        csv += `${station.total_bases},`;
        csv += `${station.is_active ? 'Sí' : 'No'},`;
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
});

document.getElementById('navbar-toggle').addEventListener('click', () => {
    document.getElementById('navbar-menu').classList.toggle('active');
});

/* =====================================================
   INICIALIZACIÓN
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando BiciMAD en tiempo real...');
    initMap();
    fetchStations();
    setInterval(fetchStations, CONFIG.updateInterval);
});