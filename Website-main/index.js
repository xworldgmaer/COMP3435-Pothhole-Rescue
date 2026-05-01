let roadsData = [];
let distanceUnit = "km";
let currencyUnit = "USD";

let densityThreshold = 5;
let deepThreshold = 50;
let costThreshold = 5000;

fetch("roads.json")
  .then(res => res.json())
  .then(data => {
    roadsData = data.roads;
    updateReportsTab(roadsData);
    updateTeamTab(); 
  });


function showScreen(tabId) {
    document.querySelectorAll('.tabPanel').forEach(panel => {
        panel.hidden = true;
        panel.classList.remove("active");
    });

    const activeTab = document.getElementById(tabId);
    activeTab.hidden = false;
    activeTab.classList.add("active");

    // Hide bottom buttons on Team tab
    const bottom = document.querySelector(".bottomButtons");
    bottom.style.display = (tabId === "teamTab") ? "none" : "flex";

    playSound();
    vibrateAlert();
}


// Helper to check if a road is loaded
function getCurrentRoad() {
  const name = document.getElementById("roadSearch").value.trim().toLowerCase();
  return roadsData.find(r => r.name.toLowerCase() === name);
}


function handleSearch() {
  const road = getCurrentRoad();

  if (!road) {
    setStatus("Road not found.");
    return;
  }

  updateCalculations(road);
  updateAboutRoad(road);
  updateCostTab(road);
  updateDecayTab(road);
  updateNumberTab(road);
  updateSummaryTab(road);
  updateReportsTab(roadsData);
 

  setStatus(`Loaded road: ${road.name}`);
}


function updateCalculations(road) {
  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;

  const lengthConverted = convertDistance(road.lengthKm);
  const density = total / lengthConverted;

  const avgDistanceKm = road.lengthKm / total;
  const avgDistance = convertDistance(avgDistanceKm);

  const unitLabel = distanceUnit === "miles" ? "miles" : "km";
  const densityUnit = distanceUnit === "miles" ? "potholes/mile" : "potholes/km";

  const shallowPct = (road.potholes.shallow / total) * 100;
  const mediumPct = (road.potholes.medium / total) * 100;
  const deepPct = (road.potholes.deep / total) * 100;

  const repairCost =
    road.potholes.shallow * road.costs.repairPerShallow +
    road.potholes.medium * road.costs.repairPerMedium +
    road.potholes.deep * road.costs.repairPerDeep;

  const resurfaceCost = road.lengthKm * road.costs.resurfacePerKm;
  const decision = repairCost > resurfaceCost ? "Resurface" : "Repair";

  let alertMessage = "";

  if (density > densityThreshold) {
    alertMessage += `⚠ Density exceeds ${densityThreshold}!\n`;
  }

  if (deepPct > deepThreshold) {
    alertMessage += `⚠ Deep potholes exceed ${deepThreshold}%!\n`;
  }

  if (Math.abs(repairCost - resurfaceCost) > costThreshold) {
    alertMessage += `⚠ Cost difference exceeds ${costThreshold}!\n`;
  }

  if (alertMessage) {
    setStatus(alertMessage);
  }


  setText("densityOutput", `Density: ${density.toFixed(2)} ${densityUnit}`);
  setText("avgDistanceOutput", `Average distance: ${avgDistance.toFixed(2)} ${unitLabel}`);
  setText("depthPercentOutput",
    `Depth: ${shallowPct.toFixed(1)}% shallow, ${mediumPct.toFixed(1)}% medium, ${deepPct.toFixed(1)}% deep`
  );

  const currencySymbol =
    currencyUnit === "USD" ? "$" :
    currencyUnit === "BBD" ? "BBD $" :
    currencyUnit === "CAD" ? "CA $" : "$";

  setText("costDecisionOutput",
    `Repair: ${currencySymbol}${repairCost}, Resurface: ${currencySymbol}${resurfaceCost}. Recommended: ${decision}`
  );

  const weeks = estimateDecay(road);
  setText("decayOutput",
    weeks === null
      ? "Not enough data to estimate decay."
      : `Estimated ${weeks} weeks until deep potholes exceed 50% of total.`
  );

  setText("reportOutput", generateReport(road, density, decision));
}


