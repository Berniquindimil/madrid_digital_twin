/* =====================================================
   CONFIGURACIÓN
   ===================================================== */
const CONFIG = {
    apiUrl: "https://data.renfe.com/api/3/action/datastore_search?resource_id=a2368cff-1562-4dde-8466-9635ea3a572a&limit=500",
    updateInterval: 60000, // 1 minuto
    mapCenter: [40.4168, -3.7038], // Centro de España (Madrid)
    mapZoom: 6
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
    map = L.map("map").setView(CONFIG.mapCenter, CONFIG.mapZoom);

    // Capa clara
    lightTiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors | Renfe Estaciones",
        maxZoom: 19
    }).addTo(map);

    // Capa oscura
    darkTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap, © CartoDB",
        maxZoom: 19
    });

    // Capa para marcadores
    markersLayer = L.layerGroup().addTo(map);
}

/* =====================================================
   OBTENER DATOS DE ESTACIONES RENFE
   ===================================================== */
async function fetchStations() {
    console.log("🚉 Actualizando datos de estaciones Renfe...");

    try {
        const response = await fetch(CONFIG.apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (!data.success) throw new Error("Error en la respuesta de la API de Renfe");

        const stations = data.result.records
            .filter(s => s["LATITUD"] && s["LONGITUD"])
            .map(s => ({
                id: s["CÓDIGO"],
                name: s["DENOMINACIÓN"] || "Estación sin nombre",
                province: s["PROVINCIA"] || "Desconocida",
                lat: parseFloat(s["LATITUD"]),
                lon: parseFloat(s["LONGITUD"]),
                tipo: s["TIPO_ESTACIÓN"] || "General",
                servicios: s["SERVICIOS"] || "N/D",
                accesible: s["ACCESIBLE"] === "SÍ",
            }));

        allStations = stations;
        updateMap(stations);
        updateStats(stations);
        document.getElementById("loading").style.display = "none";
        console.log(`✅ ${stations.length} estaciones actualizadas`);
    } catch (error) {
        console.error("❌ Error al obtener datos de Renfe:", error);
        showError("Error al conectar con la API de Renfe");
    }
}

function showError(message) {
    document.getElementById("loading").innerHTML = `
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
   DEFINIR COLOR DE MARCADOR SEGÚN TIPO
   ===================================================== */
function getStationClass(station) {
    if (station.tipo.includes("CERCANÍAS")) return "station-cercanias";
    if (station.tipo.includes("FEVE")) return "station-feve";
    return "station-general";
}

/* =====================================================
   CONTENIDO DEL POPUP
   ===================================================== */
function createPopupContent(station) {
    return `
        <div class="popup-content">
            <h3><i class="fas fa-train"></i> ${station.name}</h3>
            <div class="info-row"><span class="label">Provincia:</span> <span class="value">${station.province}</span></div>
            <div class="info-row"><span class="label">Tipo:</span> <span class="value">${station.tipo}</span></div>
            <div class="info-row"><span class="label">Servicios:</span> <span class="value">${station.servicios}</span></div>
            <div class="info-row"><span class="label">Accesible:</span> <span class="value">${station.accesible ? "✅ Sí" : "❌ No"}</span></div>
        </div>
    `;
}

/* =====================================================
   ACTUALIZAR MAPA
   ===================================================== */
function updateMap(stations) {
    markersLayer.clearLayers();
    stationMarkers = {};

    stations.forEach(station => {
        const icon = L.divIcon({
            className: "custom-div-icon",
            html: `<div class="station-marker ${getStationClass(station)}"><i class="fas fa-train"></i></div>`,
            iconSize: [35, 35],
            iconAnchor: [17.5, 17.5]
        });

        const marker = L.marker([station.lat, station.lon], { icon })
            .bindPopup(createPopupContent(station));

        markersLayer.addLayer(marker);
        stationMarkers[station.id] = marker;
    });

    const now = new Date();
    document.getElementById("last-update").textContent = now.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit"
    });

    console.log(`📍 ${stations.length} estaciones visibles`);
}

/* =====================================================
   ACTUALIZAR ESTADÍSTICAS
   ===================================================== */
function updateStats(stations) {
    const total = stations.length;
    const cercanias = stations.filter(s => s.tipo.includes("CERCANÍAS")).length;
    const feve = stations.filter(s => s.tipo.includes("FEVE")).length;
    const accesibles = stations.filter(s => s.accesible).length;

    document.getElementById("stats-total").textContent = total;
    document.getElementById("stats-cercanias").textContent = cercanias;
    document.getElementById("stats-feve").textContent = feve;
    document.getElementById("stats-accesibles").textContent = accesibles;
}

/* =====================================================
   EVENTOS
   ===================================================== */
document.getElementById("toggle-dark").addEventListener("click", function () {
    if (darkMode) {
        map.removeLayer(darkTiles);
        lightTiles.addTo(map);
        this.innerHTML = '<i class="fas fa-moon"></i> Modo Nocturno';
        this.classList.remove("active");
    } else {
        map.removeLayer(lightTiles);
        darkTiles.addTo(map);
        this.innerHTML = '<i class="fas fa-sun"></i> Modo Diurno';
        this.classList.add("active");
    }
    darkMode = !darkMode;
});

document.getElementById("reset-view").addEventListener("click", () => {
    map.setView(CONFIG.mapCenter, CONFIG.mapZoom);
});

/* =====================================================
   INICIALIZACIÓN
   ===================================================== */
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 Iniciando mapa de estaciones Renfe...");
    initMap();
    fetchStations();
    setInterval(fetchStations, CONFIG.updateInterval);
});
