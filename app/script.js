// ============================================
// CONFIGURACIÓN
// ============================================
const API_BICIMAD = 'http://localhost:5678/webhook/bicimad';
const API_PARKINGS = 'http://localhost:5678/webhook/parkings';
const API_BUSES = (stopId) => `http://localhost:5678/webhook/e256e4f8-a9b0-4cc4-bcae-b6a7a3667557/bus-parada/${stopId}`;
const API_PARADAS_CERCANAS = (lon, lat, radius) => `http://localhost:5678/webhook/4afc1676-8aa6-4827-881b-53cdcf87682f/paradas-cercanas/${lon}/${lat}/${radius}`;

// Meteoblue API Configuration
// Usa la API basic weather (free tier) o current conditions
const API_WEATHER = 'http://localhost:5678/webhook/clima-madrid';

// OpenRouteService via n8n webhook
const API_ROUTING = 'http://localhost:5678/webhook/rutas';

const MADRID_CENTER = [40.4168, -3.7038];
const ZOOM_LEVEL = 12;

// ============================================
// SISTEMA DE MÉTRICAS Y KPIs
// ============================================
const metricsSystem = {
    // Almacenamiento de métricas
    data: {
        tabSwitches: [], // Cambios de pestaña con tiempos
        apiCalls: [], // Llamadas a API con timestamps
        renderErrors: [], // Errores de renderizado detectados
        performance: {
            bicis: [],
            parkings: [],
            paradas: [],
            rutas: []
        }
    }, 

    // Configuración
    config: {
        maxStoredMetrics: 100, // Máximo de métricas a almacenar en memoria
        warningThreshold: 2000, // ms - umbral de advertencia para carga
        errorThreshold: 5000 // ms - umbral de error para carga
    },

    // Iniciar tracking de cambio de pestaña
    startTabSwitch(tabName) {
        return {
            tabName,
            startTime: performance.now(),
            timestamp: new Date().toISOString()
        };
    },

    // Finalizar tracking de cambio de pestaña
    endTabSwitch(trackingData, success = true, errorMsg = null) {
        const endTime = performance.now();
        const duration = endTime - trackingData.startTime;

        const metric = {
            ...trackingData,
            endTime,
            duration,
            success,
            errorMsg
        };

        this.data.tabSwitches.push(metric);
        this._limitArray(this.data.tabSwitches);

        // Log en consola
        console.log(`[MÉTRICA] Cambio a pestaña "${trackingData.tabName}": ${duration.toFixed(2)}ms`);

        if (duration > this.config.errorThreshold) {
            console.warn(`⚠️ Tiempo de carga excesivo para "${trackingData.tabName}": ${duration.toFixed(2)}ms`);
        }

        return metric;
    },

    // Registrar llamada a API
    trackAPICall(apiName, url, method = 'GET') {
        const callData = {
            apiName,
            url,
            method,
            timestamp: new Date().toISOString(),
            startTime: performance.now()
        };

        this.data.apiCalls.push(callData);
        this._limitArray(this.data.apiCalls);

        console.log(`[API] Llamando a ${apiName}: ${url}`);
        return callData;
    },

    // Finalizar tracking de API
    endAPICall(trackingData, success = true, errorMsg = null, cached = false) {
        const endTime = performance.now();
        const duration = endTime - trackingData.startTime;

        trackingData.endTime = endTime;
        trackingData.duration = duration;
        trackingData.success = success;
        trackingData.errorMsg = errorMsg;
        trackingData.cached = cached;

        console.log(`[API] ${trackingData.apiName} completada en ${duration.toFixed(2)}ms${cached ? ' (caché)' : ''}`);

        return trackingData;
    },

    // Detectar peticiones duplicadas
    detectDuplicateAPICalls(timeWindow = 5000) {
        const now = Date.now();
        const recentCalls = this.data.apiCalls.filter(call =>
            now - new Date(call.timestamp).getTime() < timeWindow
        );

        const duplicates = {};
        recentCalls.forEach(call => {
            const key = `${call.apiName}_${call.url}`;
            duplicates[key] = (duplicates[key] || 0) + 1;
        });

        const foundDuplicates = Object.entries(duplicates)
            .filter(([_, count]) => count > 1)
            .map(([key, count]) => ({ key, count }));

        if (foundDuplicates.length > 0) {
            console.warn('⚠️ Peticiones duplicadas detectadas:', foundDuplicates);
        }

        return foundDuplicates;
    },

    // Registrar error de renderizado
    trackRenderError(component, errorType, details) {
        const error = {
            component,
            errorType,
            details,
            timestamp: new Date().toISOString()
        };

        this.data.renderErrors.push(error);
        this._limitArray(this.data.renderErrors);

        console.error(`[ERROR RENDER] ${component} - ${errorType}:`, details);

        return error;
    },

    // Validar datos renderizados (detectar duplicados)
    validateRenderedData(dataArray, idField = 'id') {
        const ids = dataArray.map(item => item[idField]);
        const uniqueIds = new Set(ids);

        if (ids.length !== uniqueIds.size) {
            const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
            this.trackRenderError('DataValidation', 'DUPLICATES_FOUND', {
                field: idField,
                duplicateIds: [...new Set(duplicates)],
                totalItems: ids.length,
                uniqueItems: uniqueIds.size
            });
            return false;
        }

        return true;
    },

    // Calcular estadísticas de rendimiento
    getPerformanceStats(tabName = null) {
        let relevantSwitches = this.data.tabSwitches;

        if (tabName) {
            relevantSwitches = relevantSwitches.filter(s => s.tabName === tabName);
        }

        if (relevantSwitches.length === 0) {
            return null;
        }

        const durations = relevantSwitches.map(s => s.duration);
        const successCount = relevantSwitches.filter(s => s.success).length;

        return {
            tabName: tabName || 'TODAS',
            count: relevantSwitches.length,
            successRate: ((successCount / relevantSwitches.length) * 100).toFixed(2) + '%',
            avgTime: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) + 'ms',
            minTime: Math.min(...durations).toFixed(2) + 'ms',
            maxTime: Math.max(...durations).toFixed(2) + 'ms',
            medianTime: this._calculateMedian(durations).toFixed(2) + 'ms'
        };
    },

    // Obtener resumen de métricas
    getSummary() {
        const summary = {
            tabSwitches: {
                total: this.data.tabSwitches.length,
                byTab: {
                    bicis: this.getPerformanceStats('bicis'),
                    parkings: this.getPerformanceStats('parkings'),
                    paradas: this.getPerformanceStats('paradas'),
                    rutas: this.getPerformanceStats('rutas')
                }
            },
            apiCalls: {
                total: this.data.apiCalls.length,
                successful: this.data.apiCalls.filter(c => c.success).length,
                cached: this.data.apiCalls.filter(c => c.cached).length,
                failed: this.data.apiCalls.filter(c => !c.success).length,
                avgDuration: this.data.apiCalls.length > 0
                    ? (this.data.apiCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / this.data.apiCalls.length).toFixed(2) + 'ms'
                    : '0ms'
            },
            renderErrors: {
                total: this.data.renderErrors.length,
                byType: this._groupBy(this.data.renderErrors, 'errorType')
            },
            duplicateCalls: this.detectDuplicateAPICalls()
        };

        return summary;
    },

    // Exportar métricas a JSON
    exportMetrics() {
        const exportData = {
            summary: this.getSummary(),
            rawData: this.data,
            exportedAt: new Date().toISOString(),
            config: this.config
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `metrics_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('📊 Métricas exportadas exitosamente');
    },

    // Mostrar resumen en consola
    printSummary() {
        const summary = this.getSummary();
        console.log('═══════════════════════════════════════════');
        console.log('📊 RESUMEN DE MÉTRICAS - Madrid Digital Twin');
        console.log('═══════════════════════════════════════════');
        console.log('\n🔄 CAMBIOS DE PESTAÑA:');
        console.log(`  Total: ${summary.tabSwitches.total}`);
        Object.entries(summary.tabSwitches.byTab).forEach(([tab, stats]) => {
            if (stats) {
                console.log(`\n  📑 ${tab.toUpperCase()}:`);
                console.log(`    - Cambios: ${stats.count}`);
                console.log(`    - Tasa éxito: ${stats.successRate}`);
                console.log(`    - Tiempo promedio: ${stats.avgTime}`);
                console.log(`    - Tiempo mín/máx: ${stats.minTime} / ${stats.maxTime}`);
            }
        });

        console.log('\n\n🌐 LLAMADAS A API:');
        console.log(`  Total: ${summary.apiCalls.total}`);
        console.log(`  Exitosas: ${summary.apiCalls.successful}`);
        console.log(`  Caché: ${summary.apiCalls.cached}`);
        console.log(`  Fallidas: ${summary.apiCalls.failed}`);
        console.log(`  Duración promedio: ${summary.apiCalls.avgDuration}`);

        console.log('\n\n❌ ERRORES DE RENDERIZADO:');
        console.log(`  Total: ${summary.renderErrors.total}`);
        if (summary.renderErrors.total > 0) {
            Object.entries(summary.renderErrors.byType).forEach(([type, count]) => {
                console.log(`    - ${type}: ${count}`);
            });
        }

        if (summary.duplicateCalls.length > 0) {
            console.log('\n\n⚠️  PETICIONES DUPLICADAS:');
            summary.duplicateCalls.forEach(dup => {
                console.log(`    - ${dup.key}: ${dup.count} llamadas`);
            });
        }

        console.log('\n═══════════════════════════════════════════');
    },

    // Resetear métricas
    reset() {
        this.data = {
            tabSwitches: [],
            apiCalls: [],
            renderErrors: [],
            performance: {
                bicis: [],
                parkings: [],
                paradas: [],
                rutas: []
            }
        };
        console.log('🔄 Métricas reseteadas');
    },

    // Utilidades privadas
    _limitArray(arr) {
        if (arr.length > this.config.maxStoredMetrics) {
            arr.shift();
        }
    },

    _calculateMedian(numbers) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);

        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        }

        return sorted[middle];
    },

    _groupBy(arr, key) {
        return arr.reduce((acc, item) => {
            const groupKey = item[key];
            acc[groupKey] = (acc[groupKey] || 0) + 1;
            return acc;
        }, {});
    }
};

// Exponer métricas globalmente para facilitar inspección en consola
window.metrics = metricsSystem;

// ============================================
// ESTADO
// ============================================
let map;
let bicisData = [];
let parkingsData = [];
let stopsData = {};
let currentStopId = null;
let markersLayer = L.layerGroup();
let bicisMarkersLayer = L.layerGroup(); // Capa separada para bicis
let parkingsMarkersLayer = L.layerGroup(); // Capa separada para parkings
let selectingNearby = false; // Flag para modo selección
let weatherData = null;
let routeOrigin = null;
let routeDestination = null;
let selectingOrigin = false;
let selectingDestination = false;
let routeLayer = L.layerGroup();
let selectingWeather = false; // Flag para modo selección de clima
let weatherMarkersLayer = L.layerGroup(); // Capa para marcadores de clima

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
    loadWeather(); // Cargar clima al inicio
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
    bicisMarkersLayer.addTo(map);
    parkingsMarkersLayer.addTo(map);
    routeLayer.addTo(map);
    weatherMarkersLayer.addTo(map);

    // Click en el mapa para seleccionar punto de paradas cercanas o rutas
    map.on('click', (e) => {
        const { lat, lng } = e.latlng;

        // Modo selección de clima
        if (selectingWeather) {
            console.log('Consultando clima en:', lat, lng);
            showWeatherAtLocation(lat, lng);
            return;
        }

        // Modo selección de paradas cercanas
        if (selectingNearby) {
            console.log('Punto seleccionado para paradas cercanas:', lat, lng);
            selectingNearby = false;

            // Cambiar estilo del botón
            document.getElementById('nearbyBtn').style.opacity = '1';
            document.getElementById('nearbyBtn').textContent = '📍 Paradas Cercanas';

            // Buscar paradas cercanas
            loadNearbyStops(lng, lat, 500);
            return;
        }

        // Modo selección de origen para ruta
        if (selectingOrigin) {
            console.log('Origen seleccionado:', lat, lng);
            routeOrigin = { lat, lng };
            selectingOrigin = false;

            // Añadir marcador de origen
            addRouteMarker(lat, lng, '📍', '#00d084');

            // Actualizar botón para solicitar destino
            const calculateRouteBtnFloat = document.getElementById('calculateRouteBtnFloat');
            if (calculateRouteBtnFloat) {
                calculateRouteBtnFloat.style.opacity = '0.6';
                calculateRouteBtnFloat.textContent = '🎯 Selecciona Destino en el mapa';
            }

            // Activar automáticamente selección de destino
            selectingDestination = true;

            return;
        }

        // Modo selección de destino para ruta
        if (selectingDestination) {
            console.log('Destino seleccionado:', lat, lng);
            routeDestination = { lat, lng };
            selectingDestination = false;

            // Añadir marcador de destino
            addRouteMarker(lat, lng, '🎯', '#ff6b6b');

            // Actualizar botón
            const calculateRouteBtnFloat = document.getElementById('calculateRouteBtnFloat');
            if (calculateRouteBtnFloat) {
                calculateRouteBtnFloat.style.opacity = '1';
                calculateRouteBtnFloat.textContent = '🗺️ Calcular Nueva Ruta';
            }

            // Calcular ruta automáticamente
            calculateOptimalRoute();

            return;
        }
    });

    console.log('Mapa inicializado');
}

function setupEventListeners() {
    console.log('Configurando event listeners...');

    // Tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons.length > 0) {
        tabButtons.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => switchTab(btn.dataset.tab));
            }
        });
    }

    // Search
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const stopId = searchInput ? searchInput.value.trim() : '';
            console.log('Búsqueda por stopId:', stopId);

            if (stopId && /^\d+$/.test(stopId)) {
                loadBusStop(stopId);
                switchTab('paradas');
            } else {
                alert('Por favor, escribe un número válido (stopId)');
            }
        });
    }

    // Enter en input
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchBtn) {
                searchBtn.click();
            }
        });
    }

    // Botón de paradas cercanas
    const nearbyBtn = document.getElementById('nearbyBtn');
    if (nearbyBtn) {
        nearbyBtn.addEventListener('click', () => {
            const paradasTab = document.querySelector('[data-tab="paradas"]');
            const isParadasTabActive = paradasTab ? paradasTab.classList.contains('active') : false;

            if (!isParadasTabActive) {
                alert('Por favor, ve a la pestaña BUSEMTMAD primero');
                return;
            }

            // Activar modo selección
            selectingNearby = !selectingNearby;

            if (selectingNearby) {
                nearbyBtn.style.opacity = '0.5';
                nearbyBtn.textContent = '📍 Clickea en el mapa...';
                console.log('Modo selección activado');
            } else {
                nearbyBtn.style.opacity = '1';
                nearbyBtn.textContent = '📍 Paradas Cercanas';
                console.log('Modo selección desactivado');
            }
        });
    }

    // Panel flotante de clima - Toggle
    const weatherPanelFloat = document.getElementById('weatherPanelFloat');
    const weatherPanelToggle = document.getElementById('weatherPanelToggle');
    let isPanelOpen = true; // Empieza abierto

    const toggleWeatherPanel = () => {
        isPanelOpen = !isPanelOpen;
        if (isPanelOpen) {
            weatherPanelFloat.style.right = '0';
            weatherPanelToggle.textContent = '▶';
        } else {
            weatherPanelFloat.style.right = '-280px';
            weatherPanelToggle.textContent = '◀';
        }
    };

    if (weatherPanelToggle) {
        weatherPanelToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWeatherPanel();
        });
    }

    // Botón de consultar clima por zona
    const consultWeatherBtn = document.getElementById('consultWeatherBtn');
    if (consultWeatherBtn) {
        consultWeatherBtn.addEventListener('click', () => {
            selectingWeather = !selectingWeather;

            if (selectingWeather) {
                consultWeatherBtn.style.opacity = '0.6';
                consultWeatherBtn.textContent = '🗺️ Clickea en el mapa...';
                console.log('Modo consulta clima activado');

                // Mostrar marcadores de clima si no están visibles
                if (!map.hasLayer(weatherMarkersLayer)) {
                    map.addLayer(weatherMarkersLayer);
                }
            } else {
                consultWeatherBtn.style.opacity = '1';
                consultWeatherBtn.textContent = '🗺️ Consultar Clima por Zona';
                console.log('Modo consulta clima desactivado');
            }
        });
    }

    // Botón único de calcular ruta con flujo lineal
    const calculateRouteBtnFloat = document.getElementById('calculateRouteBtnFloat');
    if (calculateRouteBtnFloat) {
        calculateRouteBtnFloat.addEventListener('click', () => {
            // Si ya hay una ruta calculada, limpiar y empezar de nuevo
            if (routeOrigin && routeDestination) {
                // Limpiar ruta anterior
                routeLayer.clearLayers();
                routeOrigin = null;
                routeDestination = null;

                // Ocultar info de ruta
                const routeInfoFloat = document.getElementById('routeInfoFloat');
                if (routeInfoFloat) {
                    routeInfoFloat.style.display = 'none';
                }

                // Activar selección de origen
                selectingOrigin = true;
                selectingDestination = false;
                calculateRouteBtnFloat.style.opacity = '0.6';
                calculateRouteBtnFloat.textContent = '📍 Selecciona Origen en el mapa';
                console.log('Nueva ruta - Selecciona origen');
            }
            // Si no hay origen, activar selección de origen
            else if (!routeOrigin) {
                selectingOrigin = true;
                selectingDestination = false;
                calculateRouteBtnFloat.style.opacity = '0.6';
                calculateRouteBtnFloat.textContent = '📍 Selecciona Origen en el mapa';
                console.log('Selecciona origen');
            }
            // Si hay origen pero no destino, activar selección de destino
            else if (routeOrigin && !routeDestination) {
                selectingOrigin = false;
                selectingDestination = true;
                calculateRouteBtnFloat.style.opacity = '0.6';
                calculateRouteBtnFloat.textContent = '🎯 Selecciona Destino en el mapa';
                console.log('Selecciona destino');
            }
        });
    }
}

// ============================================
// CARGAR BICIMAD
// ============================================
async function loadBiciMAD() {
    console.log('Cargando BiciMAD...');

    // Iniciar tracking de API
    const apiTracking = metricsSystem.trackAPICall('BiciMAD', API_BICIMAD, 'GET');

    const container = document.getElementById('bicisContainer');
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <span>Cargando BiciMAD...</span>
            </div>
        `;
    }

    try {
        const response = await fetch(API_BICIMAD);
        const data = await response.json();
        bicisData = data[0].bicis || [];
        console.log('BiciMAD cargado:', bicisData.length, 'estaciones');

        // Validar datos antes de renderizar
        metricsSystem.validateRenderedData(bicisData, 'id');

        renderBicisList();
        renderBicisMarkers();

        // Finalizar tracking exitosamente
        metricsSystem.endAPICall(apiTracking, true);
    } catch (error) {
        console.error('Error cargando BiciMAD:', error);
        if (container) {
            container.innerHTML = '<div class="error"><i class="fas fa-exclamation-circle"></i> Error al cargar BiciMAD</div>';
        }

        // Registrar error en métricas
        metricsSystem.endAPICall(apiTracking, false, error.message);
    }
}

