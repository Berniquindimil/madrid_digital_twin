-- ============================================
-- MADRID DIGITAL TWIN - SCHEMA DE MÉTRICAS
-- ============================================

-- Habilitar TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================
-- TABLA: Cambios de Pestaña
-- ============================================
CREATE TABLE tab_switches (
    time TIMESTAMPTZ NOT NULL,
    tab_name TEXT NOT NULL,
    duration DOUBLE PRECISION NOT NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_msg TEXT,
    session_id TEXT NOT NULL,
    user_agent TEXT
);

-- Convertir a hypertable (optimización TimescaleDB)
SELECT create_hypertable('tab_switches', 'time');

-- Índices para consultas frecuentes
CREATE INDEX idx_tab_switches_tab_name ON tab_switches (tab_name, time DESC);
CREATE INDEX idx_tab_switches_session ON tab_switches (session_id, time DESC);

-- ============================================
-- TABLA: Llamadas a API
-- ============================================
CREATE TABLE api_calls (
    time TIMESTAMPTZ NOT NULL,
    api_name TEXT NOT NULL,
    url TEXT,
    method TEXT DEFAULT 'GET',
    duration DOUBLE PRECISION,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    cached BOOLEAN DEFAULT FALSE,
    error_msg TEXT,
    session_id TEXT NOT NULL
);

SELECT create_hypertable('api_calls', 'time');

CREATE INDEX idx_api_calls_api_name ON api_calls (api_name, time DESC);
CREATE INDEX idx_api_calls_session ON api_calls (session_id, time DESC);
CREATE INDEX idx_api_calls_success ON api_calls (success, time DESC);

-- ============================================
-- TABLA: Errores de Renderizado
-- ============================================
CREATE TABLE render_errors (
    time TIMESTAMPTZ NOT NULL,
    component TEXT NOT NULL,
    error_type TEXT NOT NULL,
    details JSONB,
    session_id TEXT NOT NULL
);

SELECT create_hypertable('render_errors', 'time');

CREATE INDEX idx_render_errors_type ON render_errors (error_type, time DESC);
CREATE INDEX idx_render_errors_component ON render_errors (component, time DESC);

-- ============================================
-- POLÍTICAS DE RETENCIÓN (Opcional)
-- ============================================

-- Eliminar datos antiguos (> 30 días)
SELECT add_retention_policy('tab_switches', INTERVAL '30 days');
SELECT add_retention_policy('api_calls', INTERVAL '30 days');
SELECT add_retention_policy('render_errors', INTERVAL '30 days');

-- ============================================
-- FUNCIONES AUXILIARES
-- ============================================

-- Función: Obtener resumen de métricas
CREATE OR REPLACE FUNCTION get_metrics_summary(
    start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour',
    end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    metric_type TEXT,
    metric_name TEXT,
    value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    -- Total de cambios de pestaña
    SELECT 'tab_switches'::TEXT, 'total_count'::TEXT, COUNT(*)::NUMERIC
    FROM tab_switches
    WHERE time BETWEEN start_time AND end_time

    UNION ALL

    -- Tiempo promedio de cambio de pestaña
    SELECT 'tab_switches'::TEXT, 'avg_duration_ms'::TEXT, AVG(duration)::NUMERIC
    FROM tab_switches
    WHERE time BETWEEN start_time AND end_time

    UNION ALL

    -- Total de llamadas a API
    SELECT 'api_calls'::TEXT, 'total_count'::TEXT, COUNT(*)::NUMERIC
    FROM api_calls
    WHERE time BETWEEN start_time AND end_time

    UNION ALL

    -- Tasa de éxito de API
    SELECT 'api_calls'::TEXT, 'success_rate_pct'::TEXT,
           (SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0) * 100)::NUMERIC
    FROM api_calls
    WHERE time BETWEEN start_time AND end_time

    UNION ALL

    -- Total de errores
    SELECT 'render_errors'::TEXT, 'total_count'::TEXT, COUNT(*)::NUMERIC
    FROM render_errors
    WHERE time BETWEEN start_time AND end_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANTS (Permisos)
-- ============================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO metrics_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO metrics_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO metrics_user;

-- ============================================
-- DATOS DE PRUEBA (Opcional - comentar en producción)
-- ============================================

-- Insertar algunos datos de ejemplo
INSERT INTO tab_switches (time, tab_name, duration, success, session_id, user_agent)
VALUES
    (NOW() - INTERVAL '5 minutes', 'bicis', 750.5, TRUE, 'test_session_1', 'Mozilla/5.0'),
    (NOW() - INTERVAL '4 minutes', 'parkings', 820.3, TRUE, 'test_session_1', 'Mozilla/5.0'),
    (NOW() - INTERVAL '3 minutes', 'paradas', 650.2, TRUE, 'test_session_1', 'Mozilla/5.0'),
    (NOW() - INTERVAL '2 minutes', 'rutas', 450.8, TRUE, 'test_session_1', 'Mozilla/5.0');

INSERT INTO api_calls (time, api_name, url, method, duration, success, cached, session_id)
VALUES
    (NOW() - INTERVAL '5 minutes', 'BiciMAD', 'http://localhost:5678/webhook-test/bicimad', 'GET', 423.5, TRUE, FALSE, 'test_session_1'),
    (NOW() - INTERVAL '4 minutes', 'Parkings', 'http://localhost:5678/webhook-test/parkings', 'GET', 512.3, TRUE, FALSE, 'test_session_1'),
    (NOW() - INTERVAL '3 minutes', 'BusStop', 'http://localhost:5678/webhook-test/bus-parada/62', 'GET', 234.1, TRUE, TRUE, 'test_session_1'),
    (NOW() - INTERVAL '2 minutes', 'BusStop', 'http://localhost:5678/webhook-test/bus-parada/62', 'GET', 145.2, TRUE, TRUE, 'test_session_1');

-- Verificar que todo funciona
SELECT * FROM get_metrics_summary();