function updateAboutRoad(road) {
  const about = document.getElementById("aboutRoadContent");
  if (!about) return;

  about.innerHTML = `
    <div class="resultCard">
      <h3>Road Information</h3>
      <p><strong>Name:</strong> ${road.name}</p>
      <p><strong>Type:</strong> ${road.type}</p>
      <p><strong>Length:</strong> ${road.lengthKm} km</p>
    </div>

    <div class="resultCard">
      <h3>Pothole Counts</h3>
      <p>Shallow: ${road.potholes.shallow}</p>
      <p>Medium: ${road.potholes.medium}</p>
      <p>Deep: ${road.potholes.deep}</p>
    </div>
  `;
}


function updateCostTab(road) {
  const costArea = document.getElementById("costTabContent");
  if (!costArea) return;

  const shallow = road.potholes.shallow * road.costs.repairPerShallow;
  const medium = road.potholes.medium * road.costs.repairPerMedium;
  const deep = road.potholes.deep * road.costs.repairPerDeep;

  const repairCost = shallow + medium + deep;
  const resurfaceCost = road.lengthKm * road.costs.resurfacePerKm;
  const decision = repairCost > resurfaceCost ? "Resurface" : "Repair";

  costArea.innerHTML = `
    <div class="resultCard">
      <h3>Cost Breakdown</h3>
      <p>Shallow repairs: $${shallow}</p>
      <p>Medium repairs: $${medium}</p>
      <p>Deep repairs: $${deep}</p>
      <p><strong>Total repair cost:</strong> $${repairCost}</p>
      <p><strong>Resurface cost:</strong> $${resurfaceCost}</p>
      <p><strong>Recommended:</strong> ${decision}</p>
    </div>
  `;
}


function updateDecayTab(road) {
  const decayArea = document.getElementById("decayTabContent");
  if (!decayArea) return;

  const weeks = estimateDecay(road);

  decayArea.innerHTML = `
    <div class="resultCard">
      <h3>Decay Rate</h3>
      <p>${
        weeks === null
          ? "Not enough data to estimate decay."
          : `Estimated ${weeks} weeks until deep potholes exceed 50% of total.`
      }</p>
    </div>
  `;
}

function estimateDecay(road) {
  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;
  if (total === 0) return null;

  const deep = road.potholes.deep;
  const target = total * 0.5;

  if (deep >= target) return 0;

  const weeklyGrowth = Number(document.getElementById("growthRate").value);
  return Math.ceil((target - deep) / weeklyGrowth);
}


function updateNumberTab(road) {
  const numArea = document.getElementById("numberTabContent");
  if (!numArea) return;

  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;

  numArea.innerHTML = `
    <div class="resultCard">
      <h3>Pothole Numbers</h3>
      <p><strong>Total:</strong> ${total}</p>
      <p>Shallow: ${road.potholes.shallow}</p>
      <p>Medium: ${road.potholes.medium}</p>
      <p>Deep: ${road.potholes.deep}</p>
    </div>
  `;
}


function updateSummaryTab(road) {
  const summary = document.getElementById("summaryTabContent");
  if (!summary) return;

  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;

  const lengthConverted = convertDistance(road.lengthKm);
  const unitLabel = distanceUnit === "miles" ? "miles" : "km";

  const density = (total / lengthConverted).toFixed(2);
  const densityUnit = distanceUnit === "miles" ? "potholes/mile" : "potholes/km";

  summary.innerHTML = `
    <div class="resultCard">
      <h3>Road Summary</h3>
      <p><strong>Name:</strong> ${road.name}</p>
      <p><strong>Length:</strong> ${lengthConverted.toFixed(2)} ${unitLabel}</p>
      <p><strong>Total potholes:</strong> ${total}</p>
      <p><strong>Density:</strong> ${density} ${densityUnit}</p>
      <p>This road requires monitoring and maintenance based on pothole distribution and decay rate.</p>
    </div>
  `;
}


function generateReport(road, density, decision) {
  const total = road.potholes.shallow + road.potholes.medium + road.potholes.deep;

  return `
    Road: ${road.name}
    Length: ${road.lengthKm} km
    Total potholes: ${total}
    Density: ${density.toFixed(2)} potholes/km
    Recommended action: ${decision}
  `;
}

