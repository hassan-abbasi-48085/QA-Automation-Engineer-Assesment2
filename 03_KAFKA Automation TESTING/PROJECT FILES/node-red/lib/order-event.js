'use strict';
/**
 * OrderCreated v1 event contract, shared by the Node-RED producer and consumer flows.
 * Exposed to function nodes through functionGlobalContext as global.get('orderEvent').
 * The JSON Schema in docs/order-created.v1.schema.json describes the same contract.
 */
const crypto = require('crypto');

const SCHEMA_VERSION = 1;
const EVENT_TYPE = 'OrderCreated';
const REQUIRED_INPUT_FIELDS = ['orderId', 'customerId', 'currency', 'items'];
const CURRENCY_PATTERN = /^[A-Z]{3}$/; // ISO 4217 alpha code
const NOT_AN_OBJECT = 'body must be a JSON object';

/** A field counts as supplied unless it is undefined, null or an empty string. */
function isPresent(v) {
  return v !== undefined && v !== null && v !== '';
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Validates the business fields a client must supply. Returns an array of error strings. */
function validateInput(input) {
  const errors = [];
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return [NOT_AN_OBJECT];
  }
  for (const field of REQUIRED_INPUT_FIELDS) {
    if (!isPresent(input[field])) {
      errors.push(`${field} is required`);
    }
  }
  if (isPresent(input.orderId) && !isNonEmptyString(input.orderId)) {
    errors.push('orderId must be a non-empty string');
  }
  if (isPresent(input.customerId) && !isNonEmptyString(input.customerId)) {
    errors.push('customerId must be a non-empty string');
  }
  if (isPresent(input.currency) && !CURRENCY_PATTERN.test(input.currency)) {
    errors.push('currency must be a 3-letter ISO 4217 code');
  }
  if (isPresent(input.items)) {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      errors.push('items must be a non-empty array');
    } else {
      input.items.forEach((item, i) => {
        if (!item || !isNonEmptyString(item.sku)) errors.push(`items[${i}].sku is required`);
        if (!item || !Number.isInteger(item.quantity) || item.quantity < 1)
          errors.push(`items[${i}].quantity must be an integer >= 1`);
        if (!item || typeof item.unitPrice !== 'number' || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
          errors.push(`items[${i}].unitPrice must be a number >= 0`);
        }
      });
    }
  }
  return errors;
}

/** Validates a complete event read from Kafka (envelope + business fields). */
function validateEvent(event) {
  const errors = validateInput(event);
  if (errors.length === 1 && errors[0] === NOT_AN_OBJECT) return errors;
  if (event.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (event.eventType !== EVENT_TYPE) errors.push(`eventType must be ${EVENT_TYPE}`);
  if (!isNonEmptyString(event.eventId)) errors.push('eventId is required');
  if (!isNonEmptyString(event.correlationId)) errors.push('correlationId is required');
  if (!isNonEmptyString(event.occurredAt) || Number.isNaN(Date.parse(event.occurredAt))) {
    errors.push('occurredAt must be an ISO-8601 timestamp');
  }
  return errors;
}

/** Wraps validated client input in the event envelope. */
function buildEvent(input, correlationId) {
  return {
    schemaVersion: SCHEMA_VERSION,
    eventType: EVENT_TYPE,
    eventId: crypto.randomUUID(),
    correlationId: correlationId || crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    orderId: input.orderId,
    customerId: input.customerId,
    currency: input.currency,
    items: input.items.map((i) => ({ sku: i.sku, quantity: i.quantity, unitPrice: i.unitPrice })),
  };
}

/** Downstream result emitted by the consumer for a valid event. */
function buildProcessedResult(event, source) {
  const totalAmount = Math.round(event.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) * 100) / 100;
  const itemCount = event.items.reduce((sum, i) => sum + i.quantity, 0);
  return {
    schemaVersion: SCHEMA_VERSION,
    eventType: 'OrderProcessed',
    correlationId: event.correlationId,
    sourceEventId: event.eventId,
    orderId: event.orderId,
    customerId: event.customerId,
    currency: event.currency,
    itemCount,
    totalAmount,
    status: 'PROCESSED',
    source,
    processedAt: new Date().toISOString(),
  };
}

module.exports = {
  SCHEMA_VERSION,
  EVENT_TYPE,
  validateInput,
  validateEvent,
  buildEvent,
  buildProcessedResult,
};
