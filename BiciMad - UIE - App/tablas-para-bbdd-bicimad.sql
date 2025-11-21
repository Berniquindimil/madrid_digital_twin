-- Crear tabla de estaciones (información maestra)
CREATE TABLE bicimad_stations (
    station_id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    total_bases INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de disponibilidad (datos históricos)
CREATE TABLE bicimad_availability (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL,
    dock_bikes INTEGER NOT NULL,
    free_bases INTEGER NOT NULL,
    total_bases INTEGER NOT NULL,
    reservations_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    light INTEGER,
    no_available INTEGER DEFAULT 0,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES bicimad_stations(station_id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_availability_recorded_at ON bicimad_availability(recorded_at);
CREATE INDEX idx_availability_station_id ON bicimad_availability(station_id);
