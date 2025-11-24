function updateMarker(train) {
  const key = train.id;
  const popup = `<div><strong>${train.id}</strong><br>Línea: ${train.line}<br>Velocidad: ${train.speed} km/h</div>`;
  
  if (!STATE.markers.has(key)) {
    const marker = L.marker([train.lat, train.lon]).bindPopup(popup);
    clusterGroup.addLayer(marker);
    STATE.markers.set(key, marker);
  } else {
    STATE.markers.get(key).setLatLng([train.lat, train.lon]).setPopupContent(popup);
  }
}

function shouldShowTrain(line) { return true; }
function removeOldMarkers(ids) { }
function updateStations(stations) { }
function updateHeatmap() { }