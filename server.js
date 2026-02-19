require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const LITEAPI_BASE = 'https://api.liteapi.travel/v3.0';
const CLAUDE_API  = 'https://api.anthropic.com/v1/messages';
const CHECKIN     = '2026-03-05';
const CHECKOUT    = '2026-03-06';

// ─── LiteAPI helper ──────────────────────────────────────────────────────────

async function fetchHotels(countryCode, cityName) {
  const res = await axios.get(`${LITEAPI_BASE}/data/hotels`, {
    params: { countryCode, cityName, limit: 30 },
    headers: { 'X-API-Key': process.env.LITEAPI_KEY }
  });
  return res.data.data || [];
}

async function fetchRates(hotelIds) {
  const res = await axios.post(
    `${LITEAPI_BASE}/hotels/rates`,
    {
      hotelIds,
      checkin:  CHECKIN,
      checkout: CHECKOUT,
      adults:   2,
      currency: 'USD'
    },
    { headers: { 'X-API-Key': process.env.LITEAPI_KEY } }
  );
  return res.data.data || [];
}

// ─── Classify hotels into hostels vs private rooms ───────────────────────────

function classify(hotels) {
  const hostels  = [];
  const privates = [];

  for (const h of hotels) {
    const name = (h.name || '').toLowerCase();
    const type = (h.hotelType || h.type || '').toLowerCase();
    if (name.includes('hostel') || name.includes('backpacker') || type.includes('hostel')) {
      hostels.push(h);
    } else {
      privates.push(h);
    }
  }
  return { hostels, privates };
}

// ─── Extract cheapest rate from a hotel rate object ──────────────────────────

function cheapestRate(rateObj) {
  if (!rateObj || !rateObj.roomTypes) return null;
  let min = Infinity;
  let roomName = '';
  for (const room of rateObj.roomTypes) {
    for (const rate of (room.rates || [])) {
      const price = rate.retailRate?.total?.[0]?.amount ?? Infinity;
      if (price < min) { min = price; roomName = room.name || ''; }
    }
  }
  return min === Infinity ? null : { amount: min, roomName };
}

// ─── Build a concise data summary for Claude ─────────────────────────────────

function buildDataSummary(city, country, hotelRates, hostels, privates) {
  const hotelRateMap = {};
  for (const r of hotelRates) hotelRateMap[r.hotelId] = r;

  const hostelPrices  = hostels.map(h  => cheapestRate(hotelRateMap[h.id])).filter(Boolean);
  const privatePrices = privates.map(h => cheapestRate(hotelRateMap[h.id])).filter(Boolean);

  const avg = arr => arr.length ? (arr.reduce((s, x) => s + x.amount, 0) / arr.length).toFixed(2) : null;
  const min = arr => arr.length ? Math.min(...arr.map(x => x.amount)).toFixed(2) : null;

  return {
    city,
    country,
    checkin:  CHECKIN,
    checkout: CHECKOUT,
    adults:   2,
    hostels: {
      count:      hostelPrices.length,
      cheapest:   min(hostelPrices),
      average:    avg(hostelPrices)
    },
    privateRooms: {
      count:      privatePrices.length,
      cheapest:   min(privatePrices),
      average:    avg(privatePrices)
    }
  };
}

// ─── Claude recommendation ───────────────────────────────────────────────────

async function askClaude(summary, userMessage) {
  const systemPrompt = `You are Wanderly 🌍, a fun and savvy travel companion for couples! You help couples decide whether to stay in hostels or private hotel rooms when they travel. Your personality: upbeat, witty, emoji-loving, and genuinely helpful. You give concrete, opinionated recommendations backed by real pricing data. Keep each response conversational and under 220 words. Always end with a clear verdict line like:

🏆 Verdict: [Hostel ✅ / Private Room ✅] — [one punchy reason]

Context to weave into advice: privacy matters for couples, local vibe, value for money, what $X buys you in that specific city, and any fun cultural notes.`;

  const dataContext = summary
    ? `\n\nHere is the live LiteAPI pricing data for ${summary.city}, ${summary.country} (check-in ${summary.checkin}, check-out ${summary.checkout}, 2 adults, 1 night):\n` +
      `• Hostels found: ${summary.hostels.count} — cheapest $${summary.hostels.cheapest ?? 'N/A'}/night, avg $${summary.hostels.average ?? 'N/A'}/night\n` +
      `• Private hotels found: ${summary.privateRooms.count} — cheapest $${summary.privateRooms.cheapest ?? 'N/A'}/night, avg $${summary.privateRooms.average ?? 'N/A'}/night\n`
    : '';

  const res = await axios.post(
    CLAUDE_API,
    {
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system:     systemPrompt,
      messages: [
        { role: 'user', content: `${userMessage}${dataContext}` }
      ]
    },
    {
      headers: {
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json'
      }
    }
  );

  return res.data.content[0].text;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/recommend — main recommendation endpoint
app.post('/api/recommend', async (req, res) => {
  const { city, countryCode, country, userMessage } = req.body;

  if (!city || !countryCode) {
    return res.status(400).json({ error: 'city and countryCode are required' });
  }

  try {
    // 1. Fetch hotels from LiteAPI
    const hotels = await fetchHotels(countryCode, city);

    // 2. Classify hostels vs private hotels
    const { hostels, privates } = classify(hotels);

    // 3. Fetch rates (up to 20 hotels total to keep it fast)
    const sampleIds = [
      ...hostels.slice(0, 10).map(h => h.id),
      ...privates.slice(0, 10).map(h => h.id)
    ].filter(Boolean);

    let hotelRates = [];
    if (sampleIds.length > 0) {
      try {
        hotelRates = await fetchRates(sampleIds);
      } catch {
        // Rates fetch failed — Claude will still respond with general knowledge
      }
    }

    // 4. Build data summary
    const summary = buildDataSummary(city, country || countryCode, hotelRates, hostels, privates);

    // 5. Ask Claude
    const message  = userMessage || `Should my partner and I stay in a hostel or private room in ${city}, ${country || countryCode}?`;
    const aiReply  = await askClaude(summary, message);

    res.json({ reply: aiReply, summary });
  } catch (err) {
    console.error('Recommendation error:', err.response?.data || err.message);
    // Gracefully fall back to Claude without pricing data
    try {
      const message = userMessage || `Should a couple stay in a hostel or private room in ${city}, ${country || countryCode}?`;
      const aiReply = await askClaude(null, message);
      res.json({ reply: aiReply, summary: null, note: 'LiteAPI data unavailable — using general knowledge' });
    } catch (claudeErr) {
      res.status(500).json({ error: 'Both LiteAPI and Claude API failed. Check your API keys.' });
    }
  }
});

// POST /api/chat — free-form chat with Wanderly
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    const reply = await askClaude(null, message);
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Claude API failed. Check ANTHROPIC_API_KEY.' });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✈️  Claude-Travel running at http://localhost:${PORT}\n`);
});
