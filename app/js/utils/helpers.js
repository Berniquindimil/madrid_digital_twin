// ============================================
// FUNCIONES AUXILIARES Y UTILIDADES
// ============================================

/**
 * Calcula la distancia entre dos puntos usando la fórmula de Haversine
 * @param {number} lat1 - Latitud del primer punto
 * @param {number} lon1 - Longitud del primer punto
 * @param {number} lat2 - Latitud del segundo punto
 * @param {number} lon2 - Longitud del segundo punto
 * @returns {number} Distancia en kilómetros
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
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

/**
 * Determina el color de disponibilidad para estaciones de BiciMAD
 */
export function getAvailabilityColor(station) {
    if (!station.is_active) return '#5a6470';

    const availability = (station.available_bikes / station.total_bases) * 100;

    if (availability > 50) return '#00d084';
    if (availability >= 20) return '#ffa500';
    if (availability > 0) return '#ff6b6b';
    return '#5a6470';
}

/**
 * Determina la etiqueta de disponibilidad para estaciones de BiciMAD
 */
export function getAvailabilityLabel(station) {
    if (!station.is_active) return 'Inactiva';

    const availability = (station.available_bikes / station.total_bases) * 100;

    if (availability > 50) return 'Alta';
    if (availability >= 20) return 'Media';
    if (availability > 0) return 'Baja';
    return 'Sin bicis';
}

/**
 * Determina el color de disponibilidad para parkings
 */
export function getParkingAvailabilityColor(parking) {
    if (parking.freeParking === null || typeof parking.freeParking !== 'number') {
        return '#5a6470';
    }

    const plazasLibres = parking.freeParking;

    if (plazasLibres >= 100) return '#00d084';
    if (plazasLibres >= 50) return '#ffa500';
    if (plazasLibres > 0) return '#ff6b6b';
    return '#5a6470';
}

/**
 * Determina la etiqueta de disponibilidad para parkings
 */
export function getParkingAvailabilityLabel(parking) {
    if (parking.freeParking === null || typeof parking.freeParking !== 'number') {
        return 'Sin datos';
    }

    const plazasLibres = parking.freeParking;

    if (plazasLibres >= 100) return 'Muchas plazas';
    if (plazasLibres >= 50) return 'Disponible';
    if (plazasLibres > 0) return 'Pocas plazas';
    return 'Completo';
}

/**
 * Calcula el color de texto (blanco o negro) según el color de fondo
 * para garantizar contraste legible
 */
export function getTextColor(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? '#000000' : '#ffffff';
}

/**
 * Decodifica una polyline encoded (formato de Google/OpenRouteService)
 */
export function decodePolyline(encoded) {
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

/**
 * Encuentra la estación más cercana a unas coordenadas
 */
export function findNearestStation(lat, lng, stations) {
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

/**
 * Convierte datos de Meteoblue al formato interno
 */
export function convertMeteoblueData(meteoblueData) {
    const currentTemp = meteoblueData.data_1h?.temperature?.[0] || 18;
    const currentWindSpeed = meteoblueData.data_1h?.windspeed?.[0] || 0;
    const currentPrecipitation = meteoblueData.data_1h?.precipitation?.[0] || 0;
    const pictocode = meteoblueData.data_1h?.pictocode?.[0] || 1;

    const weatherDescription = getWeatherDescription(pictocode);
    const weatherMain = getWeatherMain(pictocode);

    // Convertir windspeed de km/h a m/s
    const windSpeedMs = currentWindSpeed / 3.6;

    return {
        main: { temp: currentTemp },
        weather: [{ description: weatherDescription, main: weatherMain }],
        wind: { speed: windSpeedMs },
        rain: currentPrecipitation > 0 ? { '1h': currentPrecipitation } : null
    };
}

/**
 * Convierte pictocode de Meteoblue a descripción
 */
export function getWeatherDescription(pictocode) {
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

/**
 * Convierte pictocode de Meteoblue a categoría principal
 */
export function getWeatherMain(pictocode) {
    if (pictocode <= 2) return 'Clear';
    if (pictocode <= 4) return 'Clouds';
    if (pictocode >= 5 && pictocode <= 7) return 'Rain';
    if (pictocode === 8 || pictocode === 14) return 'Thunderstorm';
    if (pictocode >= 9 && pictocode <= 11) return 'Snow';
    if (pictocode === 12) return 'Fog';
    return 'Clear';
}

/**
 * Obtiene emoji según tipo de clima
 */
export function getWeatherEmoji(weatherMain) {
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

/**
 * Obtiene color según tipo de clima
 */
export function getWeatherColor(weatherMain) {
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

/**
 * Genera recomendación de transporte según clima
 */
export function getTransportRecommendation(weather) {
    const temp = weather.main.temp;
    const windSpeed = weather.wind.speed;
    const isRaining = weather.rain !== null && weather.rain !== undefined;

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

    // Condiciones aceptables
    return {
        html: `🚴 <strong>Recomendación: BiciMAD</strong><br><span style="font-size: 11px;">Condiciones aceptables para bici.</span>`,
        color: 'rgba(255, 165, 0, 0.2)',
        textColor: '#ffa500'
    };
}
