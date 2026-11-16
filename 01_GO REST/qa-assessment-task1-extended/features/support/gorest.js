'use strict';

// Thin GoREST API client and test-data helpers. No Cucumber code in here.

const DEFAULT_BASE_URL = 'https://gorest.co.in/public/v2';
const TOKEN_ENV_VAR = 'GOREST_TOKEN';

const VALID_GENDERS = ['male', 'female'];
const VALID_STATUSES = ['active', 'inactive'];

const MISSING_TOKEN_MESSAGE =
  `Missing credentials: the ${TOKEN_ENV_VAR} environment variable is not set. ` +
  'Get a token at https://gorest.co.in/consumer/login and set GOREST_TOKEN ' +
  'before running "npm test" (see DOCS/README.md).';

/** Returns the trimmed token, or throws a clear error if it is missing. */
function readToken(value) {
  const token = (value || '').trim();
  if (!token) throw new Error(MISSING_TOKEN_MESSAGE);
  return token;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** Builds a valid user with a unique name and email. Overrides inject test values. */
function buildUserPayload(overrides = {}) {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  return {
    name: `QA Automation ${unique}`,
    email: `qa.automation.${unique}@example.com`,
    gender: pick(VALID_GENDERS),
    status: pick(VALID_STATUSES),
    ...overrides,
  };
}

/**
 * Sends a request and returns { status, contentType, body }.
 * token: null -> no Authorization header, string -> "Bearer <token>".
 * Request headers are never returned or logged, so the token cannot leak.
 */
async function request(baseUrl, method, path, { body, token = null } = {}) {
  const headers = { Accept: 'application/json' };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // keep the raw text
  }
  return { status: response.status, contentType: response.headers.get('content-type') || '', body: parsed };
}

/** Assertion message built from the status and body only, never the headers. */
function describeResponse(label, res) {
  return `${label} returned HTTP ${res.status}: ${JSON.stringify(res.body)}`;
}

/** GoREST returns 422 errors as [{ field, message }]; returns the field names. */
function errorFields(body) {
  return Array.isArray(body) ? body.map((e) => e.field) : [];
}

module.exports = {
  DEFAULT_BASE_URL,
  TOKEN_ENV_VAR,
  MISSING_TOKEN_MESSAGE,
  VALID_GENDERS,
  VALID_STATUSES,
  readToken,
  buildUserPayload,
  request,
  describeResponse,
  errorFields,
};