function clearBicisMarkers() {
    console.log('Ocultando marcadores de bicis...');
    map.removeLayer(bicisMarkersLayer);
}

function showBicisMarkers() {
    console.log('Mostrando marcadores de bicis...');
    if (!map.hasLayer(bicisMarkersLayer)) {
        map.addLayer(bicisMarkersLayer);
    }
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
    // Limpiar marcadores previos de bicis
    bicisMarkersLayer.clearLayers();

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
            .addTo(bicisMarkersLayer);
    });
}

// ============================================
// CARGAR PARKINGS
// ============================================
async function loadParkings() {
    console.log('Cargando parkings...');

    // Iniciar tracking de API
    const apiTracking = metricsSystem.trackAPICall('Parkings', API_PARKINGS, 'GET');

    const container = document.getElementById('parkingsContainer');
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <span>Cargando parkings...</span>
            </div>
        `;
    }

    try {
        const response = await fetch(API_PARKINGS);
        const data = await response.json();
        parkingsData = data[0]?.data || [];
        console.log('Parkings cargados:', parkingsData.length, 'parkings');

        // Validar datos antes de renderizar
        metricsSystem.validateRenderedData(parkingsData, 'id');

        renderParkingsList();
        renderParkingsMarkers();

        // Finalizar tracking exitosamente
        metricsSystem.endAPICall(apiTracking, true);
    } catch (error) {
        console.error('Error cargando parkings:', error);
        if (container) {
            container.innerHTML = '<div class="error"><i class="fas fa-exclamation-circle"></i> Error al cargar parkings</div>';
        }

        // Registrar error en métricas
        metricsSystem.endAPICall(apiTracking, false, error.message);
    }
}

function clearParkingsMarkers() {
    console.log('Ocultando marcadores de parkings...');
    map.removeLayer(parkingsMarkersLayer);
}

function showParkingsMarkers() {
    console.log('Mostrando marcadores de parkings...');
    if (!map.hasLayer(parkingsMarkersLayer)) {
        map.addLayer(parkingsMarkersLayer);
    }
}

function renderParkingsList() {
    const container = document.getElementById('parkingsContainer');
    
    // Filtrar parkings con datos válidos
    const parkingsConDatos = parkingsData.filter(p => p.freeParking !== null && typeof p.freeParking === 'number');
    const parkingsSinDatos = parkingsData.filter(p => p.freeParking === null || typeof p.freeParking !== 'number');
    
    let html = '';
    
    // Mostrar primero los parkings con datos
    if (parkingsConDatos.length > 0) {
        html += parkingsConDatos.map(parking => {
            const color = getParkingAvailabilityColor(parking);
            const label = getParkingAvailabilityLabel(parking);
            
            return `
                <div class="stop-item" style="border-left: 4px solid ${color};">
                    <h3>🅿️ ${parking.name}</h3>
                    <p>📍 ${parking.address || 'Dirección no disponible'}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <span style="font-size: 11px; color: var(--text-secondary);">
                            <i class="fas fa-car"></i> ${parking.freeParking} plazas libres
                        </span>
                        <span style="font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px; background: ${color}20; color: ${color};">
                            ${label}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Luego los parkings sin datos (al final)
    if (parkingsSinDatos.length > 0) {
        html += `<div style="padding: 10px 15px; background: var(--surface-light); border-bottom: 1px solid var(--border);"><h4 style="font-size: 11px; color: var(--text-secondary); margin: 0;">Sin datos en tiempo real (${parkingsSinDatos.length})</h4></div>`;
        html += parkingsSinDatos.map(parking => {
            return `
                <div class="stop-item" style="border-left: 4px solid #5a6470; opacity: 0.6;">
                    <h3>🅿️ ${parking.name}</h3>
                    <p>📍 ${parking.address || 'Dirección no disponible'}</p>
                    <div style="margin-top: 8px;">
                        <span style="font-size: 11px; color: var(--text-secondary); font-style: italic;">
                            ℹ️ Sin datos de disponibilidad
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    container.innerHTML = html || '<div class="empty-state"><p>No hay parkings disponibles</p></div>';
}

function renderParkingsMarkers() {
    // Limpiar marcadores previos de parkings
    parkingsMarkersLayer.clearLayers();

    parkingsData.forEach(parking => {
        // Verificar si tiene datos válidos
        const tieneDatos = parking.freeParking !== null && typeof parking.freeParking === 'number';

        // Convertir coordenadas a números (pueden venir como strings)
        const lat = parseFloat(parking.geometry.coordinates[1]);
        const lon = parseFloat(parking.geometry.coordinates[0]);

        // Validar coordenadas
        if (isNaN(lat) || isNaN(lon)) {
            console.warn(`Coordenadas inválidas para parking: ${parking.name}`);
            return;
        }

        let icon, popupContent;

        if (tieneDatos) {
            // Parking con datos en tiempo real
            const color = getParkingAvailabilityColor(parking);
            const label = getParkingAvailabilityLabel(parking);

            icon = L.divIcon({
                className: 'parking-marker',
                html: `<div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; box-shadow: 0 2px 8px ${color}40; border: 2px solid rgba(255,255,255,0.3);">🅿️</div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });

            popupContent = `
                <strong>${parking.name}</strong><br>
                🅿️ ${parking.freeParking} plazas libres<br>
                📍 ${parking.address || 'Dirección no disponible'}<br>
                <span style="font-size: 11px; color: ${color}; font-weight: 600;">${label}</span>
            `;
        } else {
            // Parking sin datos en tiempo real
            icon = L.divIcon({
                className: 'parking-marker-no-data',
                html: `<div style="background: linear-gradient(135deg, #5a6470 0%, #444d57 100%); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; box-shadow: 0 2px 8px rgba(90,100,112,0.4); border: 2px solid rgba(255,255,255,0.2); opacity: 0.7;">🅿️</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            popupContent = `
                <strong>${parking.name}</strong><br>
                📍 ${parking.address || 'Dirección no disponible'}<br>
                <span style="font-size: 11px; color: #5a6470; font-style: italic;">ℹ️ Sin datos en tiempo real</span>
            `;
        }

        L.marker([lat, lon], { icon })
            .bindPopup(popupContent)
            .addTo(parkingsMarkersLayer);
    });
}

function getParkingAvailabilityColor(parking) {
    // Si no hay datos, retornar gris
    if (parking.freeParking === null || typeof parking.freeParking !== 'number') {
        return '#5a6470';
    }
    
    const plazasLibres = parking.freeParking;
    
    // Rangos basados en número absoluto de plazas libres
    if (plazasLibres >= 100) return '#00d084'; // Verde - muchas plazas
    if (plazasLibres >= 50) return '#ffa500';  // Naranja - disponibilidad media
    if (plazasLibres > 0) return '#ff6b6b';    // Rojo - pocas plazas
    return '#5a6470'; // Gris - completo
}

function getParkingAvailabilityLabel(parking) {
    // Si no hay datos
    if (parking.freeParking === null || typeof parking.freeParking !== 'number') {
        return 'Sin datos';
    }
    
    const plazasLibres = parking.freeParking;
    
    // Etiquetas basadas en número absoluto de plazas libres
    if (plazasLibres >= 100) return 'Muchas plazas';
    if (plazasLibres >= 50) return 'Disponible';
    if (plazasLibres > 0) return 'Pocas plazas';
    return 'Completo';
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

    const url = API_BUSES(stopId);

    if (stopsData[stopId]) {
        console.log('Usando datos cacheados para stopId:', stopId);

        // Tracking de caché hit
        const apiTracking = metricsSystem.trackAPICall('BusStop', url, 'GET');
        metricsSystem.endAPICall(apiTracking, true, null, true); // cached = true

        renderBusStop(stopsData[stopId]);
        return;
    }

    // Iniciar tracking de API
    const apiTracking = metricsSystem.trackAPICall('BusStop', url, 'GET');

    container.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando...</div>';

    try {
        console.log('Llamando a:', url);

        const response = await fetch(url);
        const data = await response.json();
        console.log('Datos recibidos:', data);

        const busData = data[0];

        if (!busData.stop_info || !busData.stop_info.name) {
            container.innerHTML = '<div class="error"><i class="fas fa-times-circle"></i> Parada no encontrada</div>';
            metricsSystem.endAPICall(apiTracking, false, 'Parada no encontrada');
            return;
        }

        // Ordenar arrivals por tiempo estimado de llegada (menor a mayor)
        if (busData.arrivals && busData.arrivals.length > 0) {
            busData.arrivals.sort((a, b) => {
                return (a.estimateArrive || 0) - (b.estimateArrive || 0);
            });
        }

        stopsData[stopId] = busData;
        renderBusStop(busData);

        // Finalizar tracking exitosamente
        metricsSystem.endAPICall(apiTracking, true);
    } catch (error) {
        console.error('Error cargando parada:', error);
        container.innerHTML = '<div class="error"><i class="fas fa-exclamation-circle"></i> Error al cargar la parada</div>';

        // Registrar error en métricas
        metricsSystem.endAPICall(apiTracking, false, error.message);
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
    // Iniciar tracking de rendimiento
    const tracking = metricsSystem.startTabSwitch(tabName);

    try {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');

        // Actualizar título y mostrar/ocultar secciones según el tab
        const busSearchSection = document.getElementById('busSearchSection');
        const sidebarTitle = document.getElementById('sidebarTitle');
        const sidebarSubtitle = document.getElementById('sidebarSubtitle');

        if (tabName === 'paradas') {
            if (busSearchSection) busSearchSection.style.display = 'block';
            if (sidebarTitle) sidebarTitle.textContent = '🚌 Buses';
            if (sidebarSubtitle) sidebarSubtitle.textContent = 'EMT Madrid en tiempo real';
            selectingWeather = false;
        } else if (tabName === 'bicis') {
            if (busSearchSection) busSearchSection.style.display = 'none';
            if (sidebarTitle) sidebarTitle.textContent = '🚴 BiciMAD';
            if (sidebarSubtitle) sidebarSubtitle.textContent = 'Estaciones en tiempo real';
            selectingWeather = false;
        } else if (tabName === 'parkings') {
            if (busSearchSection) busSearchSection.style.display = 'none';
            if (sidebarTitle) sidebarTitle.textContent = '🅿️ Parkings';
            if (sidebarSubtitle) sidebarSubtitle.textContent = 'Disponibilidad en tiempo real';
            selectingWeather = false;
        } else if (tabName === 'rutas') {
            if (busSearchSection) busSearchSection.style.display = 'none';
            if (sidebarTitle) sidebarTitle.textContent = '🗺️ Rutas';
            if (sidebarSubtitle) sidebarSubtitle.textContent = 'Calcula tu ruta óptima';
            selectingWeather = false;
        }

        // Cargar BiciMAD cuando se selecciona la pestaña
        if (tabName === 'bicis') {
            if (bicisData.length === 0) {
                loadBiciMAD();
            } else {
                // Si ya están cargados, re-renderizar para asegurar que se muestran
                renderBicisList();
                renderBicisMarkers();
            }
        }

        // Cargar Parkings cuando se selecciona la pestaña
        if (tabName === 'parkings') {
            if (parkingsData.length === 0) {
                loadParkings();
            } else {
                // Si ya están cargados, re-renderizar para asegurar que se muestran
                renderParkingsList();
                renderParkingsMarkers();
            }
        }

        // Limpiar marcadores al cambiar de pestaña
        if (tabName === 'paradas') {
            clearBicisMarkers();
            clearParkingsMarkers();
            routeLayer.clearLayers();
        }

        if (tabName === 'bicis') {
            clearParkingsMarkers();
            nearbyMarkersLayer.clearLayers();
            routeLayer.clearLayers();
            // Mostrar marcadores de bicis si ya están cargados
            if (bicisData.length > 0) {
                showBicisMarkers();
            }
        }

        if (tabName === 'parkings') {
            clearBicisMarkers();
            nearbyMarkersLayer.clearLayers();
            routeLayer.clearLayers();
            // Mostrar marcadores de parkings si ya están cargados
            if (parkingsData.length > 0) {
                showParkingsMarkers();
            }
        }

        if (tabName === 'rutas') {
            clearBicisMarkers();
            clearParkingsMarkers();
            nearbyMarkersLayer.clearLayers();
            // No limpiar routeLayer aquí para mantener las rutas visibles
        }

        // Finalizar tracking exitosamente
        metricsSystem.endTabSwitch(tracking, true);

    } catch (error) {
        // Registrar error
        metricsSystem.endTabSwitch(tracking, false, error.message);
        console.error('Error al cambiar de pestaña:', error);
    }
}

// ============================================
// CLIMA Y RECOMENDACIONES
// ============================================
async function loadWeather() {
    console.log('Cargando clima desde Meteoblue...');
    try {
        const response = await fetch(API_WEATHER);
        const data = await response.json();
        console.log('Datos crudos de Meteoblue:', data);

        // Convertir datos de Meteoblue al formato interno
        weatherData = convertMeteoblueData(data);
        console.log('Clima cargado:', weatherData);

        displayWeather();
    } catch (error) {
        console.error('Error cargando clima:', error);
        console.log('Usando datos de clima simulados para demostración');
        // Datos simulados para demostración si la API falla
        weatherData = {
            main: { temp: 18 },
            weather: [{ description: 'cielo claro', main: 'Clear' }],
            wind: { speed: 3.5 },
            rain: null
        };
        displayWeather();
    }
}

function convertMeteoblueData(meteoblueData) {
    // Meteoblue devuelve arrays con datos por hora
    // Tomamos el primer valor (hora actual)
    const currentTemp = meteoblueData.data_1h?.temperature?.[0] || 18;
    const currentWindSpeed = meteoblueData.data_1h?.windspeed?.[0] || 0;
    const currentPrecipitation = meteoblueData.data_1h?.precipitation?.[0] || 0;
    const pictocode = meteoblueData.data_1h?.pictocode?.[0] || 1;

    // Convertir pictocode a descripción del clima
    const weatherDescription = getWeatherDescription(pictocode);
    const weatherMain = getWeatherMain(pictocode);

    // Convertir windspeed de km/h a m/s (Meteoblue usa km/h)
    const windSpeedMs = currentWindSpeed / 3.6;

    return {
        main: {
            temp: currentTemp
        },
        weather: [{
            description: weatherDescription,
            main: weatherMain
        }],
        wind: {
            speed: windSpeedMs
        },
        rain: currentPrecipitation > 0 ? { '1h': currentPrecipitation } : null
    };
}

function getWeatherDescription(pictocode) {
    // Meteoblue pictocodes: https://content.meteoblue.com/en/help/standards/symbols-and-pictograms
    const descriptions = {
        1: 'despejado',
        2: 'parcialmente nublado',
        3: 'nublado',
        4: 'muy nublado',
        5: 'lluvia ligera',
        6: 'lluvia moderada',
        7: 'lluvia intensa',
        8: 'tormenta',
        9: 'nieve ligera',
        10: 'nieve moderada',
        11: 'nieve intensa',
        12: 'niebla',
        13: 'lluvia y nieve',
        14: 'tormenta con lluvia',
        15: 'tormenta con nieve'
    };
    return descriptions[pictocode] || 'despejado';
}

function getWeatherMain(pictocode) {
    // Categorías principales basadas en pictocode
    if (pictocode <= 2) return 'Clear';
    if (pictocode <= 4) return 'Clouds';
    if (pictocode >= 5 && pictocode <= 7) return 'Rain';
    if (pictocode === 8 || pictocode === 14) return 'Thunderstorm';
    if (pictocode >= 9 && pictocode <= 11) return 'Snow';
    if (pictocode === 12) return 'Fog';
    return 'Clear';
}

function displayWeather() {
    const weatherTemp = document.getElementById('weatherTemp');
    const weatherDescription = document.getElementById('weatherDescription');
    const weatherRecommendation = document.getElementById('weatherRecommendation');

    if (weatherTemp) weatherTemp.textContent = `${Math.round(weatherData.main.temp)}°C`;
    if (weatherDescription) weatherDescription.textContent = weatherData.weather[0].description;

    // Generar recomendación
    if (weatherRecommendation) {
        const recommendation = getTransportRecommendation(weatherData);
        weatherRecommendation.innerHTML = recommendation.html;
        weatherRecommendation.style.background = recommendation.color;
        weatherRecommendation.style.color = recommendation.textColor;
    }
}

function getTransportRecommendation(weather) {
    const temp = weather.main.temp;
    const windSpeed = weather.wind.speed;
    const isRaining = weather.rain !== null && weather.rain !== undefined;
    const weatherMain = weather.weather[0].main.toLowerCase();

    // Condiciones extremas - recomendar bus
    if (isRaining || temp < 5 || temp > 35 || windSpeed > 10) {
        let reason = '';
        if (isRaining) reason = 'Está lloviendo';
        else if (temp < 5) reason = 'Hace mucho frío';
        else if (temp > 35) reason = 'Hace mucho calor';
        else if (windSpeed > 10) reason = 'Hay mucho viento';

        return {
            html: `🚌 <strong>Recomendación: Bus</strong><br><span style="font-size: 11px;">${reason}. Mejor viaja en bus.</span>`,
            color: 'rgba(0, 114, 206, 0.2)',
            textColor: '#0072ce'
        };
    }

    // Condiciones buenas - recomendar bici
    if (temp >= 10 && temp <= 25 && windSpeed <= 5 && !isRaining) {
        return {
            html: `🚴 <strong>Recomendación: BiciMAD</strong><br><span style="font-size: 11px;">Clima perfecto para ir en bici.</span>`,
            color: 'rgba(0, 208, 132, 0.2)',
            textColor: '#00d084'
        };
    }

    // Condiciones aceptables - recomendar bici con precaución
    return {
        html: `🚴 <strong>Recomendación: BiciMAD</strong><br><span style="font-size: 11px;">Condiciones aceptables para bici.</span>`,
        color: 'rgba(255, 165, 0, 0.2)',
        textColor: '#ffa500'
    };
}

// ============================================
// CONSULTA DE CLIMA POR ZONA
// ============================================
function showWeatherAtLocation(lat, lng) {
    if (!weatherData) {
        alert('Datos de clima no disponibles. Intenta recargar la página.');
        return;
    }

    // Calcular variación de temperatura basada en distancia del centro y altitud simulada
    const distance = calculateDistance(lat, lng, MADRID_CENTER[0], MADRID_CENTER[1]);

    // Simular variación de temperatura:
    // - Por cada km de distancia: ±0.1°C (aleatorio)
    // - Por altitud simulada: zonas norte más frías, sur más cálidas
    const latVariation = (lat - MADRID_CENTER[0]) * -15; // Norte más frío
    const distanceVariation = (Math.random() - 0.5) * distance * 0.3;

    const tempVariation = latVariation + distanceVariation;
    const localTemp = weatherData.main.temp + tempVariation;

    // Simular variación en velocidad del viento (zonas más altas = más viento)
    const windVariation = distance * 0.2;
    const localWind = weatherData.wind.speed + windVariation;

    // Crear datos de clima locales
    const localWeather = {
        main: { temp: localTemp },
        weather: weatherData.weather,
        wind: { speed: localWind },
        rain: weatherData.rain
    };

    // Obtener emoji del clima según el pictocode
    const weatherEmoji = getWeatherEmoji(localWeather.weather[0].main);
    const weatherColor = getWeatherColor(localWeather.weather[0].main);

    // Agregar marcador en el mapa
    const icon = L.divIcon({
        className: 'weather-marker',
        html: `<div style="background: ${weatherColor}; color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 16px ${weatherColor}60; border: 3px solid white;">${weatherEmoji}</div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
    });

    // Limpiar marcadores previos
    weatherMarkersLayer.clearLayers();

    L.marker([lat, lng], { icon })
        .bindPopup(`
            <div style="text-align: center;">
                <strong style="font-size: 16px;">${weatherEmoji} ${Math.round(localTemp)}°C</strong><br>
                <span style="font-size: 12px;">${localWeather.weather[0].description}</span>
            </div>
        `)
        .addTo(weatherMarkersLayer)
        .openPopup();

    // Actualizar sidebar con información detallada
    displayWeatherDetails(lat, lng, localWeather, distance);
}

function getWeatherEmoji(weatherMain) {
    const emojis = {
        'Clear': '☀️',
        'Clouds': '☁️',
        'Rain': '🌧️',
        'Drizzle': '🌦️',
        'Thunderstorm': '⛈️',
        'Snow': '❄️',
        'Fog': '🌫️',
        'Mist': '🌫️'
    };
    return emojis[weatherMain] || '🌤️';
}

function getWeatherColor(weatherMain) {
    const colors = {
        'Clear': '#ffa500',
        'Clouds': '#95a5a6',
        'Rain': '#3498db',
        'Drizzle': '#5dade2',
        'Thunderstorm': '#8e44ad',
        'Snow': '#ecf0f1',
        'Fog': '#7f8c8d',
        'Mist': '#bdc3c7'
    };
    return colors[weatherMain] || '#ffa500';
}

function displayWeatherDetails(lat, lng, weather, distance) {
    const container = document.getElementById('climaInfo');
    const temp = weather.main.temp;
    const weatherEmoji = getWeatherEmoji(weather.weather[0].main);
    const recommendation = getTransportRecommendation(weather);

    // Mostrar el contenedor
    container.style.display = 'block';

    // Resetear el botón
    const consultWeatherBtn = document.getElementById('consultWeatherBtn');
    if (consultWeatherBtn) {
        consultWeatherBtn.style.opacity = '1';
        consultWeatherBtn.textContent = '🗺️ Consultar Clima por Zona';
    }
    selectingWeather = false;

    container.innerHTML = `
        <div style="position: relative;">
            <button onclick="clearWeatherZoneInfo()" style="position: absolute; top: -5px; right: -5px; background: #ff6b6b; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.2); z-index: 10; transition: all 0.2s;" onmouseover="this.style.background='#ff4444'" onmouseout="this.style.background='#ff6b6b'">×</button>
            <div style="text-align: center; padding: 20px; background: rgba(255, 165, 0, 0.05); border-radius: 12px; margin-bottom: 15px;">
                <div style="font-size: 64px; margin-bottom: 10px;">${weatherEmoji}</div>
                <div style="font-size: 36px; font-weight: bold; margin-bottom: 5px;">${Math.round(temp)}°C</div>
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 15px;">${weather.weather[0].description}</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
            <div style="padding: 12px; background: var(--surface-light); border-radius: 8px; text-align: center;">
                <div style="font-size: 20px; margin-bottom: 5px;">💨</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Viento</div>
                <div style="font-size: 16px; font-weight: 600;">${(weather.wind.speed * 3.6).toFixed(1)} km/h</div>
            </div>

            <div style="padding: 12px; background: var(--surface-light); border-radius: 8px; text-align: center;">
                <div style="font-size: 20px; margin-bottom: 5px;">${weather.rain ? '🌧️' : '☀️'}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Precipitación</div>
                <div style="font-size: 16px; font-weight: 600;">${weather.rain ? weather.rain['1h'] + ' mm' : '0 mm'}</div>
            </div>
        </div>

        <div style="padding: 12px; background: ${recommendation.color}; border-radius: 8px; border-left: 4px solid ${recommendation.textColor};">
            ${recommendation.html}
        </div>

        <div style="margin-top: 15px; padding: 12px; background: var(--surface-light); border-radius: 8px;">
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px;">📍 Ubicación consultada</div>
            <div style="font-size: 12px; font-weight: 600;">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 5px;">
                📏 ${distance.toFixed(2)} km del centro de Madrid
            </div>
        </div>


    `;
}

function clearWeatherZoneInfo() {
    const container = document.getElementById('climaInfo');
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }

    // Limpiar marcadores de clima del mapa
    weatherMarkersLayer.clearLayers();
}

// ============================================
// SISTEMA DE RUTAS
// ============================================
function addRouteMarker(lat, lng, emoji, color) {
    const icon = L.divIcon({
        className: 'route-marker',
        html: `<div style="background: ${color}; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px ${color}80; border: 3px solid white;">${emoji}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    L.marker([lat, lng], { icon }).addTo(routeLayer);
}

function checkRouteReady() {
    if (routeOrigin && routeDestination) {
        const calculateRouteBtnFloat = document.getElementById('calculateRouteBtnFloat');
        if (calculateRouteBtnFloat) {
            calculateRouteBtnFloat.style.display = 'block';
        }

        // Resetear botones
        const selectOriginBtnFloat = document.getElementById('selectOriginBtnFloat');
        const selectDestinationBtnFloat = document.getElementById('selectDestinationBtnFloat');
        if (selectOriginBtnFloat) {
            selectOriginBtnFloat.style.opacity = '1';
            selectOriginBtnFloat.textContent = '📍 Seleccionar Origen';
        }
        if (selectDestinationBtnFloat) {
            selectDestinationBtnFloat.style.opacity = '1';
            selectDestinationBtnFloat.textContent = '🎯 Seleccionar Destino';
        }
    }
}

async function calculateOptimalRoute() {
    console.log('Calculando ruta óptima...');

    // Limpiar rutas anteriores
    routeLayer.clearLayers();

    // Redibujar marcadores de origen y destino
    addRouteMarker(routeOrigin.lat, routeOrigin.lng, '📍', '#00d084');
    addRouteMarker(routeDestination.lat, routeDestination.lng, '🎯', '#ff6b6b');

    // Calcular distancia directa
    const distance = calculateDistance(
        routeOrigin.lat, routeOrigin.lng,
        routeDestination.lat, routeDestination.lng
    );

    console.log(`Distancia directa: ${distance.toFixed(2)} km`);

    // Obtener modo de transporte seleccionado por el usuario
    const transportModeSelect = document.getElementById('transportModeSelect');
    let transportMode = transportModeSelect ? transportModeSelect.value : 'cycling-regular';
    let routeColor = '#00d084';
    let transportEmoji = '🚴';
    let transportName = 'Bicicleta';

    // Asignar colores y nombres según el modo
    if (transportMode === 'cycling-regular') {
        routeColor = '#00d084';
        transportEmoji = '🚴';
        transportName = 'Bicicleta';
    } else if (transportMode === 'foot-walking') {
        routeColor = '#0072ce';
        transportEmoji = '🚶';
        transportName = 'A pie';
    } else if (transportMode === 'driving-car') {
        routeColor = '#ff9500';
        transportEmoji = '🚗';
        transportName = 'Coche';
    }

    // Mostrar estado de carga
    const routeInfoFloat = document.getElementById('routeInfoFloat');
    if (routeInfoFloat) {
        routeInfoFloat.style.display = 'block';
        routeInfoFloat.innerHTML = `
            <strong>⏳ Calculando ruta...</strong><br>
            Obteniendo mejor ruta ${transportEmoji}
        `;
    }

    try {
        // Llamar a OpenRouteService API
        const routeData = await fetchRoute(
            routeOrigin.lng, routeOrigin.lat,
            routeDestination.lng, routeDestination.lat,
            transportMode
        );

        if (!routeData || !routeData.routes || routeData.routes.length === 0) {
            throw new Error('No se pudo calcular la ruta');
        }

        // Extraer datos de la ruta (formato OpenRouteService)
        const route = routeData.routes[0];
        const segment = route.segments[0];

        // Decodificar geometría (viene como polyline encoded)
        const coordinates = decodePolyline(route.geometry);
        const distanceKm = (segment.distance / 1000).toFixed(2);
        const durationMin = Math.ceil(segment.duration / 60);

        console.log(`✓ Ruta calculada: ${distanceKm} km, ${durationMin} min (${coordinates.length} puntos)`);

        // Dibujar la ruta en el mapa
        drawRouteOnMap(coordinates, routeColor);

        // Buscar estaciones cercanas si es ruta en bici
        if (transportMode === 'cycling-regular') {
            findNearestBikeStations();
        }

        // Mostrar popup con recomendación
        const midpoint = [
            (routeOrigin.lat + routeDestination.lat) / 2,
            (routeOrigin.lng + routeDestination.lng) / 2
        ];

        L.popup()
            .setLatLng(midpoint)
            .setContent(`
                <strong>Ruta Calculada</strong><br>
                ${transportEmoji} ${transportName}<br>
                📏 ${distanceKm} km<br>
                ⏱️ ${durationMin} min
            `)
            .openOn(map);

        // Ajustar vista del mapa a la ruta
        const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
        map.fitBounds(latLngs, { padding: [50, 50] });

        // Actualizar info en panel flotante
        if (routeInfoFloat) {
            routeInfoFloat.style.display = 'block';
            routeInfoFloat.innerHTML = `
                <strong>✓ Ruta calculada</strong><br>
                ${transportEmoji} ${transportName}<br>
                📏 Distancia: ${distanceKm} km<br>
                ⏱️ Tiempo: ${durationMin} min
            `;
        }

    } catch (error) {
        console.error('Error calculando ruta:', error);
        if (routeInfoFloat) {
            routeInfoFloat.style.display = 'block';
            routeInfoFloat.innerHTML = `
                <strong>❌ Error</strong><br>
                No se pudo calcular la ruta.<br>
                <span style="font-size: 10px;">Verifica la conexión con n8n</span>
            `;
        }
    }
}

// Nueva función para llamar a OpenRouteService via n8n
async function fetchRoute(startLon, startLat, endLon, endLat, profile) {
    const url = `${API_ROUTING}?profile=${profile}&startLon=${startLon}&startLat=${startLat}&endLon=${endLon}&endLat=${endLat}`;

    console.log('Llamando a:', url);

    try {
        const response = await fetch(url);

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Data recibida:', data);

        // n8n devuelve un array, extraemos el primer elemento
        return Array.isArray(data) ? data[0] : data;
    } catch (error) {
        console.error('Error fetching route:', error);
        return null;
    }
}

// Función para decodificar polyline encoded (formato OpenRouteService/Google)
function decodePolyline(encoded) {
    const coordinates = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
        let b;
        let shift = 0;
        let result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        coordinates.push([lng * 1e-5, lat * 1e-5]);
    }

    return coordinates;
}

// Nueva función para dibujar la ruta en el mapa
function drawRouteOnMap(coordinates, color) {
    // Convertir coordenadas de [lon, lat] a [lat, lon] para Leaflet
    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);

    // Añadir borde oscuro primero (se dibuja detrás)
    L.polyline(latLngs, {
        color: '#000000',
        weight: 8,
        opacity: 0.4,
        lineJoin: 'round'
    }).addTo(routeLayer);

    // Crear polyline principal con color más visible
    L.polyline(latLngs, {
        color: color === '#00d084' ? '#FF3333' : '#FF6B35', // Rojo para bicis, naranja-rojo para peatones
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round'
    }).addTo(routeLayer);
}

function findNearestBikeStations() {
    if (bicisData.length === 0) return;

    // Encontrar estaciones cercanas al origen y destino
    const nearOrigin = findNearestStation(routeOrigin.lat, routeOrigin.lng, bicisData);
    const nearDestination = findNearestStation(routeDestination.lat, routeDestination.lng, bicisData);

    if (nearOrigin) {
        const icon = L.divIcon({
            className: 'route-station',
            html: `<div style="background: #00d084; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 8px #00d08460; border: 2px solid white;">🚴</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        L.marker([nearOrigin.latitude, nearOrigin.longitude], { icon })
            .bindPopup(`<strong>Estación origen</strong><br>${nearOrigin.name}<br>🚴 ${nearOrigin.available_bikes} bicis disponibles`)
            .addTo(routeLayer);
    }

    if (nearDestination) {
        const icon = L.divIcon({
            className: 'route-station',
            html: `<div style="background: #00d084; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 8px #00d08460; border: 2px solid white;">🚴</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        L.marker([nearDestination.latitude, nearDestination.longitude], { icon })
            .bindPopup(`<strong>Estación destino</strong><br>${nearDestination.name}<br>📍 ${nearDestination.available_bases} bases libres`)
            .addTo(routeLayer);
    }
}

function findNearestBusStops() {
    console.log('Buscando paradas de bus cercanas...');
    // Esta función podría extenderse para buscar paradas de bus cercanas
    // Por ahora solo muestra un mensaje
}

function findNearestStation(lat, lng, stations) {
    let nearest = null;
    let minDistance = Infinity;

    stations.forEach(station => {
        const dist = calculateDistance(lat, lng, station.latitude, station.longitude);
        if (dist < minDistance) {
            minDistance = dist;
            nearest = station;
        }
    });

    return nearest;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    // Fórmula de Haversine
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ============================================
// PANEL DE MÉTRICAS UI
// ============================================
function initMetricsPanel() {
    const toggleBtn = document.getElementById('toggle-metrics');
    const metricsPanel = document.getElementById('metricsPanel');
    const metricsPanelToggle = document.getElementById('metricsPanelToggle');
    const exportBtn = document.getElementById('exportMetricsBtn');
    const resetBtn = document.getElementById('resetMetricsBtn');

    let isPanelOpen = false;

    const toggleMetricsPanel = () => {
        isPanelOpen = !isPanelOpen;
        if (isPanelOpen) {
            metricsPanel.style.left = '0';
            metricsPanelToggle.textContent = '▶';
            updateMetricsDisplay();
        } else {
            metricsPanel.style.left = '-450px';
            metricsPanelToggle.textContent = '◀';
        }
    };

    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleMetricsPanel);
    }

    if (metricsPanelToggle) {
        metricsPanelToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMetricsPanel();
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            metricsSystem.exportMetrics();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres resetear todas las métricas?')) {
                metricsSystem.reset();
                updateMetricsDisplay();
            }
        });
    }

    // Auto-actualizar métricas cada 2 segundos si el panel está abierto
    setInterval(() => {
        if (isPanelOpen) {
            updateMetricsDisplay();
        }
    }, 2000);
}

function updateMetricsDisplay() {
    const summary = metricsSystem.getSummary();

    // Actualizar resumen rápido
    updateQuickSummary(summary);

    // Actualizar métricas de pestañas
    updateTabMetrics(summary);

    // Actualizar métricas de API
    updateAPIMetrics(summary);

    // Actualizar errores de renderizado
    updateRenderErrorMetrics(summary);

    // Actualizar peticiones duplicadas
    updateDuplicateCallsMetrics(summary);

    // Actualizar timestamp
    const lastUpdateEl = document.getElementById('metricsLastUpdate');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = `Última actualización: ${new Date().toLocaleTimeString()}`;
    }
}

function updateQuickSummary(summary) {
    const container = document.getElementById('metricsQuickSummary');
    if (!container) return;

    const avgTabTime = summary.tabSwitches.total > 0
        ? (metricsSystem.data.tabSwitches.reduce((sum, t) => sum + t.duration, 0) / summary.tabSwitches.total).toFixed(0)
        : 0;

    container.innerHTML = `
        <div style="background: var(--bg-dark); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: var(--primary);">${summary.tabSwitches.total}</div>
            <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">Cambios de Pestaña</div>
        </div>
        <div style="background: var(--bg-dark); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #0072ce;">${avgTabTime}ms</div>
            <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">Tiempo Promedio</div>
        </div>
        <div style="background: var(--bg-dark); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #00d084;">${summary.apiCalls.total}</div>
            <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">Llamadas a API</div>
        </div>
        <div style="background: var(--bg-dark); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: ${summary.renderErrors.total > 0 ? '#ff6b6b' : '#00d084'};">${summary.renderErrors.total}</div>
            <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">Errores</div>
        </div>
    `;
}

function updateTabMetrics(summary) {
    const container = document.getElementById('tabMetrics');
    if (!container) return;

    const tabs = ['bicis', 'parkings', 'paradas', 'rutas'];
    let html = '';

    tabs.forEach(tab => {
        const stats = summary.tabSwitches.byTab[tab];
        if (stats) {
            const avgTime = parseFloat(stats.avgTime);
            const color = avgTime > 2000 ? '#ff6b6b' : avgTime > 1000 ? '#ffa500' : '#00d084';

            html += `
                <div style="margin-bottom: 12px; padding: 10px; background: var(--bg-dark); border-radius: 6px; border-left: 3px solid ${color};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">${tab.toUpperCase()}</span>
                        <span style="font-size: 12px; font-weight: 700; color: ${color};">${stats.avgTime}</span>
                    </div>
                    <div style="font-size: 10px; color: var(--text-secondary); display: flex; justify-content: space-between;">
                        <span>Cambios: ${stats.count}</span>
                        <span>Éxito: ${stats.successRate}</span>
                    </div>
                    <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">
                        <span>Min: ${stats.minTime} | Max: ${stats.maxTime}</span>
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = html || '<p style="font-size: 11px; color: var(--text-secondary); text-align: center;">No hay datos disponibles</p>';
}

function updateAPIMetrics(summary) {
    const container = document.getElementById('apiMetrics');
    if (!container) return;

    const cachedPercentage = summary.apiCalls.total > 0
        ? ((summary.apiCalls.cached / summary.apiCalls.total) * 100).toFixed(1)
        : 0;

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 10px;">
            <div style="background: var(--bg-dark); padding: 10px; border-radius: 6px; text-align: center;">
                <div style="font-size: 18px; font-weight: 700; color: #00d084;">${summary.apiCalls.successful}</div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Exitosas</div>
            </div>
            <div style="background: var(--bg-dark); padding: 10px; border-radius: 6px; text-align: center;">
                <div style="font-size: 18px; font-weight: 700; color: #ff6b6b;">${summary.apiCalls.failed}</div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Fallidas</div>
            </div>
        </div>
        <div style="background: var(--bg-dark); padding: 10px; border-radius: 6px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: var(--text-secondary);">Desde caché:</span>
                <span style="font-size: 12px; font-weight: 700; color: var(--primary);">${summary.apiCalls.cached} (${cachedPercentage}%)</span>
            </div>
        </div>
        <div style="background: var(--bg-dark); padding: 10px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: var(--text-secondary);">Duración promedio:</span>
                <span style="font-size: 12px; font-weight: 700; color: #0072ce;">${summary.apiCalls.avgDuration}</span>
            </div>
        </div>
    `;
}

function updateRenderErrorMetrics(summary) {
    const container = document.getElementById('renderErrorMetrics');
    if (!container) return;

    if (summary.renderErrors.total === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
                <p style="font-size: 12px; color: var(--text-secondary); margin: 0;">Sin errores de renderizado</p>
            </div>
        `;
        return;
    }

    let html = '';
    Object.entries(summary.renderErrors.byType).forEach(([type, count]) => {
        html += `
            <div style="background: var(--bg-dark); padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; color: var(--text-primary); font-weight: 600;">${type}</span>
                    <span style="font-size: 14px; font-weight: 700; color: #ff6b6b;">${count}</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function updateDuplicateCallsMetrics(summary) {
    const section = document.getElementById('duplicateCallsSection');
    const container = document.getElementById('duplicateCallsMetrics');
    if (!section || !container) return;

    if (summary.duplicateCalls.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    let html = '';
    summary.duplicateCalls.forEach(dup => {
        html += `
            <div style="background: var(--bg-dark); padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 10px; color: var(--text-primary); word-break: break-all; flex: 1;">${dup.key}</span>
                    <span style="font-size: 14px; font-weight: 700; color: #ffa500; margin-left: 10px;">${dup.count}x</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Inicializar panel de métricas cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    initMetricsPanel();
    console.log('📊 Sistema de métricas inicializado. Usa window.metrics para acceder a las métricas en consola.');
    console.log('Comandos disponibles:');
    console.log('  - metrics.printSummary() - Ver resumen en consola');
    console.log('  - metrics.exportMetrics() - Exportar a JSON');
    console.log('  - metrics.reset() - Resetear métricas');
});

// ============================================
// ENVÍO AUTOMÁTICO DE MÉTRICAS A POSTGRESQL
// ============================================

metricsSystem.sendToBackend = async function() {
    const payload = {
        timestamp: new Date().toISOString(),
        sessionId: this._getSessionId(),
        userAgent: navigator.userAgent,
        tabSwitches: this.data.tabSwitches.slice(-10).map(t => ({
            time: t.timestamp,
            tab_name: t.tabName,
            duration: t.duration,
            success: t.success,
            error_msg: t.errorMsg || null
        })),
        apiCalls: this.data.apiCalls.slice(-10).map(a => ({
            time: a.timestamp,
            api_name: a.apiName,
            url: a.url,
            method: a.method,
            duration: a.duration || null,
            success: a.success,
            cached: a.cached || false,
            error_msg: a.errorMsg || null
        })),
        renderErrors: this.data.renderErrors.slice(-5).map(e => ({
            time: e.timestamp,
            component: e.component,
            error_type: e.errorType,
            details: e.details
        }))
    };

    try {
        const response = await fetch('http://localhost:5678/webhook/metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log('📊 Métricas enviadas al backend exitosamente');
        } else {
            console.warn('⚠️ Error al enviar métricas:', response.status);
        }
    } catch (err) {
        console.error('❌ Error enviando métricas a backend:', err.message);
    }
};

metricsSystem._getSessionId = function() {
    let sessionId = sessionStorage.getItem('metricsSessionId');
    if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('metricsSessionId', sessionId);
    }
    return sessionId;
};

metricsSystem.startAutoSend = function() {
    // Enviar métricas cada 30 segundos
    setInterval(() => {
        if (this.data.tabSwitches.length > 0 || this.data.apiCalls.length > 0) {
            this.sendToBackend();
        }
    }, 30000); // 30 segundos

    console.log('📊 Auto-envío de métricas activado (cada 30 segundos)');
};

// Iniciar auto-envío cuando cargue la página
document.addEventListener('DOMContentLoaded', () => {
    metricsSystem.startAutoSend();
});