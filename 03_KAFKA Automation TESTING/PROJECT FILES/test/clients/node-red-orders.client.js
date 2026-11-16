// Client object for the Node-RED producer flow's HTTP trigger (POST /orders).
// Tests describe *what* they do (createOrder) and never build raw HTTP requests.
import { config } from '../support/config.js';

export class NodeRedOrdersClient {
  constructor({ baseUrl = config.nodeRedUrl, timeoutMs = config.waitMs } = {}) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Submits an order to the producer flow.
   * @returns {Promise<{ status: number, body: object }>} HTTP status and parsed JSON body
   */
  async createOrder(orderRequest, { correlationId } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (correlationId) headers['x-correlation-id'] = correlationId;

    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(orderRequest),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    return { status: res.status, body };
  }
}
