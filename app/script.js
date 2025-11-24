// ============================================
// CONFIGURACIÓN
// ============================================
const API_BICIMAD = 'http://localhost:5678/webhook/bicimad';
const API_BUSES = (stopId) => `http://localhost:5678/webhook/e256e4f8-a9b0-4cc4-bcae-b6a7a3667557/bus-parada/${stopId}`;
const API_PARADAS_CERCANAS = (lon, lat, radius) => `http://localhost:5678/webhook/4afc1676-8aa6-4827-881b-53cdcf87682f/paradas-cercanas/${lon}/${lat}/${radius}`;
const MADRID_CENTER = [40.4168, -3.7038];
const ZOOM_LEVEL = 12;

// ============================================
// ESTADO
// ============================================
let map;
let bicisData = [];
let stopsData = {};
let currentStopId = null;
let markersLayer = L.layerGroup();
let selectingNearby = false; // Flag para modo selección

// ============================================
// DARK MODE
// ============================================
function initDarkMode() {
    const darkModeBtn = document.getElementById('toggle-dark');
    
    darkModeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        localStorage.setItem('darkMode', !document.body.classList.contains('light-mode'));
    });

    if (localStorage.getItem('darkMode') === 'false') {
        document.body.classList.add('light-mode');
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Cargado');
    initDarkMode();
    initMap();
    // NO cargar BiciMAD al inicio
    setupEventListeners();
});

function initMap() {
    console.log('Inicializando mapa...');
    map = L.map('map').setView(MADRID_CENTER, ZOOM_LEVEL);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    markersLayer.addTo(map);
    
    // Click en el mapa para seleccionar punto de paradas cercanas
    map.on('click', (e) => {
        if (!selectingNearby) return;
        
        const { lat, lng } = e.latlng;
        console.log('Punto seleccionado:', lat, lng);
        selectingNearby = false;
        
        // Cambiar estilo del botón
        document.getElementById('nearbyBtn').style.opacity = '1';
        document.getElementById('nearbyBtn').textContent = '📍 Paradas Cercanas';
        
        // Buscar paradas cercanas
        loadNearbyStops(lng, lat, 500);
    });
    
    console.log('Mapa inicializado');
}

function setupEventListeners() {
    console.log('Configurando event listeners...');
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Search
    document.getElementById('searchBtn').addEventListener('click', () => {
        const stopId = document.getElementById('searchInput').value.trim();
        console.log('Búsqueda por stopId:', stopId);
        
        if (stopId && /^\d+$/.test(stopId)) {
            loadBusStop(stopId);
            switchTab('paradas');
        } else {
            alert('Por favor, escribe un número válido (stopId)');
        }
    });

    // Enter en input
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('searchBtn').click();
        }
    });

    // Botón de paradas cercanas
    document.getElementById('nearbyBtn').addEventListener('click', () => {
        const isParadasTabActive = document.querySelector('[data-tab="paradas"]').classList.contains('active');
        
        if (!isParadasTabActive) {
            alert('Por favor, ve a la pestaña BUSEMTMAD primero');
            return;
        }

        // Activar modo selección
        selectingNearby = !selectingNearby;
        
        if (selectingNearby) {
            document.getElementById('nearbyBtn').style.opacity = '0.5';
            document.getElementById('nearbyBtn').textContent = '📍 Clickea en el mapa...';
            console.log('Modo selección activado');
        } else {
            document.getElementById('nearbyBtn').style.opacity = '1';
            document.getElementById('nearbyBtn').textContent = '📍 Paradas Cercanas';
            console.log('Modo selección desactivado');
        }
    });
}

// ============================================
// CARGAR BICIMAD
// ============================================
async function loadBiciMAD() {
    console.log('Cargando BiciMAD...');
    try {
        const response = await fetch(API_BICIMAD);
        const data = await response.json();
        bicisData = data[0].bicis || [];
        console.log('BiciMAD cargado:', bicisData.length, 'estaciones');

        renderBicisList();
        renderBicisMarkers();
    } catch (error) {
        console.error('Error cargando BiciMAD:', error);
        document.getElementById('bicisContainer').innerHTML = 
            '<div class="error"><i class="fas fa-exclamation-circle"></i> Error al cargar BiciMAD</div>';
    }
}

function clearBicisMarkers() {
    console.log('Limpiando marcadores de bicis...');
    markersLayer.clearLayers();
}

