// Mocktail Matcher - describe what you feel like ("fruity and fizzy for a summer party"), and QVAC embeddings on YOUR
// machine find alcohol-free drinks that fit. Open http://localhost:3076 after starting.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DRINKS } from "./drinks.js";

// The QVAC worker can be slow to start on some computers. Wait up to 3 minutes for it.
process.env.QVAC_RPC_INIT_TIMEOUT_MS ??= "180000";
const { loadModel, embed, EMBEDDINGGEMMA_300M_Q4_0 } = await import("@qvac/sdk");

const PORT = 3076;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Step 1: load the AI model (downloads the first time, then it's cached) ----
let modelId = null;
const status = { ready: false, message: "Starting...", percent: null, error: null };
async function startModel() {
  try {
    status.message = "Loading the AI model (first run downloads it)...";
    modelId = await loadModel({
      modelSrc: EMBEDDINGGEMMA_300M_Q4_0,
      modelType: "embeddings",
      onProgress: (p) => { const v = typeof p === "number" ? p : p?.percentage; if (typeof v === "number") status.percent = Math.round(v); },
    });
    status.ready = true; status.message = "Drink matching ready";
    console.log("Model loaded. Open http://localhost:" + PORT);
  } catch (err) { status.error = String(err?.message || err); console.error("Could not load model:", err); }
}

// One AI job at a time
let chain = Promise.resolve();
const enqueue = (job) => { const p = chain.then(job); chain = p.catch(() => {}); return p; };

function readBody(req, limit = 10000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > limit) { reject(new Error("Too big")); req.destroy(); } });
    req.on("end", () => resolve(data)); req.on("error", reject);
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const clean = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);

// ---- Step 2: turn text into numbers (an "embedding") with QVAC. Similar meanings get similar numbers. ----
const cache = new Map();
async function vectors(texts) {
  if (cache.size > 1500) cache.clear();
  const missing = [...new Set(texts.filter((t) => !cache.has(t)))];
  for (let i = 0; i < missing.length; i += 16) {
    const batch = missing.slice(i, i + 16);
    const out = await embed({ modelId, text: batch }); // This is the QVAC call
    const emb = out.embedding ?? out.embeddings ?? out;
    const rows = Array.isArray(emb[0]) ? emb : [emb];
    batch.forEach((t, k) => cache.set(t, rows[k]));
  }
  return texts.map((t) => cache.get(t));
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function match(mood, avoid) {
  const bad = avoid.toLowerCase().split(/[,;]/).map((x) => x.trim().replace(/s$/, "")).filter((x) => x.length > 1);
  const list = DRINKS.map((d, i) => ({ d, i })).filter((x) => !bad.some((a) => (x.d.name + " " + x.d.ingredients.join(" ")).toLowerCase().includes(a)));
  if (!list.length) return [];
  const [mv, ...dv] = await vectors([mood, ...list.map((x) => x.d.name + ". " + x.d.taste)]);
  return list.map((x, k) => ({ i: x.i, score: cosine(mv, dv[k]) })).sort((a, b) => b.score - a.score).slice(0, 5).map((r) => r.i);
}

// ---- Step 3: the web server ----
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(await readFile(path.join(__dirname, "public", "index.html")));
    }
    if (req.method === "GET" && req.url === "/api/status") return json(res, 200, status);
    if (req.method === "GET" && req.url === "/api/drinks") return json(res, 200, DRINKS);
    if (req.method === "POST" && req.url === "/api/match") {
      if (!status.ready) return json(res, 503, { error: "Drink matching is not ready yet." });
      const b = JSON.parse(await readBody(req)), mood = clean(b.mood, 300), avoid = clean(b.avoid, 200);
      if (!mood) return json(res, 400, { error: "Describe what you feel like first." });
      return json(res, 200, await enqueue(() => match(mood, avoid)));
    }
    res.writeHead(404); res.end("Not found");
  } catch (err) { console.error(err); json(res, 500, { error: String(err?.message || err) }); }
});

// "127.0.0.1" means only YOUR computer can reach this app
server.listen(PORT, "127.0.0.1", () => console.log("Server running at http://localhost:" + PORT));
startModel();
