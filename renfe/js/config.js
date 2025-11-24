const CONFIG = {
  WEBHOOK_URL: "http://localhost:5678/webhook/mapa-madrid",
  MAP_CENTER: [40.4168, -3.7038],
  MAP_ZOOM: 11,
  UPDATE_INTERVAL: 5000
};

const STATE = {
  currentTrains: [],
  currentStations: [],
  currentAlerts: [],
  markers: new Map(),
  filters: { cercanias: true, media: true, ave: true }
};

function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); }