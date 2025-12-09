# Madrid Digital Twin - Movilidad en Tiempo Real

Aplicación web interactiva que visualiza en tiempo real datos de movilidad urbana de Madrid, incluyendo buses EMT, BiciMAD, parkings y rutas. El proyecto incluye un sistema completo de monitorización de KPIs con almacenamiento en TimescaleDB y visualización en Grafana.

## Características Principales

### 1. Visualización de Datos de Movilidad

#### 🚌 Buses EMT
- Búsqueda de paradas por ID
- Visualización de tiempos de llegada en tiempo real
- Identificación de paradas cercanas mediante geolocalización
- Información detallada de líneas y direcciones

#### 🚴 BiciMAD
- Mapa interactivo con todas las estaciones
- Indicadores visuales de disponibilidad por colores:
  - 🟢 Verde: Alta disponibilidad (>50%)
  - 🟠 Naranja: Media disponibilidad (20-50%)
  - 🔴 Rojo: Baja disponibilidad (<20%)
  - ⚫ Gris: Inactiva
- Datos de bicis disponibles y bases libres en tiempo real

#### 🅿️ Parkings
- Visualización de parkings públicos en Madrid
- Información de plazas disponibles en tiempo real
- Indicadores de disponibilidad:
  - 🟢 Verde: Muchas plazas (≥100)
  - 🟠 Naranja: Disponible (50-99 plazas)
  - 🔴 Rojo: Pocas plazas (<50)
  - ⚫ Gris: Completo o sin datos

#### 🗺️ Sistema de Rutas
- Cálculo de rutas entre dos puntos
- Múltiples modos de transporte:
  - 🚴 Bicicleta
  - 🚶 A pie
  - 🚗 Coche
- Integración con OpenRouteService API
- Visualización interactiva de rutas en el mapa

### 2. Panel de Clima

- 🌤️ Información meteorológica en tiempo real de Madrid
- Temperatura actual y descripción
- Recomendaciones basadas en condiciones climáticas
- Consulta de clima por zona (click en el mapa)
- Panel flotante retráctil

### 3. Sistema de Métricas y KPIs

El proyecto incluye un sistema completo de monitorización con:

#### Métricas Registradas
- ⏱️ **Tiempos de carga por pestaña**: Duración de carga de cada sección
- 🌐 **Llamadas a API**: Tracking completo de peticiones (duración, éxito/error, caché)
- ❌ **Errores de renderizado**: Registro de errores por componente
- ⚠️ **Peticiones duplicadas**: Detección de llamadas redundantes

#### Panel de Métricas Interactivo
- Visualización en tiempo real de KPIs
- Resumen rápido con estadísticas clave
- Exportación de métricas en formato JSON
- Función de reset de métricas
- Panel flotante retráctil

## Arquitectura del Sistema

### Stack Tecnológico

#### Frontend
- **HTML5/CSS3**: Interfaz moderna y responsive
- **JavaScript vanilla**: Sin dependencias de frameworks
- **Leaflet.js**: Visualización de mapas interactivos
- **Font Awesome**: Iconografía

#### Backend y Servicios
- **n8n**: Automatización de workflows y webhooks para integración de APIs
- **PostgreSQL + TimescaleDB**: Base de datos optimizada para series temporales
- **Grafana**: Visualización y análisis de KPIs
- **pgAdmin**: Administración de base de datos

#### Infraestructura
- **Docker Compose**: Orquestación de contenedores
- Servicios containerizados con health checks
- Red interna para comunicación entre servicios
- Volúmenes persistentes para datos

### Estructura de Base de Datos

#### Tablas Principales

**tab_switches** - Cambios de pestaña
```sql
- time: Timestamp
- tab_name: Nombre de la pestaña
- duration: Duración en ms
- success: Éxito/fallo
- error_msg: Mensaje de error (si aplica)
- session_id: ID de sesión
- user_agent: Navegador del usuario
```

**api_calls** - Llamadas a API
```sql
- time: Timestamp
- api_name: Nombre de la API
- url: URL completa
- method: Método HTTP
- duration: Duración en ms
- success: Éxito/fallo
- cached: Si fue servida desde caché
- error_msg: Mensaje de error (si aplica)
- session_id: ID de sesión
```

