'use strict';

// Per-scenario state (the Cucumber "World") plus the cleanup hook.

const { World, setWorldConstructor, setDefaultTimeout, After, Status } = require('@cucumber/cucumber');
const api = require('./gorest');

setDefaultTimeout(20 * 1000);

class GoRestWorld extends World {
  constructor(options) {
    super(options);
    this.baseUrl = api.DEFAULT_BASE_URL;
    this.token = null; // set by the "valid bearer token" step
    this.payload = undefined; // last payload built or sent
    this.response = undefined; // last response
    this.createdUser = undefined; // user created in this scenario
    this.createdUserId = undefined;
    this.requestCount = 0;
    this.cleanupIds = new Set();
  }

  /** Sends a request with this scenario's token unless a token option is given. */
  async send(method, path, { body, token } = {}) {
    this.requestCount += 1;
    const useToken = token === undefined ? this.token : token;
    this.response = await api.request(this.baseUrl, method, this.resolvePath(path), { body, token: useToken });
    return this.response;
  }

  /** Replaces the {created user ID} placeholder used in the feature files. */
  resolvePath(path) {
    if (!path.includes('{created user ID}')) return path;
    if (this.createdUserId === undefined) {
      throw new Error(`No user ID was captured in this scenario, so "${path}" cannot be called.`);
    }
    return path.replace('{created user ID}', String(this.createdUserId));
  }

  /** Remembers any user the API returned so the After hook deletes it. */
  track(body) {
    if (body && typeof body === 'object' && !Array.isArray(body) && body.id !== undefined) {
      this.cleanupIds.add(body.id);
    }
  }

  /** Creates a user as test setup, tracks it, and stores it as the created user. */
  async createUser(payload = api.buildUserPayload()) {
    const res = await this.send('POST', '/users', { body: payload });
    this.track(res.body);
    if (res.status !== 201) throw new Error(api.describeResponse('Setup POST /users', res));
    this.payload = payload;
    this.createdUser = res.body;
    this.createdUserId = res.body.id;
    return res.body;
  }
}

setWorldConstructor(GoRestWorld);

/**
 * Deletes every user created in the scenario, including any the API accepted
 * by mistake in a negative test. 204 and 404 both count as cleaned up.
 * If the scenario already failed, cleanup errors are only warnings, so the
 * original assertion failure stays the reported cause.
 */
After(async function ({ result }) {
  const errors = [];
  for (const id of this.cleanupIds) {
    try {
      const res = await api.request(this.baseUrl, 'DELETE', `/users/${id}`, { token: this.token });
      if (res.status !== 204 && res.status !== 404) errors.push(api.describeResponse(`Cleanup DELETE /users/${id}`, res));
    } catch (err) {
      errors.push(`Cleanup DELETE /users/${id} failed: ${err.message}`);
    }
  }
  if (errors.length === 0) return;
  if (result && result.status === Status.FAILED) {
    errors.forEach((e) => console.warn(`Warning: ${e}`));
  } else {
    throw new Error(errors.join('\n'));
  }
});
