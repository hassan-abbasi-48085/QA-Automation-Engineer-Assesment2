// Test data builder for orders. Each test starts from a valid default and overrides only
// what matters to it, so the intent of the test stays visible.
import { randomUUID } from 'node:crypto';

const DEFAULT_ITEMS = [
  { sku: 'SKU-RED-MUG', quantity: 2, unitPrice: 12.5 },
  { sku: 'SKU-BLUE-PEN', quantity: 3, unitPrice: 1.25 },
];

class OrderBuilder {
  constructor() {
    this.fields = {
      orderId: `ORD-${randomUUID().slice(0, 8)}`,
      customerId: 'CUST-1001',
      currency: 'USD',
      items: DEFAULT_ITEMS.map((i) => ({ ...i })),
    };
    this.correlationId = randomUUID();
  }

  withOrderId(orderId) {
    this.fields.orderId = orderId;
    return this;
  }

  withCustomerId(customerId) {
    this.fields.customerId = customerId;
    return this;
  }

  withCurrency(currency) {
    this.fields.currency = currency;
    return this;
  }

  withItems(...items) {
    this.fields.items = items.map((i) => ({ ...i }));
    return this;
  }

  withCorrelationId(correlationId) {
    this.correlationId = correlationId;
    return this;
  }

  /** Removes a field, for negative tests such as "missing required field". */
  without(field) {
    delete this.fields[field];
    return this;
  }

  /** Body for POST /orders (the producer adds the envelope). */
  buildRequest() {
    return structuredClone(this.fields);
  }

  /** Complete OrderCreated v1 event, as it would appear on the orders topic. */
  buildEvent() {
    return {
      schemaVersion: 1,
      eventType: 'OrderCreated',
      eventId: randomUUID(),
      correlationId: this.correlationId,
      occurredAt: new Date().toISOString(),
      ...structuredClone(this.fields),
    };
  }
}

export const anOrder = () => new OrderBuilder();