**render_errors** - Errores de renderizado
```sql
- time: Timestamp
- component: Componente afectado
- error_type: Tipo de error
- details: Detalles en formato JSONB
- session_id: ID de sesión
```

#### Optimizaciones TimescaleDB
- **Hypertables**: Tablas optimizadas para series temporales
- **Índices**: Consultas rápidas por nombre, sesión y tiempo
- **Retención automática**: Limpieza de datos >30 días
- **Funciones auxiliares**: `get_metrics_summary()` para resúmenes de métricas

## Instalación y Configuración

### Requisitos Previos

- Docker y Docker Compose instalados
- Puerto 3000 (app), 5432 (PostgreSQL), 3001 (Grafana), 5050 (pgAdmin) disponibles

### Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd madrid_digital_twin
```

2. **Levantar los servicios con Docker Compose**
```bash
docker-compose up -d
```

3. **Verificar que los servicios están corriendo**
```bash
docker-compose ps
```

### Acceso a los Servicios

#### Aplicación Web
- **URL**: `http://localhost:3000/app`
- Interfaz principal con mapa y datos de movilidad

#### Grafana (Visualización de KPIs)
- **URL**: `http://localhost:3001`
- **Usuario**: `admin`
- **Contraseña**: `admin2024`
- Dashboard para análisis de métricas en tiempo real

#### pgAdmin (Administración de Base de Datos)
- **URL**: `http://localhost:5050`
- **Email**: `admin@admin.com`
- **Contraseña**: `admin2024`

#### PostgreSQL (Base de Datos)
- **Host**: `localhost`
- **Puerto**: `5432`
- **Base de datos**: `madrid_metrics`
- **Usuario**: `metrics_user`
- **Contraseña**: `metrics_password_2024`

### Configuración de Grafana

1. Acceder a Grafana en `http://localhost:3001`
2. Ir a **Configuration → Data Sources**
3. Agregar PostgreSQL con los siguientes datos:
   - Host: `timescaledb:5432`
   - Database: `madrid_metrics`
   - User: `metrics_user`
   - Password: `metrics_password_2024`
   - SSL Mode: `disable`
4. Crear dashboards personalizados con las tablas:
   - `tab_switches`
   - `api_calls`
   - `render_errors`

#### Queries de Ejemplo para Dashboards

**Tiempo promedio de carga por pestaña**
```sql
SELECT
  time_bucket('5 minutes', time) AS bucket,
  tab_name,
  AVG(duration) as avg_duration
FROM tab_switches
WHERE $__timeFilter(time)
GROUP BY bucket, tab_name
ORDER BY bucket;
```

**Tasa de éxito de APIs**
```sql
SELECT
  time_bucket('5 minutes', time) AS bucket,
  api_name,
  SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as success_rate
FROM api_calls
WHERE $__timeFilter(time)
GROUP BY bucket, api_name
ORDER BY bucket;
```

**Errores de renderizado por tipo**
```sql
SELECT
  time_bucket('10 minutes', time) AS bucket,
  error_type,
  COUNT(*) as error_count
FROM render_errors
WHERE $__timeFilter(time)
GROUP BY bucket, error_type
ORDER BY bucket;
```

**Total de llamadas a API por minuto**
```sql
SELECT
  time_bucket('1 minute', time) AS bucket,
  COUNT(*) as total_calls
FROM api_calls
WHERE $__timeFilter(time)
GROUP BY bucket
ORDER BY bucket;
```

## Uso de la Aplicación

### Navegación

1. **Búsqueda de Buses**
   - Ingresa un ID de parada (ej: 62)
   - Click en "Buscar"
   - Visualiza tiempos de llegada en tiempo real

2. **Localización de Paradas Cercanas**
   - Click en "📍 Paradas Cercanas"
   - Permite acceso a ubicación
   - Visualiza las 5 paradas más cercanas

3. **Estaciones BiciMAD**
   - Cambiar a pestaña "🚴 BiciMAD"
   - Explora el mapa para ver disponibilidad
   - Click en marcadores para más información

4. **Parkings**
   - Cambiar a pestaña "🅿️ PARKINGS"
   - Visualiza disponibilidad en tiempo real
   - Click en marcadores para detalles

5. **Calcular Rutas**
   - Cambiar a pestaña "🗺️ RUTAS"
   - Selecciona modo de transporte
   - Click en el mapa para origen y destino
   - Click en "Calcular Ruta"

