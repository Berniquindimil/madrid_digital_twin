function updateStats(trains) {
  document.getElementById('train-count').textContent = trains.length;
  document.getElementById('station-count').textContent = STATE.currentStations.length;
  document.getElementById('last-update').textContent = new Date().toLocaleTimeString('es-ES');
  document.getElementById('zoom-level').textContent = map?.getZoom() || 11;
}