"use strict";

/**
 * ============================================================
 *  THE HEARING AID DOCTOR — SITE EDITOR SERVER  (fixed)
 *
 *  URLS:
 *    http://localhost:3333        → Public website  (index.html)
 *    http://localhost:3333/admin  → Editor UI       (editor.html)
 *
 *  SETUP:
 *    1. Put server.js, index.html, and editor.html in the SAME folder
 *    2. Run:  node server.js
 *    3. Open: http://localhost:3333/admin
 *
 *  CREDENTIALS (change these):
 *    ED_USER = "admin"
 *    ED_PASS = "hearingdoctor2026"
 * ============================================================
 */

const http    = require("http");
const fs      = require("fs");
const path    = require("path");
const { URL } = require("url");

/* ── CONFIG ── */
const PORT = process.env.PORT || 3333;
const ED_USER     = "admin";
const ED_PASS     = "hearingdoctor2026";
const SITE_FILE   = path.join(__dirname, "index.html");
const EDITOR_FILE = path.join(__dirname, "editor.html");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const BACKUPS_DIR = path.join(__dirname, "backups");

/* ── ENSURE DIRS EXIST ── */
[UPLOADS_DIR, BACKUPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/* ── AUTO-CREATE BLANK index.html IF MISSING (prevents 404 on first run) ── */
if (!fs.existsSync(SITE_FILE)) {
  fs.writeFileSync(SITE_FILE, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Website</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 80px 24px; background: #f9fafb; color: #333; }
    h1   { font-size: 2.5rem; margin-bottom: 16px; }
    p    { color: #666; font-size: 1.1rem; }
    a    { color: #1e6b6b; }
  </style>
</head>
<body>
  <h1>Welcome!</h1>
  <p>Open the <a href="/admin">Site Editor</a> to start building your page.</p>
</body>
</html>`, "utf8");
  console.log("  📄  Created blank index.html (none was found)");
}

/* ── MIME TYPES ── */
const MIME = {
  ".html" : "text/html; charset=utf-8",
  ".css"  : "text/css",
  ".js"   : "application/javascript",
  ".json" : "application/json",
  ".jpg"  : "image/jpeg",
  ".jpeg" : "image/jpeg",
  ".png"  : "image/png",
  ".gif"  : "image/gif",
  ".webp" : "image/webp",
  ".svg"  : "image/svg+xml",
  ".ico"  : "image/x-icon",
  ".woff" : "font/woff",
  ".woff2": "font/woff2",
};

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

/* ── SET CORS HEADERS ── */
function setCORS(res, contentType) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Auth, Authorization");
  if (contentType) res.setHeader("Content-Type", contentType);
}

/* ── COLLECT FULL BODY AS BUFFER (safe for large HTML saves) ── */
function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data",  chunk => chunks.push(chunk));
    req.on("end",   ()    => resolve(Buffer.concat(chunks)));
    req.on("error", err   => reject(err));
  });
}

/* ── MULTIPART PARSER for image uploads ── */
function parseMultipart(bodyBuf, boundary) {
  const parts = [];
  const sep   = Buffer.from("--" + boundary);
  let pos     = 0;
  while (pos < bodyBuf.length) {
    const sepIdx = bodyBuf.indexOf(sep, pos);
    if (sepIdx === -1) break;
    const hdrStart = sepIdx + sep.length + 2;
    const hdrEnd   = bodyBuf.indexOf(Buffer.from("\r\n\r\n"), hdrStart);
    if (hdrEnd === -1) break;
    const headers   = bodyBuf.slice(hdrStart, hdrEnd).toString();
    const dataStart = hdrEnd + 4;
    const nextSep   = bodyBuf.indexOf(sep, dataStart);
    const dataEnd   = nextSep === -1 ? bodyBuf.length - 2 : nextSep - 2;
    const data      = bodyBuf.slice(dataStart, dataEnd);
    const nameMatch = headers.match(/name="([^"]+)"/);
    const fileMatch = headers.match(/filename="([^"]+)"/);
    if (nameMatch) parts.push({ name: nameMatch[1], filename: fileMatch ? fileMatch[1] : null, data });
    pos = dataEnd + 2;
  }
  return parts;
}

/* ── STRIP EDITOR ARTEFACTS BEFORE SAVING TO DISK ── */
function cleanHtml(html) {
  return html
    .replace(/<meta name="editor-mode"[^>]*>\s*\n?/g,     "")
    .replace(/<style id="__ed-styles">[\s\S]*?<\/style>\s*/g, "")
    .replace(/\s+class="editor-active"/g,                  "")
    .replace(/\s+data-editable="[^"]*"/g,                  "")
    .replace(/\s+data-ed-id="[^"]*"/g,                     "")
    .replace(/\s+contenteditable="[^"]*"/g,                "")
    .replace(/\b__ed-(hover|selected|sel)\b\s*/g,          "")
    .replace(/\s+class=""/g,                               "")
    .replace(/<div class="ed-section-controls"[\s\S]*?<\/div>/g, "");
}

/* ── BACKUP index.html, KEEP LAST 15 ── */
function backupSite() {
  if (!fs.existsSync(SITE_FILE)) return;
  const ts   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.copyFileSync(SITE_FILE, path.join(BACKUPS_DIR, `backup-${ts}.html`));
  const all = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith("backup-")).sort();
  if (all.length > 15) {
    all.slice(0, all.length - 15).forEach(f => {
      try { fs.unlinkSync(path.join(BACKUPS_DIR, f)); } catch {}
    });
  }
}

/* ============================================================
   HTTP SERVER
============================================================ */
const server = http.createServer(async (req, res) => {
  setCORS(res);

  // Preflight
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  try {

    /* ─── GET / ─── public website */
    if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(SITE_FILE));
      return;
    }

    /* ─── GET /admin ─── editor UI */
    if (req.method === "GET" && (pathname === "/admin" || pathname === "/admin/")) {
      if (!fs.existsSync(EDITOR_FILE)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("editor.html not found — place it in the same folder as server.js");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(EDITOR_FILE));
      return;
    }

    /* ─── GET /ping ─── health check */
    if (req.method === "GET" && pathname === "/ping") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, time: new Date().toISOString() }));
      return;
    }

    /* ─── GET /images ─── list uploaded images (media gallery) */
    if (req.method === "GET" && pathname === "/images") {
      const images = fs.readdirSync(UPLOADS_DIR)
        .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()) &&
                     fs.statSync(path.join(UPLOADS_DIR, f)).isFile())
        .sort((a, b) => fs.statSync(path.join(UPLOADS_DIR, b)).mtimeMs -
                        fs.statSync(path.join(UPLOADS_DIR, a)).mtimeMs)
        .map(f => `/uploads/${f}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, images }));
      return;
    }

    /* ─── GET /uploads/* ─── serve uploaded file */
    if (req.method === "GET" && pathname.startsWith("/uploads/")) {
      const safe = path.basename(pathname);
      const fp   = path.join(UPLOADS_DIR, safe);
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        const ext = path.extname(fp).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(fs.readFileSync(fp));
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found");
      }
      return;
    }

    /* ─── POST /save ─── write HTML to index.html */
    if (req.method === "POST" && pathname === "/save") {
      const buf = await collectBody(req);
      let payload;
      try   { payload = JSON.parse(buf.toString("utf8")); }
      catch { res.writeHead(400, {"Content-Type":"application/json"}); res.end(JSON.stringify({error:"Invalid JSON"})); return; }

      const { html } = payload;
      if (!html || typeof html !== "string") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing html field" }));
        return;
      }
      backupSite();
      const clean = cleanHtml(html);
      fs.writeFileSync(SITE_FILE, clean, "utf8");
      console.log(`[${new Date().toLocaleTimeString()}] ✅ Saved index.html (${(clean.length/1024).toFixed(1)} KB)`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, size: clean.length }));
      return;
    }

    /* ─── POST /upload ─── save uploaded image */
    if (req.method === "POST" && pathname === "/upload") {
      const buf = await collectBody(req);
      const ct  = req.headers["content-type"] || "";
      const bm  = ct.match(/boundary=(.+)/);
      if (!bm) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No multipart boundary in Content-Type header" }));
        return;
      }
      const parts    = parseMultipart(buf, bm[1].trim());
      const filePart = parts.find(p => p.filename);   // accept any field name with a filename
      if (!filePart) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No file found in upload" }));
        return;
      }
      const safeName = Date.now() + "-" + filePart.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      fs.writeFileSync(path.join(UPLOADS_DIR, safeName), filePart.data);
      console.log(`[${new Date().toLocaleTimeString()}] 📷 Uploaded: ${safeName}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, url: `/uploads/${safeName}` }));
      return;
    }

    /* ─── GET * ─── static file fallback (CSS, JS, fonts, images, etc.) */
    if (req.method === "GET") {
      const safe = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
      const fp   = path.join(__dirname, safe);
      if (fp.startsWith(__dirname) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
        const ext = path.extname(fp).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(fs.readFileSync(fp));
        return;
      }
    }

    /* ─── 404 ─── */
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found", path: pathname }));

  } catch (err) {
    console.error(`[ERROR] ${req.method} ${pathname} →`, err.message);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
});

/* ── START ── */
server.listen(PORT, () => {
  console.log("");
  console.log("  ╔═══════════════════════════════════════════════════╗");
  console.log("  ║   ✏️  Hearing Aid Doctor — Site Editor Server      ║");
  console.log("  ╚═══════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  🌐  Public site  : http://localhost:${PORT}`);
  console.log(`  🔐  Editor       : http://localhost:${PORT}/admin`);
  console.log("");
  console.log(`  📄  Website file : ${SITE_FILE}`);
  console.log(`  ✏️   Editor file  : ${EDITOR_FILE}`);
  console.log(`  💾  Backups      : ${BACKUPS_DIR}`);
  console.log(`  🖼️   Uploads      : ${UPLOADS_DIR}`);
  console.log("");
  console.log(`  Login → ${ED_USER} / ${ED_PASS}`);
  console.log("");
  console.log("  Press Ctrl+C to stop.");
  console.log("");
});

server.on("error", e => {
  if (e.code === "EADDRINUSE") {
    console.error(`\n  ❌  Port ${PORT} is already in use.`);
    console.error(`  Run this to free it:  kill $(lsof -ti:${PORT})\n`);
  } else {
    console.error("\n  ❌  Server error:", e.message);
  }
});
