// ═══════════════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS — add these to index.js alongside planRoute()
// ═══════════════════════════════════════════════════════════════════════

// Populate location suggestions datalist from the LOCATIONS dictionary
function populateLocationSuggestions() {
  const dl = document.getElementById("locationSuggestions");
  if (!dl) return;
  Object.keys(LOCATIONS).forEach(loc => {
    const o = document.createElement("option");
    o.value = loc;
    dl.appendChild(o);
  });
}

// Swap the From and To inputs
function swapLocations() {
  const from = document.getElementById("fromLocation");
  const to   = document.getElementById("toLocation");
  if (!from || !to) return;
  const temp = from.value;
  from.value = to.value;
  to.value   = temp;
}

// Set a quick-preset route and trigger search
function setRoute(from, to) {
  const fromEl = document.getElementById("fromLocation");
  const toEl   = document.getElementById("toLocation");
  if (fromEl) fromEl.value = from;
  if (toEl)   toEl.value   = to;
  planRoute();
}

// Allow pressing Enter in either input to trigger plan
function initRouteInputListeners() {
  ["fromLocation","toLocation"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("keydown", e => { if (e.key === "Enter") planRoute(); });
  });
}

// Call initRouteInputListeners() inside your DOMContentLoaded handler

// Expanded LOCATIONS dictionary — add more Barbados locations here
const LOCATIONS = {
  "Oistins":          [13.0679, -59.5396],
  "Black Rock":       [13.1001, -59.6330],
  "Bridgetown":       [13.1006, -59.6146],
  "Speightstown":     [13.2504, -59.6478],
  "Holetown":         [13.1853, -59.6402],
  "Six Cross Roads":  [13.1516, -59.5684],
  "The Garden":       [13.1765, -59.5912],
  "Worthing":         [13.0742, -59.5882],
  "Rockley":          [13.0808, -59.5733],
  "Christ Church":    [13.0760, -59.5690],
  "St. Philip":       [13.1098, -59.4800],
  "St. Joseph":       [13.2014, -59.5548],
  "Bathsheba":        [13.2143, -59.5270],
  "Crane":            [13.0898, -59.4710],
  "Sam Lords Castle": [13.0900, -59.4700],
  "Grantley Adams":   [13.0747, -59.4927],
  "Wildey":           [13.0933, -59.5798],
  "Warrens":          [13.1196, -59.6276],
  "Welches":          [13.0987, -59.6315],
  "Ellerton":         [13.1485, -59.5680],
  "St. George":       [13.1460, -59.5610],
  "Kendal":           [13.1800, -59.5760],
  "Haggatt Hall":     [13.1143, -59.6011],
  "Pine":             [13.0903, -59.5921],
  "Whitepark":        [13.0963, -59.6198],
  "Deacons Road":     [13.0920, -59.6185],
};