function renderBicisList() {
    const container = document.getElementById('bicisContainer');
    container.innerHTML = bicisData.map(bici => {
        const availability = (bici.available_bikes / bici.total_bases) * 100;
        const color = getAvailabilityColor(bici);
        const label = getAvailabilityLabel(bici);
        
        return `
            <div class="stop-item" style="border-left: 4px solid ${color};">
                <h3>🚴 ${bici.name}</h3>
                <p>📍 ${bici.address}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <span style="font-size: 11px; color: var(--text-secondary);">
                        <i class="fas fa-bicycle"></i> ${bici.available_bikes}/${bici.total_bases} bicis
                    </span>
                    <span style="font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px; background: ${color}20; color: ${color};">
                        ${label} (${availability.toFixed(0)}%)
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function renderBicisMarkers() {
    bicisData.forEach(bici => {
        const color = getAvailabilityColor(bici);
        const availability = (bici.available_bikes / bici.total_bases) * 100;
        
        const icon = L.divIcon({
            className: 'bike-marker',
            html: `<div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; box-shadow: 0 2px 8px ${color}40; border: 2px solid rgba(255,255,255,0.3);">🚴</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        L.marker([bici.latitude, bici.longitude], { icon })
            .bindPopup(`
                <strong>${bici.name}</strong><br>
                🚴 ${bici.available_bikes}/${bici.total_bases} bicis (${availability.toFixed(0)}%)<br>
                📍 ${bici.address}<br>
                <span style="font-size: 11px; color: ${color}; font-weight: 600;">${getAvailabilityLabel(bici)}</span>
            `)
            .addTo(markersLayer);
    });
}

// ============================================
// CARGAR PARADAS CERCANAS
// ============================================
let nearbyMarkersLayer = L.layerGroup();

function showStopOnMap(stopInfo) {
    console.log('Mostrando parada en el mapa:', stopInfo.name);
    
    // Limpiar marcadores anteriores
    nearbyMarkersLayer.clearLayers();
    
    const icon = L.divIcon({
        className: 'stop-marker',
        html: `<div style="background: linear-gradient(135deg, #0072ce 0%, #0052a3 100%); color: white; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; box-shadow: 0 4px 12px rgba(0, 114, 206, 0.5); border: 3px solid white;">🚌</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
    });

    L.marker([stopInfo.geometry.coordinates[1], stopInfo.geometry.coordinates[0]], { icon })
        .bindPopup(`
            <strong>${stopInfo.name}</strong><br>
            📍 ${stopInfo.direction}<br>
            StopId: ${stopInfo.id}
        `)
        .openPopup()
        .addTo(nearbyMarkersLayer);
    
    nearbyMarkersLayer.addTo(map);
    
    // Centrar mapa en la parada
    map.setView([stopInfo.geometry.coordinates[1], stopInfo.geometry.coordinates[0]], 15);
}

async function loadNearbyStops(lon, lat, radius) {
    console.log('Cargando paradas cercanas a:', lat, lon, 'Radio:', radius);
    
    try {
        const url = API_PARADAS_CERCANAS(lon, lat, radius);
        console.log('URL completa:', url);
        console.log('Llamando a:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        console.log('Paradas cercanas recibidas:', data);
        
        // Limpiar marcadores anteriores de paradas cercanas
        nearbyMarkersLayer.clearLayers();
        
        if (data[0] && data[0].paradas && data[0].paradas.length > 0) {
            // Mostrar paradas en el sidebar
            displayNearbyStops(data[0].paradas);
            
            // Debuggear primera parada
            console.log('Primera parada:', data[0].paradas[0]);
            
            // Añadir marcadores al mapa
            data[0].paradas.forEach((parada, index) => {
                console.log(`Parada ${index}: ${parada.name} - Lat: ${parada.latitude}, Lon: ${parada.longitude}`);
                
                const icon = L.divIcon({
                    className: 'nearby-marker',
                    html: `<div style="background: linear-gradient(135deg, #0072ce 0%, #0052a3 100%); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; box-shadow: 0 2px 8px rgba(0, 114, 206, 0.4); border: 2px solid rgba(255,255,255,0.3); cursor: pointer;">📍</div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });

                L.marker([parada.latitude, parada.longitude], { icon })
                    .bindPopup(`
                        <strong>${parada.name}</strong><br>
                        StopId: ${parada.id}<br>
                        📍 ${parada.address}<br>
                        <span style="font-size: 11px; color: #0072ce; font-weight: 600;">Líneas: ${parada.lines.map(l => l.line_name).join(', ')}</span>
                    `)
                    .on('click', function() {
                        loadBusStop(parada.id);
                        switchTab('paradas');
                    })
                    .addTo(nearbyMarkersLayer);
            });
            
            nearbyMarkersLayer.addTo(map);
            console.log('Se encontraron', data[0].paradas.length, 'paradas cercanas');
        } else {
            console.log('No hay paradas cercanas');
        }
    } catch (error) {
        console.error('Error cargando paradas cercanas:', error);
    }
}

