/* ═══════════════════════════════════════════════════════
   Claude-Travel — Frontend App
   Dates: 05 Mar 2026 → 06 Mar 2026 | 2 Adults
════════════════════════════════════════════════════════ */

// ─── City Data (with lat/lng for map) ────────────────────────────────────────

const CITIES = [
  { name: 'Hanoi',            country: 'Vietnam',   countryCode: 'VN', flag: '🇻🇳', region: 'AS', lat: 21.0285, lng: 105.8542 },
  { name: 'Ho Chi Minh City', country: 'Vietnam',   countryCode: 'VN', flag: '🇻🇳', region: 'AS', lat: 10.8231, lng: 106.6297 },
  { name: 'Tokyo',            country: 'Japan',     countryCode: 'JP', flag: '🇯🇵', region: 'AS', lat: 35.6762, lng: 139.6503 },
  { name: 'Osaka',            country: 'Japan',     countryCode: 'JP', flag: '🇯🇵', region: 'AS', lat: 34.6937, lng: 135.5023 },
  { name: 'Kyoto',            country: 'Japan',     countryCode: 'JP', flag: '🇯🇵', region: 'AS', lat: 35.0116, lng: 135.7681 },
  { name: 'Barcelona',        country: 'Spain',     countryCode: 'ES', flag: '🇪🇸', region: 'EU', lat: 41.3851, lng: 2.1734  },
  { name: 'Madrid',           country: 'Spain',     countryCode: 'ES', flag: '🇪🇸', region: 'EU', lat: 40.4168, lng: -3.7038 },
  { name: 'Seville',          country: 'Spain',     countryCode: 'ES', flag: '🇪🇸', region: 'EU', lat: 37.3891, lng: -5.9845 },
  { name: 'Lisbon',           country: 'Portugal',  countryCode: 'PT', flag: '🇵🇹', region: 'EU', lat: 38.7169, lng: -9.1399 },
  { name: 'Porto',            country: 'Portugal',  countryCode: 'PT', flag: '🇵🇹', region: 'EU', lat: 41.1496, lng: -8.6109 },
  { name: 'Sydney',           country: 'Australia', countryCode: 'AU', flag: '🇦🇺', region: 'OC', lat: -33.8688, lng: 151.2093 },
  { name: 'Melbourne',        country: 'Australia', countryCode: 'AU', flag: '🇦🇺', region: 'OC', lat: -37.8136, lng: 144.9631 },
  { name: 'Brisbane',         country: 'Australia', countryCode: 'AU', flag: '🇦🇺', region: 'OC', lat: -27.4698, lng: 153.0251 },
  { name: 'Cairns',           country: 'Australia', countryCode: 'AU', flag: '🇦🇺', region: 'OC', lat: -16.9186, lng: 145.7781 },
];

const REGION_COLORS = { AS: '#6c63ff', EU: '#ff6584', OC: '#43c59e' };

// ─── State ────────────────────────────────────────────────────────────────────

let currentFilter = 'all';
let currentView   = 'grid';   // 'grid' | 'map'
let selectedCity  = null;
let isAiLoading   = false;
let leafletMap    = null;
let mapMarkers    = {};       // cityName → L.marker
const cityResults = {};       // cityName → { reply, summary }

// Expose map globals for debugging / external access
window.mapMarkers = mapMarkers;
Object.defineProperty(window, 'leafletMap', { get: () => leafletMap });

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const chatWindow   = document.getElementById('chatWindow');
const chatInput    = document.getElementById('chatInput');
const sendBtn      = document.getElementById('sendBtn');
const citiesGrid   = document.getElementById('citiesGrid');
const mapContainer = document.getElementById('mapContainer');
const contextBar   = document.getElementById('contextBar');
const contextText  = document.getElementById('contextText');
const gridViewBtn  = document.getElementById('gridViewBtn');
const mapViewBtn   = document.getElementById('mapViewBtn');

// ─── View toggle ──────────────────────────────────────────────────────────────

gridViewBtn.addEventListener('click', () => switchView('grid'));
mapViewBtn.addEventListener('click',  () => switchView('map'));

