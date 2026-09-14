// Kartograf short-link redirector.
//
// A tiny, dependency-free HTTP server: POST /api/create stores a share
// payload and hands back a short id; GET /:id 302-redirects to the full
// map.javohir.ru share URL. Data lives in a single JSON file on a mounted
// volume — traffic here is expected to stay low (personal poster shares),
// so a flat file beats pulling in a database for this.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 8080;
const DATA_FILE = process.env.DATA_FILE || '/data/links.json';
const TARGET_ORIGIN = process.env.TARGET_ORIGIN || 'https://map.javohir.ru';
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || TARGET_ORIGIN).split(',').map((s) => s.trim())
);

// Codes come from lib/share.ts's lz-string output plus our own JSON framing;
// this is a generous ceiling to block accidental/abusive oversized bodies,
// not a tight fit to real payload sizes.
const MAX_CODE_LENGTH = 20_000;
const MAX_BODY_BYTES = 32_768;
const ID_LENGTH = 6;
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no 0/O/1/l/I
const ID_RE = /^[A-Za-z0-9]{4,12}$/;

function loadLinks() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveLinks(links) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(links));
  fs.renameSync(tmp, DATA_FILE); // atomic swap — a crash mid-write can't corrupt the real file
}

function randomId() {
  let id = '';
  const bytes = crypto.randomBytes(ID_LENGTH);
  for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return id;
}

function withCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  withCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/create') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid body' }));
      return;
    }
    const code = typeof body.code === 'string' ? body.code : '';
    if (!code || code.length > MAX_CODE_LENGTH) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid or oversized code' }));
      return;
    }

    const links = loadLinks();

    // Reuse an existing id for an identical payload instead of growing the
    // store with duplicates every time the same poster gets re-shared.
    const existing = Object.entries(links).find(([, v]) => v.code === code);
    let id;
    if (existing) {
      id = existing[0];
    } else {
      do {
        id = randomId();
      } while (links[id]);
      links[id] = { code, createdAt: Date.now() };
      saveLinks(links);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Kartograf short links.');
    return;
  }

  if (req.method === 'GET') {
    const id = url.pathname.slice(1);
    if (ID_RE.test(id)) {
      const links = loadLinks();
      const entry = links[id];
      const dest = entry
        ? `${TARGET_ORIGIN}/?s=${entry.code}`
        : `${TARGET_ORIGIN}/`;
      res.writeHead(302, { Location: dest });
      res.end();
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`shortlink server listening on :${PORT}`);
});
