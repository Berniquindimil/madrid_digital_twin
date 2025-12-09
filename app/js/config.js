// ============================================
// CONFIGURACIÓN Y CONSTANTES
// ============================================

export const API_CONFIG = {
    BICIMAD: 'http://localhost:5678/webhook-test/bicimad',
    PARKINGS: 'http://localhost:5678/webhook-test/parkings',
    BUSES: (stopId) => `http://localhost:5678/webhook-test/e256e4f8-a9b0-4cc4-bcae-b6a7a3667557/bus-parada/${stopId}`,
    PARADAS_CERCANAS: (lon, lat, radius) => `http://localhost:5678/webhook-test/4afc1676-8aa6-4827-881b-53cdcf87682f/paradas-cercanas/${lon}/${lat}/${radius}`,
    WEATHER: 'http://localhost:5678/webhook/clima-madrid',
    ROUTING: 'http://localhost:5678/webhook/rutas',
    METRICS: 'http://localhost:5678/webhook/metrics' // Para envío de métricas
};

export const MAP_CONFIG = {
    CENTER: [40.4168, -3.7038], // Madrid center
    ZOOM_LEVEL: 12,
    TILE_LAYER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ATTRIBUTION: '© OpenStreetMap contributors',
    MAX_ZOOM: 19
};

export const METRICS_CONFIG = {
    MAX_STORED_METRICS: 100,
    WARNING_THRESHOLD: 2000,  // ms
    ERROR_THRESHOLD: 5000,    // ms
    AUTO_SEND_INTERVAL: 30000, // 30 segundos
    UI_UPDATE_INTERVAL: 2000   // 2 segundos
};

export const CACHE_CONFIG = {
    ENABLED: true,
    TTL: {
        BICIMAD: 60000,    // 1 minuto
        PARKINGS: 60000,   // 1 minuto
        BUS_STOPS: 300000  // 5 minutos
    }
};