function switchView(view) {
  currentView = view;
  gridViewBtn.classList.toggle('active', view === 'grid');
  mapViewBtn.classList.toggle('active',  view === 'map');
  citiesGrid.style.display   = view === 'grid' ? '' : 'none';
  mapContainer.classList.toggle('hidden', view !== 'map');

  if (view === 'map') initMap();
}

// ─── Render city cards ────────────────────────────────────────────────────────

function renderCities() {
  const filtered = currentFilter === 'all'
    ? CITIES
    : CITIES.filter(c => c.region === currentFilter);

  citiesGrid.innerHTML = '';

  filtered.forEach(city => {
    const card   = document.createElement('div');
    const cached = cityResults[city.name];
    const isDone = !!cached;

    card.className    = 'city-card' + (selectedCity?.name === city.name ? ' selected' : '');
    card.dataset.name = city.name;
    card.innerHTML    = `
      <div class="city-flag">${city.flag}</div>
      <div class="city-name">${city.name}</div>
      <div class="city-country">${city.country}</div>
      <span class="city-region">${regionLabel(city.region)}</span>
      <div class="city-card-footer">
        <span class="ask-ai-btn">Ask Wanderly →</span>
        <span class="city-status ${isDone ? 'done' : ''}">${isDone ? '✓ Done' : '—'}</span>
      </div>
    `;

    card.addEventListener('click', () => handleCityClick(city, card));
    citiesGrid.appendChild(card);
  });
}

function regionLabel(code) {
  return { AS: 'Asia', EU: 'Europe', OC: 'Oceania' }[code] || code;
}

// ─── Leaflet map ──────────────────────────────────────────────────────────────

function initMap() {
  if (leafletMap) {
    leafletMap.invalidateSize();
    return;
  }

  leafletMap = L.map('accommodationMap', {
    center: [25, 50],
    zoom: 2,
    zoomControl: true,
    attributionControl: true
  });

  // Primary: CartoDB Positron (online)
  // Fallback: SVG grid canvas when offline
  const onlineTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  });

  // Offline fallback — SVG tile rendered as a data URI
  const svgTile = encodeURIComponent([
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">',
    '<rect width="256" height="256" fill="#dce9f5"/>',
    '<rect width="256" height="256" fill="url(#g)" opacity="0.4"/>',
    '<defs><pattern id="g" width="32" height="32" patternUnits="userSpaceOnUse">',
    '<path d="M 32 0 L 0 0 0 32" fill="none" stroke="#c0d8ee" stroke-width="0.5"/>',
    '</pattern></defs>',
    '</svg>'
  ].join(''));
  const offlineTiles = L.tileLayer(`data:image/svg+xml,${svgTile}`, {
    attribution: 'Offline mode',
    maxZoom: 19,
    tileSize: 256
  });

  // Try online first, fall back after 4 s if no tiles loaded
  let tilesLoaded = 0;
  onlineTiles.on('tileload', () => { tilesLoaded++; });
  onlineTiles.addTo(leafletMap);
  setTimeout(() => {
    if (tilesLoaded === 0) {
      leafletMap.removeLayer(onlineTiles);
      offlineTiles.addTo(leafletMap);
    }
  }, 4000);

  // Add a city marker for every destination
  CITIES.forEach(city => addCityMarker(city));

  // Fit map to show all markers
  const group = L.featureGroup(Object.values(mapMarkers));
  leafletMap.fitBounds(group.getBounds().pad(0.15));
}

function addCityMarker(city) {
  const color   = REGION_COLORS[city.region] || '#6c63ff';
  const cached  = cityResults[city.name];

  // SVG pin icon
  const svgIcon = L.divIcon({
    className: '',
    html: `
      <div style="
        width:34px; height:34px;
        background:${color};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid rgba(255,255,255,.9);
        box-shadow:0 4px 12px rgba(0,0,0,.25);
        display:flex; align-items:center; justify-content:center;
        cursor:pointer;
        transition:transform .2s;
      ">
        <span style="transform:rotate(45deg);font-size:14px;line-height:1">${city.flag}</span>
      </div>`,
    iconSize:   [34, 34],
    iconAnchor: [17, 34],
    popupAnchor:[0, -36]
  });

  const marker = L.marker([city.lat, city.lng], { icon: svgIcon });
  marker.addTo(leafletMap);
  marker.bindPopup(() => buildPopupContent(city), { maxWidth: 240, minWidth: 200 });
  marker.on('click', () => {
    if (!cityResults[city.name]) triggerCityFromMap(city);
  });

  mapMarkers[city.name] = marker;
}

