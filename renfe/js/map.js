let map, clusterGroup, lightTiles, darkTiles;

function initializeMap() {
  map = L.map('map').setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
  lightTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
  darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© CartoDB'
  });
  
  clusterGroup = L.markerClusterGroup().addTo(map);
  log('Mapa inicializado');
}