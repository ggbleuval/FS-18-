"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = path.join(__dirname, "data.json");
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_BODY_BYTES = 16 * 1024;
const SESSION_COOKIE = "fs18_session";
const USERS = {
  Paul: { salt: "jk08ATdZnDLIUy8E7HkyYA==", hash: "iH4eiF+U1GnRul6hq6XLfbAb8LNJ7eZtTnaID9AbSdY=" },
  "Noé": { salt: "4wv3g/LG8qVG12WWZzlwWA==", hash: "TuNQhuUJjEIl1yfF18udysJclDv3L6CPp9cYaySJs6U=" }
};
const sessions = new Map();
const loginAttempts = new Map();
const DUMMY_ACCOUNT = {
  salt: "C8p7w6q5p4o3n2m1l0k9jA==",
  hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
};
let dataQueue = Promise.resolve();

function send(res, status, body, contentType = "text/plain; charset=utf-8", extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'",
    ...extraHeaders
  });
  res.end(body);
}

function sendJson(res, status, value, extraHeaders = {}) {
  send(res, status, JSON.stringify(value), "application/json; charset=utf-8", extraHeaders);
}

function redirect(res, location, extraHeaders = {}) {
  res.writeHead(303, { Location: location, "Cache-Control": "no-store", ...extraHeaders });
  res.end();
}

function cookiesFrom(req) {
  const cookies = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) {
      cookies[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
    }
  }
  return cookies;
}

function getSession(req) {
  const id = cookiesFrom(req)[SESSION_COOKIE];
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(id);
    return null;
  }
  return { id, ...session };
}

