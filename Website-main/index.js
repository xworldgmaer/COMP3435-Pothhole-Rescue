const TUT_STEPS = 6;
// ═══ STATE ══════════════════════════════════════════════════════════

let roadsData = [];
let distanceUnit = "km";
let currencyUnit = "USD";
let soundEnabled = false;
let densityThreshold = 5;
let deepThreshold = 50;
let costThreshold = 500;
let currentRoadLoaded = null;
let tutStep = 0;


// Map instances
let homeMapInstance = null;
let planMapInstance = null;
let planMapMarker  = null;
let homeMapMarker  = null;
let decayChartInst = null;
let potholesChartInst = null;
let typeChartInst  = null;

// Barbados approximate centre
const BARBADOS = [13.1939, -59.5432];

// Road approximate coordinates (lat/lng) for map markers
const ROAD_COORDS = {
  "ABC Highway":           [13.1050, -59.6150],
  "Spring Garden Highway": [13.1200, -59.6280],
  "Ronald Mapp Highway":   [13.1800, -59.5600],
  "Martindales Road":      [13.0950, -59.6100],
  "Dukes Road":            [13.2100, -59.5800],
  "Coastal Road":          [13.0750, -59.5200],
  "Hilltop Road":          [13.2400, -59.5500]
};

// ═══ LOAD DATA ══════════════════════════════════════════════════════
fetch("roads.json")
  .then(r => r.json())
  .then(data => {
    roadsData = data.roads;
    populateDatalist();
    populateRoadPicker();
    updateReportsTab(roadsData);
    updateTeamTab();
    updateHomeStats();
    initHomeMap();
  })
  .catch(() => setStatus("⚠ Could not load road data. Please refresh the page."));

// ═══ HOME MAP ═══════════════════════════════════════════════════════
function initHomeMap() {
  if (homeMapInstance) return;
  homeMapInstance = L.map("homeMap", { zoomControl: true, scrollWheelZoom: false })
    .setView(BARBADOS, 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(homeMapInstance);

  // Drop all road markers on home map
  roadsData.forEach(r => {
    const coords = ROAD_COORDS[r.name];
    if (!coords) return;
    const total = r.potholes.shallow + r.potholes.medium + r.potholes.deep;
    const color = total > 30 ? "#e74c3c" : total > 15 ? "#e67e22" : "#2ecc71";
    const marker = L.circleMarker(coords, {
      radius: 10, fillColor: color, color: "#fff",
      weight: 2, opacity: 1, fillOpacity: 0.85
    }).addTo(homeMapInstance);
    marker.bindPopup(`<strong>${r.name}</strong><br>Type: ${r.type}<br>Potholes: ${total}<br><button onclick="loadRoad('${r.name}')" style="margin-top:6px;padding:4px 10px;background:#162DB0;color:#fff;border:none;border-radius:6px;cursor:pointer;">Analyse Road →</button>`);
  });
}

// ═══ PLAN MAP ═══════════════════════════════════════════════════════
function initPlanMap() {
  const wrap = document.getElementById("planMapWrap");
  if (!wrap) return;
  wrap.hidden = false;
  if (!planMapInstance) {
    planMapInstance = L.map("planMapWrap", { zoomControl: true, scrollWheelZoom: true })
      .setView(BARBADOS, 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18
    }).addTo(planMapInstance);
  }
}

function focusMapOnRoad(road) {
  initPlanMap();
  const coords = ROAD_COORDS[road.name] || BARBADOS;
  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;
  const color = total > 30 ? "#e74c3c" : total > 15 ? "#e67e22" : "#2ecc71";

  if (planMapMarker) planMapInstance.removeLayer(planMapMarker);
  planMapMarker = L.circleMarker(coords, {
    radius: 14, fillColor: color, color: "#fff",
    weight: 3, opacity: 1, fillOpacity: 0.9
  }).addTo(planMapInstance);
  planMapMarker.bindPopup(`<strong>${road.name}</strong><br>${road.type}<br>Potholes: ${total}`).openPopup();
  planMapInstance.setView(coords, 13, { animate: true, duration: 1 });

  // Also update home map highlight
  if (homeMapInstance) {
    if (homeMapMarker) homeMapInstance.removeLayer(homeMapMarker);
    homeMapMarker = L.circleMarker(coords, {
      radius: 16, fillColor: "#162DB0", color: "#ffcc00",
      weight: 3, opacity: 1, fillOpacity: 0.8
    }).addTo(homeMapInstance);
    homeMapMarker.bindPopup(`<strong>${road.name}</strong> — currently selected`).openPopup();
  }
}

// ═══ HOME STATS ═════════════════════════════════════════════════════
function updateHomeStats() {
  const totalPotholes = roadsData.reduce((s, r) =>
    s + r.potholes.shallow + r.potholes.medium + r.potholes.deep, 0);
  const resurfaced = roadsData.filter(r => r.wasResurfaced).length;
  animateCount("statRoads",     roadsData.length);
  animateCount("statPotholes",  totalPotholes);
  animateCount("statResurfaced", resurfaced);
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = Math.max(1, Math.floor(target / 40));
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(interval);
  }, 30);
}

