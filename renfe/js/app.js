// ==========================================
// CONFIGURACIÓN
// ==========================================

const CONFIG = {
  WEBHOOK_URL: 'http://localhost:5678/webhook-test/webhook/mapa-madrid',
  CENTER: [40.4168, -3.7038],
  ZOOM: 11,
  UPDATE_INTERVAL: 5000
};

const LINE_COLORS = {
  'C1': '#FF0000',
  'C2': '#0066CC',
  'C3': '#009933',
  'C4': '#FF9900',
  'C5': '#9900FF',
  'C7': '#FFD700',
  'C8': '#FF00FF',
  'C9': '#00CCFF'
};

// ==========================================
// VARIABLES GLOBALES
// ==========================================

let map;
let markers = new Map();
let clusterGroup;
let stationMarkers = new Map();
let currentTrains = [];
let currentStations = [];

// ==========================================
// INICIALIZAR MAPA
// ==========================================

function initMap() {
  map = L.map('map').setView(CONFIG.CENTER, CONFIG.ZOOM);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);
  
  clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true
  });
  map.addLayer(clusterGroup);
  
  console.log('✅ Mapa inicializado');
}

// ==========================================
// CREAR ICONO DE TREN
// ==========================================

function createTrainIcon(color) {
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="12" fill="${color}"/>
        <path d="M 15 8 L 21 15 L 15 22 L 9 15 Z" fill="white" opacity="0.7"/>
      </svg>
    `)}`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
}

// ==========================================
// ACTUALIZAR TRENES
// ==========================================

function updateMarkers() {
  // Obtener filtros activos
  const activeLines = [];
  ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(line => {
    if (document.getElementById(`filter-${line}`).checked) {
      activeLines.push(line.toUpperCase());
    }
  });
  
  // Limpiar marcadores antiguos
  const visibleIds = new Set();
  
  currentTrains.forEach(train => {
    if (!activeLines.includes(train.line)) return;
    
    visibleIds.add(train.id);
    const color = LINE_COLORS[train.line] || '#888888';
    
    if (!markers.has(train.id)) {
      const marker = L.marker([train.lat, train.lon], {
        icon: createTrainIcon(color)
      }).bindPopup(`
        <div style="font-size: 12px;">
          <strong>${train.id}</strong><br>
          <strong>Línea:</strong> ${train.line}<br>
          <strong>Velocidad:</strong> ${train.speed} km/h<br>
          <strong>Estación:</strong> ${train.stationName}<br>
          <strong>Retraso:</strong> ${train.delayMinutes} min
        </div>
      `);
      
      clusterGroup.addLayer(marker);
      markers.set(train.id, marker);
    } else {
      markers.get(train.id).setLatLng([train.lat, train.lon]);
    }
  });
  
  // Eliminar marcadores no visibles
  markers.forEach((marker, id) => {
    if (!visibleIds.has(id)) {
      clusterGroup.removeLayer(marker);
      markers.delete(id);
    }
  });
  
  // Actualizar UI
  document.getElementById('train-count').textContent = visibleIds.size;
  document.getElementById('station-count').textContent = currentStations.length;
  document.getElementById('last-update').textContent = new Date().toLocaleTimeString('es-ES');
}

// ==========================================
// FETCH DATOS DEL WEBHOOK
// ==========================================

async function fetchData() {
  try {
    const response = await fetch(CONFIG.WEBHOOK_URL, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.points) {
      currentTrains = data.points;
      currentStations = data.stations || [];
      updateMarkers();
      console.log(`📍 ${currentTrains.length} trenes, ${currentStations.length} estaciones`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// ==========================================
// FILTROS
// ==========================================

document.querySelectorAll('.filter-panel input').forEach(input => {
  input.addEventListener('change', updateMarkers);
});

// ==========================================
// INICIAR
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  fetchData();
  setInterval(fetchData, CONFIG.UPDATE_INTERVAL);
  console.log('🚀 App iniciada');
});