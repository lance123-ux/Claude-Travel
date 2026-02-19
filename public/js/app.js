/* ═══════════════════════════════════════════════════════
   Claude-Travel — Frontend App
   Dates: 05 Mar 2026 → 06 Mar 2026 | 2 Adults
════════════════════════════════════════════════════════ */

// ─── City Data ────────────────────────────────────────────────────────────────

const CITIES = [
  { name: 'Hanoi',         country: 'Vietnam',   countryCode: 'VN', flag: '🇻🇳', region: 'AS' },
  { name: 'Ho Chi Minh City', country: 'Vietnam', countryCode: 'VN', flag: '🇻🇳', region: 'AS' },
  { name: 'Tokyo',         country: 'Japan',      countryCode: 'JP', flag: '🇯🇵', region: 'AS' },
  { name: 'Osaka',         country: 'Japan',      countryCode: 'JP', flag: '🇯🇵', region: 'AS' },
  { name: 'Kyoto',         country: 'Japan',      countryCode: 'JP', flag: '🇯🇵', region: 'AS' },
  { name: 'Barcelona',     country: 'Spain',      countryCode: 'ES', flag: '🇪🇸', region: 'EU' },
  { name: 'Madrid',        country: 'Spain',      countryCode: 'ES', flag: '🇪🇸', region: 'EU' },
  { name: 'Seville',       country: 'Spain',      countryCode: 'ES', flag: '🇪🇸', region: 'EU' },
  { name: 'Lisbon',        country: 'Portugal',   countryCode: 'PT', flag: '🇵🇹', region: 'EU' },
  { name: 'Porto',         country: 'Portugal',   countryCode: 'PT', flag: '🇵🇹', region: 'EU' },
  { name: 'Sydney',        country: 'Australia',  countryCode: 'AU', flag: '🇦🇺', region: 'OC' },
  { name: 'Melbourne',     country: 'Australia',  countryCode: 'AU', flag: '🇦🇺', region: 'OC' },
  { name: 'Brisbane',      country: 'Australia',  countryCode: 'AU', flag: '🇦🇺', region: 'OC' },
  { name: 'Cairns',        country: 'Australia',  countryCode: 'AU', flag: '🇦🇺', region: 'OC' },
];

// ─── State ────────────────────────────────────────────────────────────────────

let currentFilter  = 'all';
let selectedCity   = null;
let isAiLoading    = false;
const cityResults  = {};    // Cache: cityName → { reply, summary }

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const chatWindow  = document.getElementById('chatWindow');
const chatInput   = document.getElementById('chatInput');
const sendBtn     = document.getElementById('sendBtn');
const citiesGrid  = document.getElementById('citiesGrid');
const contextBar  = document.getElementById('contextBar');
const contextText = document.getElementById('contextText');

// ─── Render city cards ────────────────────────────────────────────────────────

function renderCities() {
  const filtered = currentFilter === 'all'
    ? CITIES
    : CITIES.filter(c => c.region === currentFilter);

  citiesGrid.innerHTML = '';

  filtered.forEach(city => {
    const card    = document.createElement('div');
    const cached  = cityResults[city.name];
    const isDone  = !!cached;

    card.className  = 'city-card' + (selectedCity?.name === city.name ? ' selected' : '');
    card.dataset.name = city.name;
    card.innerHTML  = `
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

// ─── City click handler ───────────────────────────────────────────────────────

async function handleCityClick(city, cardEl) {
  if (isAiLoading) return;

  // Update selection UI
  document.querySelectorAll('.city-card').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');
  selectedCity = city;

  // Update context bar
  contextBar.classList.add('active');
  contextText.textContent = `${city.flag} ${city.name}, ${city.country}`;

  // If cached, just display
  if (cityResults[city.name]) {
    scrollChatToBottom();
    return;
  }

  // Add user message bubble
  addMessage('user', `Should we stay in a hostel or private room in ${city.name}? 🤔`);

  // Show typing indicator
  const typingEl = showTyping();
  cardEl.classList.add('loading');
  setStatusOnCard(cardEl, '<span class="card-spinner"></span>');
  setAiLoading(true);

  try {
    const data = await fetchRecommendation(city);
    removeTyping(typingEl);

    const formattedReply = formatReply(data.reply);
    addMessage('bot', formattedReply, data.summary);

    cityResults[city.name] = data;
    setStatusOnCard(cardEl, '<span class="city-status done">✓ Done</span>');
  } catch (err) {
    removeTyping(typingEl);
    addMessage('bot', `Oops! I couldn't fetch data for ${city.name} right now 😅 — try again in a moment!`);
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

// ─── API call ─────────────────────────────────────────────────────────────────

async function fetchRecommendation(city) {
  const res = await fetch('/api/recommend', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      city:        city.name,
      countryCode: city.countryCode,
      country:     city.country
    })
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

  // Attach data summary pill if present
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

// Convert Claude's verdict line into styled HTML
function formatReply(text) {
  if (!text) return text;

  // Escape then restore for safety
  const lines = text.split('\n');
  return lines.map(line => {
    if (line.startsWith('🏆 Verdict:') || line.startsWith('Verdict:')) {
      return `<div class="verdict">${line}</div>`;
    }
    return `<p>${line}</p>`;
  }).filter(l => l !== '<p></p>').join('');
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

// ─── Utility helpers ──────────────────────────────────────────────────────────

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });
}

function setAiLoading(state) {
  isAiLoading    = state;
  sendBtn.disabled = state;
  chatInput.disabled = state;
}

function setStatusOnCard(cardEl, html) {
  const statusEl = cardEl.querySelector('.city-status, .card-spinner');
  if (statusEl) statusEl.outerHTML = html;
}

// ─── Filter buttons ───────────────────────────────────────────────────────────

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderCities();
  });
});

// ─── Chat input events ────────────────────────────────────────────────────────

sendBtn.addEventListener('click', handleChatSend);

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleChatSend();
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

renderCities();