function displayNearbyStops(paradas) {
    const container = document.getElementById('busesContainer');
    container.innerHTML = paradas.map(parada => `
        <div class="stop-item" style="cursor: pointer; border-left: 4px solid #0072ce;" onclick="loadBusStop('${parada.id}'); switchTab('paradas');">
            <h3>🚌 ${parada.name}</h3>
            <p>📍 ${parada.address}</p>
            <p style="font-size: 11px; color: var(--text-secondary); margin-top: 5px;">
                <strong>StopId:</strong> ${parada.id}<br>
                <strong>Distancia:</strong> ${(parada.distance / 1000).toFixed(2)} km
            </p>
            <div class="lines-container" style="margin-top: 8px;">
                ${parada.lines.slice(0, 5).map(line => 
                    `<span class="line-badge" style="background: #${line.color || '0072ce'}">${line.line_name}</span>`
                ).join('')}
            </div>
        </div>
    `).join('');
}
async function loadBusStop(stopId) {
    console.log('Cargando parada:', stopId);
    currentStopId = stopId;
    const container = document.getElementById('busesContainer');
    
    if (stopsData[stopId]) {
        console.log('Usando datos cacheados para stopId:', stopId);
        renderBusStop(stopsData[stopId]);
        return;
    }

    container.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando...</div>';

    try {
        const url = API_BUSES(stopId);
        console.log('Llamando a:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        console.log('Datos recibidos:', data);
        
        const busData = data[0];

        if (!busData.stop_info || !busData.stop_info.name) {
            container.innerHTML = '<div class="error"><i class="fas fa-times-circle"></i> Parada no encontrada</div>';
            return;
        }

        stopsData[stopId] = busData;
        renderBusStop(busData);
    } catch (error) {
        console.error('Error cargando parada:', error);
        container.innerHTML = '<div class="error"><i class="fas fa-exclamation-circle"></i> Error al cargar la parada</div>';
    }
}

function renderBusStop(busData) {
    console.log('Renderizando parada:', busData.stop_info.name);
    
    const infoPanel = document.getElementById('stopInfoPanel');
    document.getElementById('stopName').textContent = busData.stop_info.name;
    document.getElementById('stopDirection').textContent = busData.stop_info.direction;
    document.getElementById('stopId').textContent = busData.stop_info.id;

    const linesHtml = busData.bus_lines.slice(0, 8).map(line => 
        `<span class="line-badge" style="background: #${line.color || '0072ce'}">${line.line_name}</span>`
    ).join('');
    document.getElementById('stopLines').innerHTML = linesHtml;
    infoPanel.classList.add('active');

    const lineColors = {};
    busData.bus_lines.forEach(line => {
        lineColors[line.line_name] = line.color || '0072ce';
    });

    const container = document.getElementById('busesContainer');
    if (busData.arrivals.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay buses en tiempo real</p></div>';
    } else {
        container.innerHTML = busData.arrivals.map(bus => {
            const lineColor = lineColors[bus.line] || '0072ce';
            return `
                <div class="bus-arrival">
                    <div class="bus-arrival-header">
                        <span class="bus-line" style="background: #${lineColor}; color: ${getTextColor(lineColor)}">${bus.line}</span>
                        <span class="bus-time">⏱️ ${bus.time_minutes}m</span>
                    </div>
                    <div class="bus-destination">→ ${bus.destination}</div>
                    <div class="bus-distance">📍 ${(bus.distance_meters / 1000).toFixed(2)} km</div>
                </div>
            `;
        }).join('');
    }

    // Mostrar parada en el mapa
    showStopOnMap(busData.stop_info);
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function getAvailabilityColor(station) {
    if (!station.is_active) return '#5a6470'; // Gris inactiva
    
    const availability = (station.available_bikes / station.total_bases) * 100;
    
    if (availability > 50) return '#00d084'; // Verde alta
    if (availability >= 20) return '#ffa500'; // Naranja media
    if (availability > 0) return '#ff6b6b'; // Rojo baja
    return '#5a6470'; // Gris sin bicis
}

function getAvailabilityLabel(station) {
    if (!station.is_active) return 'Inactiva';
    
    const availability = (station.available_bikes / station.total_bases) * 100;
    
    if (availability > 50) return 'Alta';
    if (availability >= 20) return 'Media';
    if (availability > 0) return 'Baja';
    return 'Sin bicis';
}

function getTextColor(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? '#000000' : '#ffffff';
}

// ============================================
// TABS
// ============================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');

    // Cargar BiciMAD solo cuando se selecciona la pestaña
    if (tabName === 'bicis' && bicisData.length === 0) {
        loadBiciMAD();
    }
    
    // Limpiar bicis al volver a BUSEMTMAD
    if (tabName === 'paradas') {
        clearBicisMarkers();
    }
}