function buildPopupContent(city) {
  const cached = cityResults[city.name];
  const color  = REGION_COLORS[city.region];

  const pricesHtml = cached?.summary
    ? `<div class="map-popup-prices">
        <div class="map-popup-price-row">🏨 Hostel <strong>from $${cached.summary.hostels.cheapest ?? 'N/A'}</strong></div>
        <div class="map-popup-price-row">🏩 Hotel &nbsp;<strong>from $${cached.summary.privateRooms.cheapest ?? 'N/A'}</strong></div>
       </div>`
    : `<div style="font-size:12px;color:#9598b0;margin-top:8px">Click to get AI recommendation</div>`;

  const btnLabel = cached ? '💬 View Recommendation' : '✨ Ask Wanderly';

  const div = document.createElement('div');
  div.className = 'map-popup';
  div.innerHTML = `
    <div style="height:5px;background:linear-gradient(90deg,${color},${color}aa);margin:-0px 0 12px;border-radius:0"></div>
    <div class="map-popup-flag">${city.flag}</div>
    <div class="map-popup-city">${city.name}</div>
    <div class="map-popup-country">${city.country} · ${regionLabel(city.region)}</div>
    ${pricesHtml}
    <button class="map-popup-btn" id="popup-btn-${city.name.replace(/\s/g,'_')}">${btnLabel}</button>
  `;

  // Wire button click after DOM insertion
  setTimeout(() => {
    const btn = document.getElementById(`popup-btn-${city.name.replace(/\s/g,'_')}`);
    if (btn) {
      btn.addEventListener('click', () => {
        leafletMap.closePopup();
        triggerCityFromMap(city);
      });
    }
  }, 10);

  return div;
}

async function triggerCityFromMap(city) {
  selectedCity = city;
  contextBar.classList.add('active');
  contextText.textContent = `${city.flag} ${city.name}, ${city.country}`;

  if (cityResults[city.name]) {
    scrollChatToBottom();
    return;
  }

  addMessage('user', `Should we stay in a hostel or private room in ${city.name}? 🤔`);
  const typingEl = showTyping();
  setAiLoading(true);

  try {
    const data = await fetchRecommendation(city);
    removeTyping(typingEl);
    addMessage('bot', formatReply(data.reply), data.summary);
    cityResults[city.name] = data;

    // Refresh popup if open to show prices
    if (mapMarkers[city.name]) {
      mapMarkers[city.name].setPopupContent(buildPopupContent(city));
    }
  } catch {
    removeTyping(typingEl);
    addMessage('bot', `Couldn't grab data for ${city.name} right now 😅 — try again in a sec!`);
  } finally {
    setAiLoading(false);
  }
}

// ─── City card click handler ──────────────────────────────────────────────────

async function handleCityClick(city, cardEl) {
  if (isAiLoading) return;

  document.querySelectorAll('.city-card').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');
  selectedCity = city;

  contextBar.classList.add('active');
  contextText.textContent = `${city.flag} ${city.name}, ${city.country}`;

  if (cityResults[city.name]) {
    scrollChatToBottom();
    return;
  }

  addMessage('user', `Should we stay in a hostel or private room in ${city.name}? 🤔`);
  const typingEl = showTyping();
  cardEl.classList.add('loading');
  setStatusOnCard(cardEl, '<span class="card-spinner"></span>');
  setAiLoading(true);

  try {
    const data = await fetchRecommendation(city);
    removeTyping(typingEl);
    addMessage('bot', formatReply(data.reply), data.summary);
    cityResults[city.name] = data;
    setStatusOnCard(cardEl, '<span class="city-status done">✓ Done</span>');
  } catch {
    removeTyping(typingEl);
    addMessage('bot', `Oops! Couldn't fetch data for ${city.name} right now 😅 — try again in a moment!`);
    setStatusOnCard(cardEl, '<span class="city-status">—</span>');
  } finally {
    cardEl.classList.remove('loading');
    setAiLoading(false);
  }
}