function updateReportsTab(roads) {
  const reports = document.getElementById("reportsTabContent");
  if (!reports) return;

  const repairedList = roads.map(r => {
    const total = r.potholes.shallow + r.potholes.medium + r.potholes.deep;
    return `<p>${r.name}: ${total} potholes repaired</p>`;
  }).join("");

  const resurfaced = roads
    .filter(r => r.wasResurfaced === true)
    .map(r => `<p>${r.name}</p>`)
    .join("") || "<p>No roads resurfaced this year.</p>";

  const monthly = roads[0].monthlyPotholes
    ? Object.entries(roads[0].monthlyPotholes)
        .map(([month, data]) =>
          `<p>${month}: Shallow ${data.shallow}, Medium ${data.medium}, Deep ${data.deep}</p>`
        ).join("")
    : "<p>No monthly data available.</p>";

  reports.innerHTML = `
    <div class="resultCard">
      <h3>Total Potholes Repaired Per Road</h3>
      ${repairedList}
    </div>

    <div class="resultCard">
      <h3>Roads Resurfaced This Year</h3>
      ${resurfaced}
    </div>

    <div class="resultCard">
      <h3>Total Pothole Types Per Month</h3>
      ${monthly}
    </div>
  `;
}


function updateTeamTab() {
  const team = [
    {
      name: "Abigial Muuray",
      role: "Lead UX/UI Designer & Accessibility Engineer",
      bio: "Designs intuitive, accessible interfaces and ensures usability for elderly, blind, and deaf users."
    },
    {
      name: "Jaden Cummins",
      role: "Frontend Engineer",
      bio: "Implements interactive components, responsive layouts, and smooth user interactions."
    },
    {
      name: "Deondre McClean",
      role: "Data & Simulation Logic Engineer",
      bio: "Builds the core calculation engine for density, decay modeling, and cost estimation."
    },
    {
      name: "Dominic London",
      role: "Documentation Specialist",
      bio: "Creates structured documentation for system features, workflows, and maintenance procedures."
    }
  ];

  const container = document.getElementById("teamCards");

  container.innerHTML = team.map(member => `
    <div class="teamCard resultCard">
      <h3>${member.name}</h3>
      <p><strong>Role:</strong> ${member.role}</p>
      <p>${member.bio}</p>
    </div>
  `).join("");
}


function updateUnits() {
  distanceUnit = document.getElementById("unitDistance").value;
  currencyUnit = document.getElementById("unitCurrency").value;

  playSound();
  vibrateAlert();
  setStatus("✔ Unit preferences updated");

  const road = getCurrentRoad();
  if (road) handleSearch();
}

function updateAlerts() {
  densityThreshold = Number(document.getElementById("densityThreshold").value);
  deepThreshold = Number(document.getElementById("deepThreshold").value);
  costThreshold = Number(document.getElementById("costThreshold").value);

  playSound();
  vibrateAlert();
  setStatus("✔ Alert thresholds updated");

  const road = getCurrentRoad();
  if (road) handleSearch();
}

function updateSimulation() {
  const rate = Number(document.getElementById("growthRate").value);

  playSound();
  vibrateAlert();
  setStatus("✔ Simulation rate updated");

  document.getElementById("growthRateLabel").textContent =
    `Growth Rate: ${rate} pothole(s)/week`;

  const road = getCurrentRoad();
  if (road) handleSearch();
}


function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function loadRoad(name) {
  document.getElementById("roadSearch").value = name;
  handleSearch();
  showScreen('planTab');
}

function setTheme(mode) {
  document.body.className = mode;
}

function resetDashboard() {
  location.reload();
}

function convertDistance(km) {
  return distanceUnit === "miles" ? km * 0.621371 : km;
}


function playSound() {
    const audio = new Audio("assets/sounds/notify.mp3"); 
    audio.volume = 0.5;
    audio.play().catch(err => {
        console.warn("Audio playback blocked by browser:", err);
    });
}


function vibrateAlert() {
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
}

window.addEventListener('DOMContentLoaded', function() {
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const loginLogoutLi = document.getElementById('loginLogoutLi');
    
    if (loggedInUser) {
        loginLogoutLi.innerHTML = `<a href="#" onclick="logout()">Logout (${loggedInUser})</a>`;
    }
});


function logout() {
    sessionStorage.removeItem('loggedInUser');
    window.location.href = 'login.html';
}