// ═══ NAVIGATION ═════════════════════════════════════════════════════
function showScreen(tabId) {
  document.querySelectorAll(".tabPanel").forEach(p => { p.hidden = true; p.classList.remove("active"); });
  const tab = document.getElementById(tabId);
  if (!tab) return;
  tab.hidden = false;
  tab.classList.add("active");

  document.querySelectorAll(".menuButton button").forEach(b => b.classList.remove("activeBtn"));
  const active = document.querySelector(`.menuButton button[data-tab="${tabId}"]`);
  if (active) active.classList.add("activeBtn");

  // Re-invalidate maps when switching to a tab that contains one
  if (tabId === "homeTab" && homeMapInstance) setTimeout(() => homeMapInstance.invalidateSize(), 100);
  if (tabId === "planTab" && planMapInstance) setTimeout(() => planMapInstance.invalidateSize(), 100);

  playSound();
  vibrateAlert();
  closeMobileMenu();
}

function applyRoleView() {
  const role = sessionStorage.getItem('loggedInRole');
  const user = sessionStorage.getItem('loggedInUser');
  const welcome = document.getElementById('userGreeting');
  const hiddenTabs = ['costTab', 'decayTab', 'numberTab', 'summaryTab', 'reportsTab'];
  const showAll = role && role !== 'Customer';

  if (welcome) {
    if (user) {
      const displayRole = role === 'Administrator' ? 'Admin' : role === 'IT Staff' ? 'IT Staff' : role === 'Government' ? 'Government' : 'Driver';
      welcome.textContent = `Welcome back, ${displayRole} ${user}!`;
    } else {
      welcome.textContent = 'Welcome to Pothole Rescue — plan safer routes or sign in to review road data.';
    }
  }

  hiddenTabs.forEach(id => {
    const button = document.querySelector(`.menuButton button[data-tab="${id}"]`);
    const tab = document.getElementById(id);
    if (button) button.style.display = showAll ? '' : 'none';
    if (tab && !showAll) tab.hidden = true;
  });

  document.querySelectorAll('.homeCard').forEach(card => {
    const allowed = card.dataset.role ? card.dataset.role.split(',') : ['all'];
    if (allowed.includes('all')) {
      card.hidden = false;
      return;
    }
    card.hidden = !user || !allowed.includes(role);
  });

  // Update nav about link based on role
  const aboutNavLink = document.getElementById('aboutNavLink');
  if (aboutNavLink) {
    if (role === 'Customer') {
      aboutNavLink.textContent = 'About US';
      aboutNavLink.onclick = function() { showScreen('companyAboutTab'); closeMobileMenu(); };
    } else {
      aboutNavLink.textContent = 'About Road';
      aboutNavLink.onclick = function() { showScreen('aboutTab'); closeMobileMenu(); };
    }
  }
}

// ═══ MOBILE MENU ════════════════════════════════════════════════════
function toggleMobileMenu() {
  const nav = document.getElementById("navLinks");
  const btn = document.getElementById("hamburger");
  const open = nav.classList.toggle("navOpen");
  btn.setAttribute("aria-expanded", String(open));
}
function closeMobileMenu() {
  const nav = document.getElementById("navLinks");
  const btn = document.getElementById("hamburger");
  nav.classList.remove("navOpen");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

// ═══ ROAD PICKER MODAL ══════════════════════════════════════════════
function openRoadPicker() {
  const modal = document.getElementById("roadPickerModal");
  modal.hidden = false;
  document.getElementById("pickerSearch").focus();
  document.body.style.overflow = "hidden";
}
function closeRoadPicker() {
  document.getElementById("roadPickerModal").hidden = true;
  document.body.style.overflow = "";
}
function populateRoadPicker() {
  renderPickerList(roadsData);
}
function renderPickerList(list) {
  const container = document.getElementById("roadPickerList");
  if (!container) return;
  container.innerHTML = list.map(r => {
    const total = r.potholes.shallow + r.potholes.medium + r.potholes.deep;
    const badgeClass = total > 30 ? "badgeDanger" : total > 15 ? "badgeWarn" : "badgeSafe";
    return `
      <div class="pickerItem" role="option" tabindex="0"
           onclick="selectRoadFromPicker('${r.name}')"
           onkeydown="if(event.key==='Enter')selectRoadFromPicker('${r.name}')">
        <div class="pickerItemMain">
          <strong>${r.name}</strong>
          <span class="pickerType">${r.type}</span>
        </div>
        <span class="pickerBadge ${badgeClass}">${total} potholes</span>
      </div>`;
  }).join("");
}
function filterRoadPicker() {
  const q = document.getElementById("pickerSearch").value.toLowerCase();
  const filtered = roadsData.filter(r => r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));
  renderPickerList(filtered);
}
function selectRoadFromPicker(name) {
  document.getElementById("roadSearch").value = name;
  closeRoadPicker();
  handleSearch();
  showScreen("planTab");
}