6. **Consultar Clima**
   - Panel derecho con clima de Madrid
   - Click en "Consultar Clima por Zona"
   - Click en el mapa para clima local

7. **Visualizar Métricas**
   - Click en icono de gráficas en el navbar
   - Panel lateral con KPIs en tiempo real
   - Exporta o resetea métricas según necesites

### Atajos de Teclado

- **Modo Oscuro**: Click en icono de luna en navbar

## Estructura del Proyecto

```
madrid_digital_twin/
├── app/
│   ├── index.html          # Estructura HTML principal
│   ├── script.js           # Lógica de la aplicación
│   └── styles.css          # Estilos CSS
├── docker-compose.yml      # Orquestación de servicios
├── init-db.sql            # Schema de base de datos
├── grafana/
│   └── provisioning/      # Configuración de Grafana
└── README.md              # Este archivo
```

## APIs Utilizadas

- **EMT Madrid API**: Datos de buses en tiempo real
- **BiciMAD API**: Disponibilidad de estaciones
- **Madrid Parkings API**: Plazas de parking
- **OpenWeatherMap API**: Información meteorológica
- **OpenRouteService API**: Cálculo de rutas

## Características Técnicas

### Optimizaciones
- Caché de peticiones a APIs
- Debouncing en búsquedas
- Lazy loading de datos
- Sistema de detección de peticiones duplicadas

### Responsive Design
- Adaptable a diferentes tamaños de pantalla
- Paneles flotantes retráctiles
- Interfaz optimizada para móvil y desktop

### Modo Oscuro
- Toggle para cambiar entre temas claro y oscuro
- Persistencia de preferencia del usuario

## Monitorización y Análisis

### KPIs Principales

1. **Performance**
   - Tiempo de carga de pestañas
   - Duración de llamadas a API
   - Tasa de uso de caché

2. **Fiabilidad**
   - Tasa de éxito de APIs
   - Errores de renderizado
   - Peticiones duplicadas

3. **Uso**
   - Cambios de pestaña por sesión
   - APIs más consultadas
   - Componentes con más errores

### Análisis con Grafana

- Dashboards personalizables
- Alertas en tiempo real
- Exportación de reportes
- Análisis de tendencias temporales

## Desarrollo Futuro

### Mejoras Planificadas
- [ ] Integración con más fuentes de datos de Madrid
- [ ] Sistema de notificaciones push
- [ ] Historial de rutas favoritas
- [ ] Predicción de disponibilidad con ML
- [ ] PWA para instalación móvil
- [ ] Modo offline con service workers

### Posibles Extensiones
- Integración con Metro de Madrid
- Alertas de tráfico en tiempo real
- Sistema de reserva de bicis
- Comparador de tiempos de ruta
- Análisis de patrones de movilidad

## Troubleshooting

### Los servicios no arrancan
```bash
# Ver logs de los contenedores
docker-compose logs -f

# Reiniciar servicios
docker-compose restart
```

### Error de conexión a PostgreSQL
```bash
# Verificar que el servicio está saludable
docker-compose ps

# Verificar conectividad
docker exec madrid-timescaledb pg_isready -U metrics_user
```

### No aparecen datos en Grafana
1. Verificar conexión a la base de datos
2. Comprobar que hay datos en las tablas:
```sql
SELECT COUNT(*) FROM api_calls;
SELECT COUNT(*) FROM tab_switches;
```
3. Ajustar el rango de tiempo en el dashboard

### La aplicación no carga datos
1. Verificar que n8n está corriendo (si aplica)
2. Comprobar conexión a internet
3. Revisar la consola del navegador para errores

## Contribuciones

Este es un proyecto personal de aprendizaje. Las contribuciones, issues y sugerencias son bienvenidas.

## Licencia

Este proyecto está bajo licencia MIT.

## Agradecimientos

- **EMT Madrid** - Datos de transporte público
- **BiciMAD** - Sistema de bicicletas compartidas
- **OpenStreetMap** - Datos cartográficos
- **TimescaleDB** - Base de datos de series temporales
- **Grafana** - Plataforma de visualización

---

**Desarrollado por**: Bernardo Quindimil
**Última actualización**: Diciembre 2025
