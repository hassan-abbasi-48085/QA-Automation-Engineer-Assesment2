// Single source of test configuration. Every value can be overridden by an env var.
import { randomUUID } from 'node:crypto';

function positiveNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number, got "${raw}"`);
  return value;
}

const DEFAULT_WAIT_MS = 15000;

export const config = Object.freeze({
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  nodeRedUrl: process.env.NODE_RED_URL || 'http://localhost:1880',
  ordersTopic: process.env.ORDERS_TOPIC || 'qa.orders.v1',
  processedTopic: process.env.PROCESSED_TOPIC || 'qa.orders.processed.v1',
  nodeRedConsumerGroup: process.env.CONSUMER_GROUP_ID || 'nodered-order-processor',
  waitMs: positiveNumber('TEST_WAIT_MS', DEFAULT_WAIT_MS),
});

/** Unique per-run identifier, used as correlation ID and to name test consumer groups. */
export function newRunId(prefix) {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

/** Rejects after `ms` with a descriptive message; the timer is always cleared. */
export async function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms waiting for ${what}`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