// ─── Free-form chat ───────────────────────────────────────────────────────────

async function handleChatSend() {
  const msg = chatInput.value.trim();
  if (!msg || isAiLoading) return;

  chatInput.value = '';
  addMessage('user', msg);
  const typingEl = showTyping();
  setAiLoading(true);

  try {
    const res  = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: msg })
    });
    const data = await res.json();
    removeTyping(typingEl);
    addMessage('bot', formatReply(data.reply || data.error));
  } catch {
    removeTyping(typingEl);
    addMessage('bot', "Connection hiccup! 📡 Give me a second and try again.");
  } finally {
    setAiLoading(false);
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchRecommendation(city) {
  const res = await fetch('/api/recommend', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ city: city.name, countryCode: city.countryCode, country: city.country })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Message rendering ────────────────────────────────────────────────────────

function addMessage(role, htmlContent, summary = null) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'bot' ? '🌍' : '👤';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = htmlContent;

  if (summary) {
    const pill = buildSummaryPill(summary);
    if (pill) bubble.appendChild(pill);
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatWindow.appendChild(wrapper);
  scrollChatToBottom();
}

function buildSummaryPill(summary) {
  if (!summary) return null;
  const { hostels, privateRooms } = summary;
  if (!hostels.count && !privateRooms.count) return null;

  const pill = document.createElement('div');
  pill.className = 'data-summary';
  pill.innerHTML = `
    <span><span>🏨 Hostels (${hostels.count} found)</span> <strong>from $${hostels.cheapest ?? 'N/A'}/night</strong></span>
    <span><span>🏩 Private Rooms (${privateRooms.count} found)</span> <strong>from $${privateRooms.cheapest ?? 'N/A'}/night</strong></span>
    <span style="font-size:10px;margin-top:2px;color:#555">via LiteAPI · Mar 05-06 2026 · 2 Adults</span>
  `;
  return pill;
}

function formatReply(text) {
  if (!text) return text;
  return text.split('\n').map(line => {
    if (line.startsWith('🏆 Verdict:') || line.startsWith('Verdict:')) {
      return `<div class="verdict">${line}</div>`;
    }
    return line ? `<p>${line}</p>` : '';
  }).join('');
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function showTyping() {
  const wrapper = document.createElement('div');
  wrapper.className = 'typing-indicator';
  wrapper.innerHTML = `
    <div class="message-avatar" style="background:linear-gradient(135deg,#6c63ff,#ff6584);border:none;box-shadow:0 0 10px rgba(108,99,255,.4);font-size:18px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">🌍</div>
    <div class="typing-dots"><span></span><span></span><span></span></div>
  `;
  chatWindow.appendChild(wrapper);
  scrollChatToBottom();
  return wrapper;
}

function removeTyping(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function scrollChatToBottom() {
  requestAnimationFrame(() => { chatWindow.scrollTop = chatWindow.scrollHeight; });
}

function setAiLoading(state) {
  isAiLoading = state;
  sendBtn.disabled = state;
  chatInput.disabled = state;
}

function setStatusOnCard(cardEl, html) {
  const el = cardEl.querySelector('.city-status, .card-spinner');
  if (el) el.outerHTML = html;
}

// ─── Filter buttons ───────────────────────────────────────────────────────────

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderCities();
    if (currentView === 'map') updateMapFilter();
  });
});

function updateMapFilter() {
  if (!leafletMap) return;
  CITIES.forEach(city => {
    const marker = mapMarkers[city.name];
    if (!marker) return;
    const show = currentFilter === 'all' || city.region === currentFilter;
    if (show) marker.addTo(leafletMap);
    else leafletMap.removeLayer(marker);
  });
}

// ─── Chat input events ────────────────────────────────────────────────────────

sendBtn.addEventListener('click', handleChatSend);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

renderCities();