function cookieOptions(req) {
  const secure = req.socket.encrypted || req.headers["x-forwarded-proto"] === "https";
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${secure ? "; Secure" : ""}`;
}

function clearCookieOptions(req) {
  const secure = req.socket.encrypted || req.headers["x-forwarded-proto"] === "https";
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

function verifyCredentials(username, password) {
  const knownUser = Object.hasOwn(USERS, username);
  const account = knownUser ? USERS[username] : DUMMY_ACCOUNT;
  const actual = crypto.pbkdf2Sync(password, Buffer.from(account.salt, "base64"), 150000, 32, "sha256");
  const expected = Buffer.from(account.hash, "base64");
  const matches = crypto.timingSafeEqual(actual, expected);
  return knownUser && matches;
}

function loginIsBlocked(ip) {
  const attempt = loginAttempts.get(ip);
  if (!attempt) return false;
  if (Date.now() - attempt.startedAt >= LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (!attempt || now - attempt.startedAt >= LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, startedAt: now });
  } else {
    attempt.count += 1;
  }
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("La requête est trop volumineuse.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(req) {
  const text = await readBody(req);
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    const error = new Error("Requête JSON invalide.");
    error.statusCode = 400;
    throw error;
  }
}

async function readData() {
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.notes)) {
      throw new Error("Le fichier de données ne contient pas une liste de tâches et de notes valide.");
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return { tasks: [], notes: [] };
    throw error;
  }
}

function updateData(change) {
  const operation = dataQueue.then(async () => {
    const data = await readData();
    const result = await change(data);
    if (!result.save) return result.value;
    const temporaryFile = `${DATA_FILE}.tmp`;
    await fs.writeFile(temporaryFile, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporaryFile, DATA_FILE);
    return result.value;
  });
  dataQueue = operation.catch(() => {});
  return operation;
}

function requireSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    const error = new Error("Origine de requête invalide.");
    error.statusCode = 403;
    throw error;
  }
  if (parsedOrigin.host !== req.headers.host) {
    const error = new Error("Requête refusée.");
    error.statusCode = 403;
    throw error;
  }
}

function validateText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    const error = new Error(`${label} est obligatoire et ne doit pas dépasser ${maxLength} caractères.`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

function errorResponse(req, res, error) {
  const status = error.statusCode || 500;
  if (status >= 500) console.error(error);
  if (req.url.startsWith("/api/")) {
    sendJson(res, status, { error: status >= 500 ? "Une erreur interne est survenue." : error.message });
  } else {
    send(res, status, status >= 500 ? "Une erreur interne est survenue." : error.message);
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const session = getSession(req);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    if (!session) return redirect(res, "/login");
    const html = await fs.readFile(path.join(__dirname, "index.html"));
    return send(res, 200, html, "text/html; charset=utf-8");
  }

  if (req.method === "GET" && (url.pathname === "/login" || url.pathname === "/login.html")) {
    if (session) return redirect(res, "/");
    const html = await fs.readFile(path.join(__dirname, "login.html"));
    return send(res, 200, html, "text/html; charset=utf-8");
  }

  if (req.method === "POST" && url.pathname === "/login") {
    requireSameOrigin(req);
    const form = new URLSearchParams(await readBody(req));
    const username = (form.get("username") || "").trim();
    const password = form.get("password") || "";
    const ip = req.socket.remoteAddress || "unknown";
    if (loginIsBlocked(ip) || !verifyCredentials(username, password)) {
      recordFailedLogin(ip);
      return redirect(res, "/login?error=1");
    }
    loginAttempts.delete(ip);
    const id = crypto.randomBytes(32).toString("base64url");
    sessions.set(id, { username, expiresAt: Date.now() + SESSION_TTL_MS });
    return redirect(res, "/", { "Set-Cookie": `${SESSION_COOKIE}=${encodeURIComponent(id)}; ${cookieOptions(req)}` });
  }

  if (req.method === "POST" && url.pathname === "/logout") {
    requireSameOrigin(req);
    if (session) sessions.delete(session.id);
    return redirect(res, "/login", { "Set-Cookie": `${SESSION_COOKIE}=; ${clearCookieOptions(req)}` });
  }

  if (url.pathname.startsWith("/api/")) {
    if (!session) return sendJson(res, 401, { error: "Connexion requise." });
    if (req.method !== "GET") requireSameOrigin(req);

    if (req.method === "GET" && url.pathname === "/api/me") {
      return sendJson(res, 200, { username: session.username });
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      return sendJson(res, 200, await readData());
    }

    if (req.method === "POST" && url.pathname === "/api/tasks") {
      const body = await readJsonBody(req);
      const task = {
        id: crypto.randomUUID(),
        title: validateText(body.title, "Le titre", 100),
        detail: typeof body.detail === "string" ? body.detail.trim().slice(0, 180) : "",
        done: false,
        createdAt: new Date().toISOString(),
        createdBy: session.username
      };
      await updateData(data => {
        data.tasks.unshift(task);
        return { value: null, save: true };
      });
      return sendJson(res, 201, { task });
    }

    const taskMatch = url.pathname.match(/^\/api\/tasks\/([0-9a-f-]{36})$/);
    if (taskMatch && req.method === "PATCH") {
      const body = await readJsonBody(req);
      if (typeof body.done !== "boolean") {
        const error = new Error("Le statut de la tâche est invalide.");
        error.statusCode = 400;
        throw error;
      }
      const task = await updateData(data => {
        const found = data.tasks.find(item => item.id === taskMatch[1]);
        if (!found) return { value: null, save: false };
        found.done = body.done;
        return { value: found, save: true };
      });
      if (!task) return sendJson(res, 404, { error: "Tâche introuvable." });
      return sendJson(res, 200, { task });
    }

    if (taskMatch && req.method === "DELETE") {
      const deleted = await updateData(data => {
        const remaining = data.tasks.filter(item => item.id !== taskMatch[1]);
        if (remaining.length === data.tasks.length) return { value: false, save: false };
        data.tasks = remaining;
        return { value: true, save: true };
      });
      if (!deleted) return sendJson(res, 404, { error: "Tâche introuvable." });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/notes") {
      const body = await readJsonBody(req);
      const note = {
        id: crypto.randomUUID(),
        title: validateText(body.title, "Le titre", 80),
        content: validateText(body.content, "Le contenu", 2000),
        createdAt: new Date().toISOString(),
        createdBy: session.username
      };
      await updateData(data => {
        data.notes.unshift(note);
        return { value: null, save: true };
      });
      return sendJson(res, 201, { note });
    }

    const noteMatch = url.pathname.match(/^\/api\/notes\/([0-9a-f-]{36})$/);
    if (noteMatch && req.method === "DELETE") {
      const deleted = await updateData(data => {
        const remaining = data.notes.filter(item => item.id !== noteMatch[1]);
        if (remaining.length === data.notes.length) return { value: false, save: false };
        data.notes = remaining;
        return { value: true, save: true };
      });
      if (!deleted) return sendJson(res, 404, { error: "Note introuvable." });
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: "Route introuvable." });
  }

  return send(res, 404, "Page introuvable.");
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(error => errorResponse(req, res, error));
});

server.listen(PORT, () => {
  console.log(`Notre ferme est disponible sur http://localhost:${PORT}`);
});