// ═══ TUTORIAL MODAL ═════════════════════════════════════════════════
function openTutorial() {
  tutStep = 0;
  renderTutStep();
  buildTutDots();
  document.getElementById("tutorialModal").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeTutorial() {
  const modal = document.getElementById("tutorialModal");
  if (!modal || modal.hidden) return;

  localStorage.setItem("tutorialCompleted", "true");
  modal.classList.add("fadeOut");

  setTimeout(() => {
    modal.hidden = true;
    document.body.style.overflow = "";
    modal.classList.remove("fadeOut");
  }, 300);
}
function buildTutDots() {
  const dots = document.getElementById("tutDots");
  dots.innerHTML = Array.from({length: TUT_STEPS}, (_, i) =>
    `<span class="tutDot ${i===0?'tutDotActive':''}" onclick="goTutStep(${i})"></span>`
  ).join("");
}
function renderTutStep() {
  for (let i = 0; i < TUT_STEPS; i++) {
    const slide = document.getElementById(`tutSlide${i}`);
    if (slide) slide.hidden = (i !== tutStep);
  }
  document.getElementById("tutPrev").disabled = tutStep === 0;
  const nextBtn = document.getElementById("tutNext");
  nextBtn.textContent = tutStep === TUT_STEPS - 1 ? "Finish ✓" : "Next →";
  document.querySelectorAll(".tutDot").forEach((d, i) => {
    d.classList.toggle("tutDotActive", i === tutStep);
  });
}
function nextTutStep() {
  console.log("Next step clicked:", tutStep);
  if (tutStep < TUT_STEPS - 1) { tutStep++; renderTutStep(); }
  else {
    console.log("Closing tutorial...");
    closeTutorial();
  }

  function resetTutorial() {
  localStorage.removeItem("tutorialCompleted");
  openTutorial();
}
}
function prevTutStep() { if (tutStep > 0) { tutStep--; renderTutStep(); } }
function goTutStep(i) { tutStep = i; renderTutStep(); }

// Close modals on overlay click
document.addEventListener("DOMContentLoaded", () => {
  // Only open tutorial if not completed
  if (localStorage.getItem("tutorialCompleted") !== "true") {
    openTutorial();
  }

  ["roadPickerModal","tutorialModal"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", e => {
      if (e.target === el) {
        if (id === "tutorialModal") {
          closeTutorial();
        } else {
          el.hidden = true;
          document.body.style.overflow = "";
        }
      }
    });
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeRoadPicker();
      closeTutorial();
      closeMobileMenu();
    }
  });
});

// ═══ DATALIST ═══════════════════════════════════════════════════════
function populateDatalist() {
  const dl = document.getElementById("roadSuggestions");
  if (!dl) return;
  roadsData.forEach(r => { const o = document.createElement("option"); o.value = r.name; dl.appendChild(o); });
}

function liveFilter() {
  const q = document.getElementById("roadSearch").value.trim().toLowerCase();
  if (!q) return;
  const match = roadsData.find(r => r.name.toLowerCase().includes(q));
  if (match) document.getElementById("roadSearch").value = match.name;
}

// ═══ SEARCH ═════════════════════════════════════════════════════════
function getCurrentRoad() {
  const q = document.getElementById("roadSearch").value.trim().toLowerCase();
  if (!q) return null;
  return roadsData.find(r => r.name.toLowerCase().includes(q));
}

function handleSearch() {
  const road = getCurrentRoad();
  if (!road) { setStatus("⚠ Road not found. Try browsing the list."); return; }
  if (road.lengthKm > 10) { setStatus(`⚠ ${road.name} exceeds the 10 km maximum.`); return; }

  currentRoadLoaded = road;
  updateCalculations(road);
  updateAboutRoad(road);
  updateCostTab(road);
  updateDecayTab(road);
  updateDecayVisualiser(road);
  updateNumberTab(road);
  updateSummaryTab(road);
  focusMapOnRoad(road);

  ["densityOutput","avgDistanceOutput","depthPercentOutput","costDecisionOutput","decayOutput","reportOutput"]
    .forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = false;
      setTimeout(() => el.classList.add("cardVisible"), i * 80);
    });

  setStatus(`✔ Loaded: ${road.name} (${road.type}, ${road.lengthKm} km)`);
}

function loadRoad(name) {
  document.getElementById("roadSearch").value = name;
  handleSearch();
  showScreen("planTab");
}

