// ═══════════════════════════════════════════════════════════════════════
//  GPS ROUTING MODULE — drop this into index.js, replacing planRoute()
//  Uses: Nominatim (geocoding) + OSRM (routing) + Leaflet (maps)
//  All free, no API key required.
// ═══════════════════════════════════════════════════════════════════════

let routeMapInstance  = null;   // Leaflet map for the route result
let mainRouteLayer    = null;   // Polyline for primary route
let altRouteLayer     = null;   // Polyline for alternative route
let routeMarkers      = [];     // Start / end / pothole markers

// ── Haversine distance between two lat/lng points (returns km) ─────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Minimum distance from a point to a polyline (array of [lat,lng]) ──
function pointToPolylineDistance(lat, lng, polyline) {
  let minDist = Infinity;
  for (const [pLat, pLng] of polyline) {
    const d = haversine(lat, lng, pLat, pLng);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// ── Geocode a place name using Nominatim (OpenStreetMap, free) ─────────
async function geocode(placeName) {
  // Always append Barbados to focus results on the island
  const query = `${placeName}, Barbados`;
  const url   = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res   = await fetch(url, { headers: { "Accept-Language": "en" } });
  const data  = await res.json();
  if (!data.length) throw new Error(`Location not found: "${placeName}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

// ── Get a driving route from OSRM (free demo server) ──────────────────
// Returns { geometry: [[lat,lng],...], distanceKm, durationMin, steps }
async function getRoute(fromLatLng, toLatLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/` +
              `${fromLatLng.lng},${fromLatLng.lat};${toLatLng.lng},${toLatLng.lat}` +
              `?overview=full&geometries=geojson&steps=true`;
  const res  = await fetch(url);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes.length) throw new Error("No route found between those locations.");
  const route = data.routes[0];
  // GeoJSON coordinates are [lng, lat] — swap to [lat, lng] for Leaflet
  const geometry = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const steps = route.legs[0].steps.map(s => ({
    instruction: s.maneuver.type + (s.name ? ` onto ${s.name}` : ""),
    distanceM:   Math.round(s.distance),
  }));
  return {
    geometry,
    distanceKm:  (route.distance / 1000).toFixed(2),
    durationMin: Math.round(route.duration / 60),
    steps,
  };
}

// ── Match roads.json entries that are near a route polyline ───────────
// proximity threshold: 0.8 km (tunable)
function matchRoadsToRoute(routeGeometry, threshold = 0.8) {
  if (!roadsData.length) return [];
  return roadsData.filter(road => {
    const coords = ROAD_COORDS[road.name];
    if (!coords) return false;
    const dist = pointToPolylineDistance(coords[0], coords[1], routeGeometry);
    return dist <= threshold;
  });
}

// ── Calculate a severity score for a set of matched roads ─────────────
// Weighted: deep=3, medium=2, shallow=1
function severityScore(roads) {
  return roads.reduce((score, r) => {
    return score + r.potholes.deep * 3 + r.potholes.medium * 2 + r.potholes.shallow * 1;
  }, 0);
}

// ── Build a human-readable pothole summary for the notification ────────
function buildPotholeSummary(roads) {
  if (!roads.length) return "No monitored roads with pothole data were found on this route.";
  const totalDeep   = roads.reduce((s, r) => s + r.potholes.deep,    0);
  const totalMed    = roads.reduce((s, r) => s + r.potholes.medium,  0);
  const totalShall  = roads.reduce((s, r) => s + r.potholes.shallow, 0);
  const total       = totalDeep + totalMed + totalShall;
  const roadNames   = roads.map(r => r.name).join(", ");
  return `${total} potholes detected across monitored roads on this route ` +
         `(${totalDeep} deep · ${totalMed} medium · ${totalShall} shallow). ` +
         `Roads affected: ${roadNames}.`;
}

// ── Initialise or reuse the route Leaflet map ──────────────────────────
function ensureRouteMap() {
  const container = document.getElementById("routeMapContainer");
  if (!container) return null;
  container.hidden = false;
  if (!routeMapInstance) {
    routeMapInstance = L.map("routeMapContainer", { scrollWheelZoom: true })
      .setView([13.1939, -59.5432], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(routeMapInstance);
  } else {
    // Clean up previous layers
    if (mainRouteLayer) routeMapInstance.removeLayer(mainRouteLayer);
    if (altRouteLayer)  routeMapInstance.removeLayer(altRouteLayer);
    routeMarkers.forEach(m => routeMapInstance.removeLayer(m));
    routeMarkers = [];
  }
  return routeMapInstance;
}

// ── Draw pothole marker circles on the map ─────────────────────────────
function drawPotholeMarkers(map, matchedRoads) {
  matchedRoads.forEach(road => {
    const coords = ROAD_COORDS[road.name];
    if (!coords) return;
    const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;
    const color = total > 30 ? "#e74c3c" : total > 15 ? "#e67e22" : "#f1c40f";
    const m = L.circleMarker(coords, {
      radius: 10 + Math.min(road.potholes.deep, 8),
      fillColor: color, color: "#fff", weight: 2,
      opacity: 1, fillOpacity: 0.85,
    }).addTo(map);
    m.bindPopup(
      `<strong>${road.name}</strong><br>` +
      `🟡 Shallow: ${road.potholes.shallow} &nbsp; ` +
      `🟠 Medium: ${road.potholes.medium} &nbsp; ` +
      `🔴 Deep: ${road.potholes.deep}<br>` +
      `Total: <strong>${total}</strong>`
    );
    routeMarkers.push(m);
  });
}

// ── Show the warning popup / banner ───────────────────────────────────
function showPotholeWarning(summary, altRoad, fromName, toName) {
  const banner = document.getElementById("routeWarningBanner");
  const msg    = document.getElementById("routeWarningMsg");
  const altBtn = document.getElementById("routeAltBtn");
  if (!banner) return;

  msg.textContent = `⚠ High pothole activity detected on the ${fromName} → ${toName} route. ${summary}`;

  if (altRoad) {
    altBtn.hidden = false;
    altBtn.textContent = `✅ Show Alternative: ${altRoad.name} (${altRoad.potholes.shallow + altRoad.potholes.medium + altRoad.potholes.deep} potholes)`;
    altBtn.onclick = () => highlightAltRoute(altRoad);
  } else {
    altBtn.hidden = true;
  }
  banner.hidden = false;
  banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideWarning() { const b = document.getElementById("routeWarningBanner"); if (b) b.hidden = true; }

// ── Highlight alternative road on the map ─────────────────────────────
function highlightAltRoute(altRoad) {
  if (!routeMapInstance) return;
  if (altRouteLayer) routeMapInstance.removeLayer(altRouteLayer);
  const coords = ROAD_COORDS[altRoad.name];
  if (!coords) return;
  // Draw a circle around the alternative road location
  altRouteLayer = L.circleMarker(coords, {
    radius: 20, fillColor: "#2ecc71", color: "#fff",
    weight: 3, opacity: 1, fillOpacity: 0.3,
  }).addTo(routeMapInstance);
  altRouteLayer.bindPopup(
    `<strong>✅ Recommended Alternative</strong><br>` +
    `${altRoad.name}<br>` +
    `${altRoad.potholes.shallow + altRoad.potholes.medium + altRoad.potholes.deep} total potholes`
  ).openPopup();
  routeMapInstance.setView(coords, 13, { animate: true });
}

// ── Build the turn-by-turn directions HTML ─────────────────────────────
function buildDirectionsHTML(steps, distanceKm, durationMin) {
  const icons = { turn: "↱", straight: "↑", "turn-right": "↱", "turn-left": "↰",
                  arrive: "📍", depart: "🟢", roundabout: "🔄" };
  const rows = steps.map(s => {
    const icon = icons[s.instruction.split(" ")[0]] || "→";
    const dist = s.distanceM >= 1000
      ? `${(s.distanceM/1000).toFixed(1)} km`
      : `${s.distanceM} m`;
    return `<div class="dirStep">
      <span class="dirIcon">${icon}</span>
      <span class="dirText">${s.instruction}</span>
      <span class="dirDist">${dist}</span>
    </div>`;
  }).join("");
  return `<div class="dirHeader">
    <strong>📍 ${distanceKm} km</strong> &nbsp;·&nbsp; <strong>⏱ ${durationMin} min</strong>
  </div>${rows}`;
}

// ══ MAIN planRoute FUNCTION ════════════════════════════════════════════
async function planRoute() {
  const fromInput = document.getElementById("fromLocation");
  const toInput   = document.getElementById("toLocation");
  const statusEl  = document.getElementById("routeStatus");
  const resultsEl = document.getElementById("routeResults");

  const fromName = fromInput?.value.trim();
  const toName   = toInput?.value.trim();

  if (!fromName || !toName) {
    statusEl.textContent = "⚠ Please enter both a start location and a destination.";
    return;
  }
  if (fromName.toLowerCase() === toName.toLowerCase()) {
    statusEl.textContent = "⚠ Start and destination cannot be the same.";
    return;
  }

  // Show loading state
  statusEl.innerHTML = '<span class="loadingDots">🔍 Finding route<span>.</span><span>.</span><span>.</span></span>';
  resultsEl.innerHTML = "";
  hideWarning();

  try {
    // ── 1. Geocode both locations ──────────────────────────────────────
    statusEl.textContent = "📍 Locating addresses on Barbados...";
    const [fromCoords, toCoords] = await Promise.all([
      geocode(fromName),
      geocode(toName),
    ]);

    // ── 2. Get route from OSRM ─────────────────────────────────────────
    statusEl.textContent = "🛣 Calculating driving route...";
    const route = await getRoute(fromCoords, toCoords);

    // ── 3. Match roads near the route ──────────────────────────────────
    statusEl.textContent = "🕳 Checking pothole data...";
    const matchedRoads = matchRoadsToRoute(route.geometry);

    // ── 4. Score severity ──────────────────────────────────────────────
    const score = severityScore(matchedRoads);
    const isHighRisk = score > 15;   // Tune this threshold as needed
    const summary = buildPotholeSummary(matchedRoads);

    // ── 5. Find best alternative (lowest severity among all roads) ─────
    const altRoad = [...roadsData]
      .filter(r => !matchedRoads.includes(r))
      .sort((a, b) => {
        const sa = a.potholes.deep*3 + a.potholes.medium*2 + a.potholes.shallow;
        const sb = b.potholes.deep*3 + b.potholes.medium*2 + b.potholes.shallow;
        return sa - sb;
      })[0] || null;

    // ── 6. Render results HTML ─────────────────────────────────────────
    const riskClass = isHighRisk ? "routeRiskHigh" : score > 5 ? "routeRiskMed" : "routeRiskLow";
    const riskLabel = isHighRisk ? "🔴 High Risk" : score > 5 ? "🟠 Medium Risk" : "🟢 Low Risk";

    resultsEl.innerHTML = `
      <!-- Warning banner (hidden until needed) -->
      <div id="routeWarningBanner" class="routeWarning" hidden role="alert" aria-live="assertive">
        <p id="routeWarningMsg"></p>
        <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
          <button id="routeAltBtn" class="searchBtn" style="padding:8px 16px;font-size:14px" hidden></button>
          <button onclick="hideWarning()" class="browseBtn" style="padding:8px 14px;font-size:14px">Dismiss</button>
        </div>
      </div>

      <!-- Route summary card -->
      <div class="resultCard ${riskClass}" style="border-left-width:5px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <h3>🗺 ${fromName} → ${toName}</h3>
            <p style="margin-top:4px;font-size:15px">
              <strong>${route.distanceKm} km</strong> &nbsp;·&nbsp;
              <strong>~${route.durationMin} min</strong> driving
            </p>
          </div>
          <span class="routeRiskBadge ${riskClass}">${riskLabel} &nbsp; Score: ${score}</span>
        </div>
        <p style="margin-top:10px;font-size:14px;color:var(--muted)">${summary}</p>
      </div>

      <!-- Map -->
      <div class="resultCard" style="padding:16px">
        <h3 style="margin-bottom:10px">Interactive Route Map</h3>
        <p class="hintText">Click pothole markers for road details. Red = high potholes, orange = medium, yellow = low.</p>
        <div id="routeMapContainer" class="mapContainer" style="height:380px"></div>
      </div>

      <!-- Turn-by-turn directions -->
      <div class="resultCard">
        <h3 style="margin-bottom:10px">Turn-by-Turn Directions</h3>
        <div id="directionsPanel" class="directionsPanel">
          ${buildDirectionsHTML(route.steps, route.distanceKm, route.durationMin)}
        </div>
      </div>

      <!-- Pothole breakdown table -->
      ${matchedRoads.length ? `
      <div class="resultCard">
        <h3 style="margin-bottom:10px">Pothole Breakdown — Roads on This Route</h3>
        <div style="overflow-x:auto">
          <table class="dataTable">
            <thead><tr><th>Road</th><th>Type</th><th>🟡 Shallow</th><th>🟠 Medium</th><th>🔴 Deep</th><th>Total</th><th>Risk</th></tr></thead>
            <tbody>
              ${matchedRoads.map(r => {
                const t = r.potholes.shallow + r.potholes.medium + r.potholes.deep;
                const s = r.potholes.deep*3 + r.potholes.medium*2 + r.potholes.shallow;
                const risk = s > 15 ? "🔴 High" : s > 5 ? "🟠 Medium" : "🟢 Low";
                return `<tr>
                  <td><strong>${r.name}</strong></td>
                  <td>${r.type}</td>
                  <td>${r.potholes.shallow}</td>
                  <td>${r.potholes.medium}</td>
                  <td>${r.potholes.deep}</td>
                  <td><strong>${t}</strong></td>
                  <td>${risk}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>` : ""}

      <!-- Alternative route suggestion -->
      ${altRoad ? `
      <div class="resultCard routeRiskLow" style="border-left-width:5px">
        <h3>✅ Recommended Alternative Road</h3>
        <p style="margin-top:6px"><strong>${altRoad.name}</strong> — ${altRoad.type} · ${altRoad.lengthKm} km</p>
        <p style="font-size:14px;color:var(--muted);margin-top:4px">
          Only ${altRoad.potholes.shallow + altRoad.potholes.medium + altRoad.potholes.deep} total potholes
          (${altRoad.potholes.deep} deep · ${altRoad.potholes.medium} medium · ${altRoad.potholes.shallow} shallow).
        </p>
        <button class="searchBtn" onclick="highlightAltRoute(roadsData.find(r=>r.name==='${altRoad.name}'))"
                style="margin-top:10px;padding:9px 20px;font-size:14px">
          Show on Map →
        </button>
      </div>` : ""}`;

    // ── 7. Draw map ────────────────────────────────────────────────────
    setTimeout(() => {
      const map = ensureRouteMap();
      if (!map) return;

      // Start / end markers
      const startMarker = L.marker([fromCoords.lat, fromCoords.lng])
        .addTo(map)
        .bindPopup(`<strong>🟢 Start: ${fromName}</strong><br>${fromCoords.display}`);
      const endMarker = L.marker([toCoords.lat, toCoords.lng])
        .addTo(map)
        .bindPopup(`<strong>🔴 Destination: ${toName}</strong><br>${toCoords.display}`);
      routeMarkers.push(startMarker, endMarker);

      // Route polyline — colour by risk
      const routeColor = isHighRisk ? "#e74c3c" : score > 5 ? "#e67e22" : "#2ecc71";
      mainRouteLayer = L.polyline(route.geometry, {
        color: routeColor, weight: 5, opacity: 0.82,
      }).addTo(map);

      // Pothole markers
      drawPotholeMarkers(map, matchedRoads);

      // Fit map to the route
      const bounds = L.latLngBounds(route.geometry);
      map.fitBounds(bounds, { padding: [30, 30] });
      map.invalidateSize();
    }, 100);

    // ── 8. Show warning notification if high risk ──────────────────────
    statusEl.textContent = `✔ Route loaded: ${fromName} → ${toName} · ${route.distanceKm} km`;
    if (isHighRisk) {
      setTimeout(() => showPotholeWarning(summary, altRoad, fromName, toName), 400);
    }

  } catch (err) {
    statusEl.textContent = `⚠ ${err.message}`;
    console.error("planRoute error:", err);
  }
}

