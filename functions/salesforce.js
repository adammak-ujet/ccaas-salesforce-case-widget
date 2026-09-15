// Shared Salesforce auth (JWT Bearer flow) + REST/SOQL helpers used by all three
// Cloud Run Functions. Token is cached in a module-level variable, which persists
// for the lifetime of a warm Cloud Run instance (not across cold starts) — fine for
// demo-scale traffic, avoids signing a fresh JWT on every request.

const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");

const API_VERSION = process.env.SF_API_VERSION || "v60.0";
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000; // refresh 60s before expiry

let cachedToken = null; // { accessToken, instanceUrl, expiresAt }

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function privateKey() {
  // Cloud Run env vars / secrets often arrive with literal "\n" instead of real
  // newlines — normalize either form.
  return requiredEnv("SF_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function buildAssertion() {
  const consumerKey = requiredEnv("SF_CONSUMER_KEY");
  const username = requiredEnv("SF_USERNAME");
  const loginUrl = requiredEnv("SF_LOGIN_URL"); // e.g. https://login.salesforce.com

  return jwt.sign({}, privateKey(), {
    algorithm: "RS256",
    issuer: consumerKey,
    subject: username,
    audience: loginUrl,
    expiresIn: "3m",
  });
}

async function fetchNewToken() {
  const loginUrl = requiredEnv("SF_LOGIN_URL");
  const assertion = buildAssertion();

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Salesforce OAuth token request failed: ${res.status} ${JSON.stringify(data)}`);
  }

  cachedToken = {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
    // Salesforce JWT bearer tokens don't return an expiry; assume the same
    // lifetime as the JWT itself and refresh proactively well before then.
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  return cachedToken;
}

async function getToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_MS > Date.now()) {
    return cachedToken;
  }
  return fetchNewToken();
}

async function sfRequest(path, options = {}, { retried = false } = {}) {
  const token = await getToken();
  const res = await fetch(`${token.instanceUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && !retried) {
    await getToken({ forceRefresh: true });
    return sfRequest(path, options, { retried: true });
  }

  return res;
}

async function soqlQuery(soql) {
  const res = await sfRequest(`/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(`SOQL query failed: ${res.status} ${JSON.stringify(data)}`);
  return data.records || [];
}

async function patchSObject(sobjectType, id, fields) {
  const res = await sfRequest(`/services/data/${API_VERSION}/sobjects/${sobjectType}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Failed to update ${sobjectType} ${id}: ${res.status} ${JSON.stringify(data)}`);
  }
}

// Escapes a value for safe interpolation into a SOQL string literal.
function soqlEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

module.exports = { soqlQuery, patchSObject, soqlEscape };