// ═══ CALCULATIONS ═══════════════════════════════════════════════════
function updateCalculations(road) {
  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;
  if (total === 0) { setStatus(`${road.name} has no recorded potholes this year.`); return; }

  const lenConv   = convertDistance(road.lengthKm);
  const density   = total / lenConv;
  const avgDist   = convertDistance(road.lengthKm / total);
  const uLabel    = distanceUnit === "miles" ? "miles" : "km";
  const dUnit     = distanceUnit === "miles" ? "potholes/mile" : "potholes/km";
  const sPct = (road.potholes.shallow / total * 100);
  const mPct = (road.potholes.medium  / total * 100);
  const dPct = (road.potholes.deep    / total * 100);

  const repairCost    = road.potholes.shallow * road.costs.repairPerShallow
                      + road.potholes.medium  * road.costs.repairPerMedium
                      + road.potholes.deep    * road.costs.repairPerDeep;
  const resurfaceCost = road.lengthKm * road.costs.resurfacePerKm;
  const decision      = repairCost > 1000 ? "Resurface" : "Repair";
  const sym = currencySymbol();

  const alerts = [];
  if (density > densityThreshold) alerts.push(`⚠ Density exceeds ${densityThreshold} ${dUnit}.`);
  if (dPct > deepThreshold) alerts.push(`⚠ Deep potholes (${dPct.toFixed(1)}%) exceed ${deepThreshold}%.`);
  if (Math.abs(repairCost - resurfaceCost) > costThreshold)
    alerts.push(`⚠ Cost gap ${sym}${Math.abs(repairCost - resurfaceCost).toFixed(2)} exceeds threshold.`);
  if (alerts.length) setStatus(alerts.join(" "));

  const depthCard = document.getElementById("depthPercentOutput");
  if (depthCard) depthCard.className = "resultCard cardSlide " + (dPct > 50 ? "healthBad" : dPct > 30 ? "healthMedium" : "healthGood");

  setText("densityOutput",      `📍 Density: ${density.toFixed(2)} ${dUnit} · Total: ${total} potholes`);
  setText("avgDistanceOutput",  `📏 Average distance between potholes: ${avgDist.toFixed(2)} ${uLabel}`);
  setText("depthPercentOutput", `🕳 Depth: ${sPct.toFixed(1)}% shallow · ${mPct.toFixed(1)}% medium · ${dPct.toFixed(1)}% deep`);
  setText("costDecisionOutput", `💰 Repair: ${sym}${repairCost.toFixed(2)} · Resurface: ${sym}${resurfaceCost.toFixed(2)} · Recommended: ${decision}`);

  const weeks = estimateDecay(road);
  setText("decayOutput",
    weeks === null ? "Not enough data to estimate decay." :
    weeks === 0   ? "⚠ Deep potholes already exceed 50% — immediate action required." :
    `📉 Estimated ${weeks} week(s) until deep potholes exceed 50%.`);

  setText("reportOutput", `📄 ${road.name} | ${road.type} | ${road.lengthKm}km | ${total} potholes | Density: ${density.toFixed(2)} ${dUnit} | Action: ${decision}`);
}

// ═══ ABOUT ROAD ═════════════════════════════════════════════════════
function updateAboutRoad(road) {
  const el = document.getElementById("aboutRoadContent");
  if (!el) return;
  el.innerHTML = `
    <div class="resultCard">
      <h3>Road Information</h3>
      <p><strong>Name:</strong> ${road.name}</p>
      <p><strong>Type:</strong> ${road.type}</p>
      <p><strong>Length:</strong> ${road.lengthKm} km</p>
      <p><strong>Resurfaced this year:</strong> ${road.wasResurfaced ? "✅ Yes" : "❌ No"}</p>
    </div>
    <div class="resultCard">
      <h3>Pothole Counts</h3>
      <p>🟡 Shallow: <strong>${road.potholes.shallow}</strong></p>
      <p>🟠 Medium: <strong>${road.potholes.medium}</strong></p>
      <p>🔴 Deep: <strong>${road.potholes.deep}</strong></p>
      <p><strong>Total:</strong> ${road.potholes.shallow + road.potholes.medium + road.potholes.deep}</p>
    </div>`;
}

// ═══ COST TAB ═══════════════════════════════════════════════════════
function updateCostTab(road) {
  const el = document.getElementById("costTabContent");
  if (!el) return;
  const s = road.potholes.shallow * road.costs.repairPerShallow;
  const m = road.potholes.medium  * road.costs.repairPerMedium;
  const d = road.potholes.deep    * road.costs.repairPerDeep;
  const rep = s + m + d;
  const res = road.lengthKm * road.costs.resurfacePerKm;
  const dec = rep > 1000 ? "Resurface" : "Repair";
  const sym = currencySymbol();
  el.innerHTML = `
    <div class="resultCard">
      <h3>Cost Breakdown — ${road.name}</h3>
      <p>🟡 Shallow (${road.potholes.shallow} × ${sym}${road.costs.repairPerShallow}): <strong>${sym}${s.toFixed(2)}</strong></p>
      <p>🟠 Medium (${road.potholes.medium} × ${sym}${road.costs.repairPerMedium}): <strong>${sym}${m.toFixed(2)}</strong></p>
      <p>🔴 Deep (${road.potholes.deep} × ${sym}${road.costs.repairPerDeep}): <strong>${sym}${d.toFixed(2)}</strong></p>
      <hr style="margin:12px 0;border:0;border-top:1px solid #ddd">
      <p><strong>Total Repair Cost:</strong> ${sym}${rep.toFixed(2)}</p>
      <p><strong>Resurfacing Cost (${sym}${road.costs.resurfacePerKm}/km × ${road.lengthKm} km):</strong> ${sym}${res.toFixed(2)}</p>
      <p class="decisionBadge ${dec === 'Resurface' ? 'badgeRed' : 'badgeGreen'}">Recommended: ${dec}</p>
      <p class="hintText">Resurfacing recommended when repair cost exceeds $1,000.</p>
    </div>`;
}

