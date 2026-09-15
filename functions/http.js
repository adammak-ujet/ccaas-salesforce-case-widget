// Shared CORS + lightweight API-key check for all three HTTP functions.

function applyCors(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "";
  if (allowedOrigin) {
    res.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  res.set("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Widget-Key");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true; // caller should stop handling this request
  }
  return false;
}

// Basic anti-scraping check — not real authorization. The key lives in the
// widget's own public JS, so anyone can read it; this only raises the bar
// above "totally open endpoint".
function checkApiKey(req, res) {
  const expected = process.env.WIDGET_API_KEY;
  if (!expected) return true; // no key configured, allow through
  if (req.get("X-Widget-Key") === expected) return true;
  res.status(401).json({ error: "Missing or invalid X-Widget-Key header." });
  return false;
}

module.exports = { applyCors, checkApiKey };
