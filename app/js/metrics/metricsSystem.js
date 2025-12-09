// ============================================
// SISTEMA DE MÉTRICAS Y KPIs
// ============================================

import { METRICS_CONFIG, API_CONFIG } from '../config.js';

export class MetricsSystem {
    constructor() {
        // Almacenamiento de métricas
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

        // Configuración
        this.config = {
            maxStoredMetrics: METRICS_CONFIG.MAX_STORED_METRICS,
            warningThreshold: METRICS_CONFIG.WARNING_THRESHOLD,
            errorThreshold: METRICS_CONFIG.ERROR_THRESHOLD
        };
    }

    // ============================================
    // TRACKING DE CAMBIOS DE PESTAÑA
    // ============================================

    startTabSwitch(tabName) {
        return {
            tabName,
            startTime: performance.now(),
            timestamp: new Date().toISOString()
        };
    }

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

        console.log(`[MÉTRICA] Cambio a pestaña "${trackingData.tabName}": ${duration.toFixed(2)}ms`);

        if (duration > this.config.errorThreshold) {
            console.warn(`⚠️ Tiempo de carga excesivo para "${trackingData.tabName}": ${duration.toFixed(2)}ms`);
        }

        return metric;
    }

    // ============================================
    // TRACKING DE API CALLS
    // ============================================

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
    }

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
    }

    // ============================================
    // DETECCIÓN DE DUPLICADOS
    // ============================================

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
    }

    // ============================================
    // TRACKING DE ERRORES DE RENDERIZADO
    // ============================================

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
    }

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
    }

    // ============================================
    // ESTADÍSTICAS Y REPORTING
    // ============================================

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
    }

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
    }

    // ============================================
    // EXPORTACIÓN Y PERSISTENCIA
    // ============================================

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
    }

    async sendToBackend() {
        const summary = this.getSummary();
        const payload = {
            timestamp: new Date().toISOString(),
            sessionId: this._getSessionId(),
            userAgent: navigator.userAgent,
            metrics: {
                tabSwitches: this.data.tabSwitches.slice(-10), // Últimas 10
                apiCalls: this.data.apiCalls.slice(-10),
                renderErrors: this.data.renderErrors.slice(-5),
                summary: summary
            }
        };

        try {
            const response = await fetch(API_CONFIG.METRICS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('📊 Métricas enviadas al backend');
            } else {
                console.warn('⚠️ Error al enviar métricas:', response.status);
            }
        } catch (err) {
            console.error('❌ Error enviando métricas a backend:', err);
        }
    }

    startAutoSend() {
        setInterval(() => {
            if (this.data.tabSwitches.length > 0) {
                this.sendToBackend();
            }
        }, METRICS_CONFIG.AUTO_SEND_INTERVAL);

        console.log(`📊 Auto-envío de métricas activado (cada ${METRICS_CONFIG.AUTO_SEND_INTERVAL / 1000}s)`);
    }

    // ============================================
    // CONSOLA Y DEBUG
    // ============================================

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
    }

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
    }

    // ============================================
    // UTILIDADES PRIVADAS
    // ============================================

    _limitArray(arr) {
        if (arr.length > this.config.maxStoredMetrics) {
            arr.shift();
        }
    }

    _calculateMedian(numbers) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);

        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        }

        return sorted[middle];
    }

    _groupBy(arr, key) {
        return arr.reduce((acc, item) => {
            const groupKey = item[key];
            acc[groupKey] = (acc[groupKey] || 0) + 1;
            return acc;
        }, {});
    }

    _getSessionId() {
        let sessionId = sessionStorage.getItem('metricsSessionId');
        if (!sessionId) {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('metricsSessionId', sessionId);
        }
        return sessionId;
    }
}

// Instancia singleton
export const metricsSystem = new MetricsSystem();

// Exponer globalmente para debugging
if (typeof window !== 'undefined') {
    window.metrics = metricsSystem;
}