// ═══ DECAY TAB + ANIMATED VISUALISER ════════════════════════════════
function updateDecayTab(road) {
  const el = document.getElementById("decayTabContent");
  if (!el) return;
  const weeks = estimateDecay(road);
  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;
  const dPct  = total > 0 ? ((road.potholes.deep / total) * 100).toFixed(1) : 0;
  el.innerHTML = `
    <div class="resultCard">
      <h3>Decay Rate — ${road.name}</h3>
      <p><strong>Current deep pothole %:</strong> ${dPct}%</p>
      <p><strong>Forecast:</strong> ${
        weeks === null ? "Insufficient data." :
        weeks === 0   ? "⚠ Already at or above 50%. Immediate action required." :
        `~<strong>${weeks} week(s)</strong> until deep potholes exceed 50%.`
      }</p>
      <p class="hintText">Growth rate: ${document.getElementById("growthRate").value} pothole(s)/week (adjustable in Settings).</p>
    </div>`;
}

function updateDecayVisualiser(road) {
  const vis = document.getElementById("decayVis");
  if (!vis) return;
  vis.hidden = false;

  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;
  const deepPct = total > 0 ? (road.potholes.deep / total) * 100 : 0;

  // Animate bar
  const fill = document.getElementById("decayBarFill");
  const pctLabel = document.getElementById("decayBarPct");
  const statusMsg = document.getElementById("decayStatusMsg");
  fill.style.width = "0%";
  fill.className = "decayBarFill";
  setTimeout(() => {
    fill.style.width = Math.min(deepPct, 100) + "%";
    fill.classList.add(deepPct >= 50 ? "decayDanger" : deepPct >= 30 ? "decayWarn" : "decaySafe");
    pctLabel.textContent = deepPct.toFixed(1) + "%";
  }, 150);

  statusMsg.textContent = deepPct >= 50
    ? "🔴 Critical — deep potholes at or above 50%. Immediate intervention required."
    : deepPct >= 30
    ? "🟠 Warning — deep potholes approaching critical threshold."
    : "🟢 Stable — deep pothole percentage is within acceptable range.";

  // Projection chart
  const rate = Number(document.getElementById("growthRate").value) || 1;
  const weeks = 12;
  const labels = Array.from({length: weeks + 1}, (_, i) => `Wk ${i}`);
  const projData = labels.map((_, i) => {
    const projected = road.potholes.deep + (i * rate);
    return Math.min((projected / total) * 100, 100);
  });

  const ctx = document.getElementById("decayProjectionChart");
  if (!ctx) return;
  if (decayChartInst) decayChartInst.destroy();
  decayChartInst = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Projected Deep %",
          data: projData,
          borderColor: "#e74c3c",
          backgroundColor: "rgba(231,76,60,0.12)",
          tension: 0.4,
          fill: true,
          pointRadius: 3
        },
        {
          label: "50% Threshold",
          data: Array(weeks + 1).fill(50),
          borderColor: "#e67e22",
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" }, title: { display: true, text: `${road.name} — 12-Week Decay Projection` } },
      scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: "Deep Pothole %" } } }
    }
  });
}

function estimateDecay(road) {
  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;
  if (total === 0) return null;
  const deep = road.potholes.deep;
  const target = total * 0.5;
  if (deep >= target) return 0;
  const rate = Number(document.getElementById("growthRate").value) || 1;
  return Math.ceil((target - deep) / rate);
}

