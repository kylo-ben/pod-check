// api/scrape.js
// Vercel serverless function — server-side only, holds the ScryCheck API secret.
// Proxies the official ScryCheck private-beta API and normalizes the response into
// the deckData shape the rest of the app already expects.
//
// The secret MUST stay server-side (ScryCheck forbids browser-side calls / committing
// it). Set SCRYCHECK_API_KEY in Vercel env vars + local .env.local (git-ignored).
//
// Usage: GET /api/scrape?url=https://moxfield.com/decks/... (or archidekt.com/...)

const SCRYCHECK_ENDPOINT = "https://scrycheck.com/api/v1/analyze";

// Supported deck sources per the API docs: public Archidekt & Moxfield URLs.
function isSupportedDeckUrl(raw) {
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    return host === "moxfield.com" || host === "archidekt.com";
  } catch {
    return false;
  }
}

// ScryCheck error code → [http status, user-facing message].
const ERROR_MAP = {
  INVALID_REQUEST: [400, "That deck link didn't look right. Double-check the URL."],
  UNSUPPORTED_SOURCE: [400, "That link isn't from a supported site. Use a public Archidekt or Moxfield deck URL."],
  SOURCE_UNAVAILABLE: [404, "Couldn't read that deck — it may be private, deleted, or the site is down."],
  TEMPORARILY_UNAVAILABLE: [429, "ScryCheck is busy right now. Wait a moment and try again."],
  ANALYSIS_FAILED: [502, "ScryCheck couldn't analyze that deck. Try again."],
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = process.env.SCRYCHECK_API_KEY;
  if (!API_KEY) {
    console.error("SCRYCHECK_API_KEY is not set.");
    return res.status(500).json({ error: "Deck analysis isn't configured yet. Ping the host." });
  }

  const { url } = req.query;

  if (!url || !isSupportedDeckUrl(url)) {
    return res.status(400).json({
      error: "Paste a public Archidekt or Moxfield deck URL (e.g. moxfield.com/decks/… or archidekt.com/decks/…).",
    });
  }

  try {
    const apiRes = await fetch(SCRYCHECK_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    // A bare 404 from ScryCheck means the secret is missing/incorrect (intentional
    // per the docs). Don't leak that — surface as a generic config error.
    if (apiRes.status === 404) {
      console.error("ScryCheck returned 404 — check SCRYCHECK_API_KEY.");
      return res.status(500).json({ error: "Deck analysis isn't configured yet. Ping the host." });
    }

    let json;
    try {
      json = await apiRes.json();
    } catch {
      return res.status(502).json({ error: "Unexpected response from ScryCheck. Try again." });
    }

    if (!json || json.success === false) {
      const code = json?.error?.code;
      const [status, message] = ERROR_MAP[code] ?? [502, json?.error?.message || "Deck analysis failed. Try again."];
      return res.status(status).json({ error: message });
    }

    const data = json.data || {};
    const deckData = normalize(data);

    // Cache for 5 minutes — matches ScryCheck's own caching; results rarely change.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return res.status(200).json(deckData);
  } catch (err) {
    console.error("ScryCheck proxy error:", err);
    return res.status(500).json({ error: "Failed to reach ScryCheck. Try again." });
  }
}

// Map the rich API response onto the deckData contract used across the app.
// Keeps the (misspelled) `scrychecUrl` key — it's load-bearing in every consumer.
function normalize(data) {
  const v = data.vectors || {};
  return {
    commander: data.commanders?.[0] ?? data.name ?? "Unknown Commander",
    power: data.powerLevel?.level ?? null,
    margin: data.powerLevel?.interval?.margin ?? null,
    tier: data.powerLevel?.tier ?? data.powerLevel?.label ?? null,
    bracket: data.bracket?.number ?? null,
    vectors: {
      velocity: v.velocity ?? null,
      consistency: v.consistency ?? null,
      interaction: v.interaction ?? null,
      efficiency: v.efficiency ?? null,
      lethality: v.lethality ?? null,
    },
    winTurn: data.winSpeed?.typical ?? data.winSpeed?.earliest ?? null,
    themes: data.summary?.themes ?? [],
    warnings: data.summary?.warnings ?? [],
    incomplete: data.incomplete ?? false,
    scrychecUrl: data.deckUrl ?? null,
  };
}
