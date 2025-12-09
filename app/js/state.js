// ============================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ============================================

export const AppState = {
    // Mapa
    map: null,

    // Datos
    bicisData: [],
    parkingsData: [],
    stopsData: {},
    weatherData: null,

    // Capas del mapa
    layers: {
        markers: null,
        bicis: null,
        parkings: null,
        nearby: null,
        route: null,
        weather: null
    },

    // Estado de interacción
    currentStopId: null,
    selectingNearby: false,
    selectingWeather: false,
    selectingOrigin: false,
    selectingDestination: false,

    // Rutas
    routeOrigin: null,
    routeDestination: null,

    // Inicializar capas
    initLayers() {
        if (typeof L === 'undefined') {
            console.error('Leaflet no está cargado');
            return;
        }

        this.layers.markers = L.layerGroup();
        this.layers.bicis = L.layerGroup();
        this.layers.parkings = L.layerGroup();
        this.layers.nearby = L.layerGroup();
        this.layers.route = L.layerGroup();
        this.layers.weather = L.layerGroup();
    },

    // Resetear estado de selección
    resetSelectionState() {
        this.selectingNearby = false;
        this.selectingWeather = false;
        this.selectingOrigin = false;
        this.selectingDestination = false;
    }
};

// Hacer el estado accesible globalmente para debugging
if (typeof window !== 'undefined') {
    window.AppState = AppState;
}