// ═══ NUMBER TAB ═════════════════════════════════════════════════════
function updateNumberTab(road) {
  const el = document.getElementById("numberTabContent");
  if (!el) return;
  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;
  const rows = road.monthlyPotholes
    ? Object.entries(road.monthlyPotholes).map(([mo, d]) =>
        `<tr><td>${mo}</td><td>${d.shallow}</td><td>${d.medium}</td><td>${d.deep}</td><td>${d.shallow+d.medium+d.deep}</td></tr>`).join("")
    : "<tr><td colspan='5'>No monthly data.</td></tr>";
  el.innerHTML = `
    <div class="resultCard">
      <h3>Annual Summary — ${road.name}</h3>
      <p>🟡 Shallow: <strong>${road.potholes.shallow}</strong> &nbsp;|&nbsp; 🟠 Medium: <strong>${road.potholes.medium}</strong> &nbsp;|&nbsp; 🔴 Deep: <strong>${road.potholes.deep}</strong> &nbsp;|&nbsp; Total: <strong>${total}</strong></p>
    </div>
    <div class="resultCard">
      <h3>Monthly Breakdown — ${road.name}</h3>
      <div style="overflow-x:auto">
        <table class="dataTable" aria-label="Monthly pothole data for ${road.name}">
          <thead><tr><th>Month</th><th>Shallow</th><th>Medium</th><th>Deep</th><th>Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ═══ SUMMARY TAB ════════════════════════════════════════════════════
function updateSummaryTab(road) {
  const el = document.getElementById("summaryTabContent");
  if (!el) return;
  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;
  const lenConv = convertDistance(road.lengthKm);
  const uLabel  = distanceUnit === "miles" ? "miles" : "km";
  const dUnit   = distanceUnit === "miles" ? "potholes/mile" : "potholes/km";
  const density = (total / lenConv).toFixed(2);
  const rep = road.potholes.shallow*road.costs.repairPerShallow + road.potholes.medium*road.costs.repairPerMedium + road.potholes.deep*road.costs.repairPerDeep;
  const res = road.lengthKm * road.costs.resurfacePerKm;
  const dec = rep > 1000 ? "Resurface" : "Repair";
  const sym = currencySymbol();
  el.innerHTML = `
    <div class="resultCard">
      <h3>Summary — ${road.name}</h3>
      <p><strong>Type:</strong> ${road.type}</p>
      <p><strong>Length:</strong> ${lenConv.toFixed(2)} ${uLabel}</p>
      <p><strong>Total potholes:</strong> ${total}</p>
      <p><strong>Density:</strong> ${density} ${dUnit}</p>
      <p><strong>Repair cost:</strong> ${sym}${rep.toFixed(2)}</p>
      <p><strong>Resurface cost:</strong> ${sym}${res.toFixed(2)}</p>
      <p class="decisionBadge ${dec==='Resurface'?'badgeRed':'badgeGreen'}">Recommended: ${dec}</p>
    </div>`;
}

// ═══ REPORTS TAB ════════════════════════════════════════════════════
function updateReportsTab(roads) {
  const el = document.getElementById("reportsTabContent");
  if (!el) return;

  const rows = roads.map(r => {
    const t = r.potholes.shallow + r.potholes.medium + r.potholes.deep;
    return `<tr><td>${r.name}</td><td>${r.type}</td><td>${t}</td></tr>`;
  }).join("");

  const resurfRows = roads.filter(r => r.wasResurfaced)
    .map(r => `<tr><td>${r.name}</td><td>${r.type}</td></tr>`).join("")
    || "<tr><td colspan='2'>No roads resurfaced this year.</td></tr>";

  const monthly = roads[0]?.monthlyPotholes
    ? Object.entries(roads[0].monthlyPotholes)
        .map(([mo, d]) => `<tr><td>${mo}</td><td>${d.shallow}</td><td>${d.medium}</td><td>${d.deep}</td></tr>`).join("")
    : "<tr><td colspan='4'>No data.</td></tr>";

  const byType = {};
  roads.forEach(r => {
    if (!byType[r.type]) byType[r.type] = { shallow:0, medium:0, deep:0, count:0 };
    byType[r.type].shallow += r.potholes.shallow;
    byType[r.type].medium  += r.potholes.medium;
    byType[r.type].deep    += r.potholes.deep;
    byType[r.type].count++;
  });
  const typeRows = Object.entries(byType).map(([type, d]) =>
    `<tr><td>${type}</td><td>${d.count}</td><td>${d.shallow}</td><td>${d.medium}</td><td>${d.deep}</td><td>${d.shallow+d.medium+d.deep}</td></tr>`
  ).join("");

  el.innerHTML = `
    <div class="resultCard"><h3>Total Potholes Per Road</h3><div style="overflow-x:auto"><table class="dataTable"><thead><tr><th>Road</th><th>Type</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="resultCard"><h3>Roads Resurfaced This Year</h3><div style="overflow-x:auto"><table class="dataTable"><thead><tr><th>Road</th><th>Type</th></tr></thead><tbody>${resurfRows}</tbody></table></div></div>
    <div class="resultCard"><h3>Potholes by Road Type</h3><div style="overflow-x:auto"><table class="dataTable"><thead><tr><th>Type</th><th>Roads</th><th>Shallow</th><th>Medium</th><th>Deep</th><th>Total</th></tr></thead><tbody>${typeRows}</tbody></table></div></div>
    <div class="resultCard"><h3>Monthly Breakdown — ${roads[0].name}</h3><div style="overflow-x:auto"><table class="dataTable"><thead><tr><th>Month</th><th>Shallow</th><th>Medium</th><th>Deep</th></tr></thead><tbody>${monthly}</tbody></table></div></div>`;

  renderCharts(roads, byType);
}

function renderCharts(roads, byType) {
  const ctx1 = document.getElementById("potholesChart");
  if (ctx1) {
    if (potholesChartInst) potholesChartInst.destroy();
    potholesChartInst = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: roads.map(r => r.name),
        datasets: [
          { label:"Shallow", data: roads.map(r=>r.potholes.shallow), backgroundColor:"#f1c40f" },
          { label:"Medium",  data: roads.map(r=>r.potholes.medium),  backgroundColor:"#e67e22" },
          { label:"Deep",    data: roads.map(r=>r.potholes.deep),    backgroundColor:"#e74c3c" }
        ]
      },
      options: { responsive:true, plugins:{legend:{position:"top"},title:{display:true,text:"Potholes Per Road"}}, scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}} }
    });
  }
  const ctx2 = document.getElementById("typeChart");
  if (ctx2) {
    if (typeChartInst) typeChartInst.destroy();
    const types = Object.keys(byType);
    typeChartInst = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: types,
        datasets: [
          { label:"Shallow", data:types.map(t=>byType[t].shallow), backgroundColor:"#f1c40f" },
          { label:"Medium",  data:types.map(t=>byType[t].medium),  backgroundColor:"#e67e22" },
          { label:"Deep",    data:types.map(t=>byType[t].deep),    backgroundColor:"#e74c3c" }
        ]
      },
      options: { responsive:true, plugins:{legend:{position:"top"},title:{display:true,text:"Potholes by Road Type"}}, scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}} }
    });
  }
}

// ═══ TEAM TAB ═══════════════════════════════════════════════════════
function updateTeamTab() {
  const team = [
    { name:"Abigail Murray",   role:"Lead UX/UI Designer & Accessibility Engineer", bio:"Designs intuitive, accessible interfaces for elderly, blind, and deaf users.", initials:"AM" },
    { name:"Jaden Cummins",    role:"Frontend Engineer",                             bio:"Implements interactive components, responsive layouts, and smooth interactions.", initials:"JC" },
    { name:"Deondre McClean",  role:"Data & Simulation Logic Engineer",              bio:"Builds the core engine for density, decay modelling, and cost estimation.",  initials:"DM" },
    { name:"Dominic London",   role:"Documentation Specialist",                      bio:"Creates structured documentation for system features and maintenance.",        initials:"DL" }
  ];
  const c = document.getElementById("teamCards");
  if (!c) return;
  c.innerHTML = team.map(m => `
    <div class="teamCard" tabindex="0" aria-label="${m.name}, ${m.role}">
      <div class="teamAvatar">${m.initials}</div>
      <h3>${m.name}</h3>
      <p class="teamRole">${m.role}</p>
      <p>${m.bio}</p>
    </div>`).join("");
}

// ═══ CONTACT FORM ═══════════════════════════════════════════════════
function submitContact(e) {
  e.preventDefault();
  const name  = document.getElementById("cName").value.trim();
  const email = document.getElementById("cEmail").value.trim();
  const msg   = document.getElementById("cMsg").value.trim();
  const status = document.getElementById("contactStatus");
  if (!name || !email || !msg) { status.textContent = "⚠ Please fill all required fields."; status.style.color = "red"; return; }
  status.textContent = `✅ Thank you, ${name}! Your message has been received. We'll reply to ${email} within 2 business days.`;
  status.style.color = "green";
  document.getElementById("contactForm").reset();
}

// ═══ SETTINGS ═══════════════════════════════════════════════════════
function updateUnits() {
  distanceUnit = document.getElementById("unitDistance").value;
  currencyUnit = document.getElementById("unitCurrency").value;
  playSound();
  setStatus("✔ Unit preferences updated.");
  if (currentRoadLoaded) handleSearch();
}
function updateAlerts() {
  densityThreshold = Number(document.getElementById("densityThreshold").value);
  deepThreshold    = Number(document.getElementById("deepThreshold").value);
  costThreshold    = Number(document.getElementById("costThreshold").value);
  playSound();
  setStatus("✔ Alert thresholds updated.");
  if (currentRoadLoaded) handleSearch();
}
function updateSimulation() {
  const rate = Number(document.getElementById("growthRate").value);
  document.getElementById("growthRateLabel").textContent = `Growth Rate: ${rate} pothole(s)/week`;
  playSound();
  if (currentRoadLoaded) handleSearch();
}
function setTheme(mode) {
  document.body.className = mode;
  localStorage.setItem("prTheme", mode);
  updateToggleButtons("themeToggleBtn", mode);
  playSound();
  setStatus(`✔ Theme set to ${mode}.`);
}
function setFontSize(size) {
  const map = { normal:"18px", large:"22px", xlarge:"28px" };
  document.body.style.fontSize = map[size] || "18px";
  localStorage.setItem("prFontSize", size);
  updateToggleButtons("fontSizeToggleBtn", size);
  playSound();
  setStatus(`✔ Text size: ${size}.`);
}
function setFontStyle(style) {
  document.body.style.fontFamily = style === "dyslexic" ? "'Comic Sans MS', cursive" : "";
  updateToggleButtons("fontStyleToggleBtn", style);
  setStatus(style === "dyslexic" ? "✔ Dyslexia-friendly font enabled." : "✔ Standard font restored.");
  playSound();
}
function updateToggleButtons(groupClass, value) {
  document.querySelectorAll(`.${groupClass}`).forEach(button => {
    const active = button.dataset.value === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
function toggleSound() { soundEnabled = document.getElementById("soundToggle").checked; }
function resetDashboard() { localStorage.clear(); location.reload(); }

// ═══ UTILITY ════════════════════════════════════════════════════════
function setText(id, text) { const e = document.getElementById(id); if (e) e.textContent = text; }
function setStatus(msg)    { const e = document.getElementById("status"); if (e) e.textContent = msg; }
function convertDistance(km) { return distanceUnit === "miles" ? km * 0.621371 : km; }
function currencySymbol() { return currencyUnit === "BBD" ? "BBD $" : currencyUnit === "CAD" ? "CA $" : "$"; }
function playSound() {
  if (!soundEnabled) return;
  const a = new Audio("assets/sounds/notify.mp3");
  a.volume = 0.35;
  a.play().catch(() => {});
}
function vibrateAlert() { if (navigator.vibrate) navigator.vibrate(120); }

// ═══ ON LOAD ════════════════════════════════════════════════════════
window.addEventListener("DOMContentLoaded", () => {
  // Login state
  const user = sessionStorage.getItem("loggedInUser");
  const li   = document.getElementById("loginLogoutLi");
  if (user && li) li.innerHTML = `<a href="#" onclick="logout()" class="navLoginBtn">Logout (${user})</a>`;

  applyRoleView();

  // Restore prefs
  const theme = localStorage.getItem("prTheme") || "light";
  document.body.className = theme;
  updateToggleButtons("themeToggleBtn", theme);

  const size = localStorage.getItem("prFontSize") || "normal";
  const fontMap = { normal:"18px", large:"22px", xlarge:"28px" };
  document.body.style.fontSize = fontMap[size] || "18px";
  updateToggleButtons("fontSizeToggleBtn", size);

  const fontStyle = localStorage.getItem("prFontStyle") || "standard";
  document.body.style.fontFamily = fontStyle === "dyslexic" ? "'Comic Sans MS', cursive" : "";
  updateToggleButtons("fontStyleToggleBtn", fontStyle);

  // Enter key on search
  const inp = document.getElementById("roadSearch");
  if (inp) inp.addEventListener("keydown", e => { if (e.key === "Enter") handleSearch(); });

  // Tutorial dots init
  buildTutDots();
  populateLocationSuggestions();
  initRouteInputListeners();

  // Restore notification state
  const notifEnabled = localStorage.getItem("notificationsEnabled") === "true";
  const notifCheckbox = document.getElementById("enableNotifications");
  if (notifCheckbox) {
    notifCheckbox.checked = notifEnabled;
    toggleNotifications();
  }
  
  if (localStorage.getItem("notificationThreshold")) {
    const slider = document.getElementById("depthThresholdSlider");
    if (slider) {
      slider.value = localStorage.getItem("notificationThreshold");
      updateNotificationThreshold(localStorage.getItem("notificationThreshold"));
    }
  }
});

// Simulation & Notifications
function updateSimValue(id, value, suffix) {
  document.getElementById(id).textContent = value + suffix;
  updateSimulation();
}

function toggleNotifications() {
  const enabled = document.getElementById("enableNotifications").checked;
  const notifOptions = document.getElementById("notificationOptions");
  notifOptions.style.opacity = enabled ? "1" : "0.6";
  notifOptions.style.pointerEvents = enabled ? "auto" : "none";
  localStorage.setItem("notificationsEnabled", enabled);
}

function updateNotificationThreshold(value) {
  document.getElementById("depthThresholdValue").textContent = value;
  localStorage.setItem("notificationThreshold", value);
}

// On page load, restore notification state
window.addEventListener("DOMContentLoaded", () => {
  const notifEnabled = localStorage.getItem("notificationsEnabled") === "true";
  document.getElementById("enableNotifications").checked = notifEnabled;
  toggleNotifications();
  
  if (localStorage.getItem("notificationThreshold")) {
    document.getElementById("depthThresholdSlider").value = 
      localStorage.getItem("notificationThreshold");
    updateNotificationThreshold(localStorage.getItem("notificationThreshold"));
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  GPS ROUTING MODULE 
//  Uses: Nominatim (geocoding) + OSRM (routing) + Leaflet (maps)
// ═══════════════════════════════════════════════════════════════════════

let routeMapInstance  = null;   // Leaflet map for the route result
let mainRouteLayer    = null;   // Polyline for primary route
let altRouteLayer     = null;   // Polyline for alternative route
let routeMarkers      = [];     // Start / end / pothole markers

//  Haversine distance between two lat/lng points (returns km) ─────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Minimum distance from a point to a polyline (array of [lat,lng]) ──
function pointToPolylineDistance(lat, lng, polyline) {
  let minDist = Infinity;
  for (const [pLat, pLng] of polyline) {
    const d = haversine(lat, lng, pLat, pLng);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

//  Geocode a place name using Nominatim (OpenStreetMap, free) ─────────
async function geocode(placeName) {
  // Always append Barbados to focus results on the island
  const query = `${placeName}, Barbados`;
  const url   = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res   = await fetch(url, { headers: { "Accept-Language": "en" } });
  const data  = await res.json();
  if (!data.length) throw new Error(`Location not found: "${placeName}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

// Get a driving route from OSRM (free demo server) ──────────────────
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

//  Match roads.json entries that are near a route polyline
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

//  Calculate a severity score for a set of matched roads 
// Weighted: deep=3, medium=2, shallow=1
function severityScore(roads) {
  return roads.reduce((score, r) => {
    return score + r.potholes.deep * 3 + r.potholes.medium * 2 + r.potholes.shallow * 1;
  }, 0);
}

// Built a human-readable pothole summary for the notification
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

// Initialise or reuse the route Leaflet map and clean up previous layers/markers
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

// Drew pothole marker circles on the map
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

// Show the warning popup / banner
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

// Highlight alternative road on the map
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

// Build the turn-by-turn directions HTML
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

//MAIN planRoute FUNCTION
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

function logout() { sessionStorage.removeItem("loggedInUser"); sessionStorage.removeItem("loggedInRole"); window.location.href = "login.html"; }