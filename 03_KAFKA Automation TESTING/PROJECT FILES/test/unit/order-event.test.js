// Fast unit tests for the shared event contract (no broker or Node-RED needed).
import { createRequire } from 'node:module';
import { expect } from 'chai';
import { anOrder } from '../fixtures/order.builder.js';

const require = createRequire(import.meta.url);
const orderEvent = require('../../node-red/lib/order-event.js');

describe('order-event contract (unit)', function () {
  describe('validateInput', function () {
    it('accepts a valid order request', function () {
      expect(orderEvent.validateInput(anOrder().buildRequest())).to.deep.equal([]);
    });

    for (const field of ['orderId', 'customerId', 'currency', 'items']) {
      it(`reports "${field} is required" when ${field} is missing`, function () {
        expect(orderEvent.validateInput(anOrder().without(field).buildRequest())).to.deep.equal([
          `${field} is required`,
        ]);
      });
    }

    it('rejects an empty items array', function () {
      expect(orderEvent.validateInput(anOrder().withItems().buildRequest())).to.deep.equal([
        'items must be a non-empty array',
      ]);
    });

    it('rejects a lowercase currency code', function () {
      expect(orderEvent.validateInput(anOrder().withCurrency('usd').buildRequest())).to.deep.equal([
        'currency must be a 3-letter ISO 4217 code',
      ]);
    });

    it('rejects non-integer quantity and negative price', function () {
      const request = anOrder().withItems({ sku: 'SKU-1', quantity: 1.5, unitPrice: -1 }).buildRequest();
      expect(orderEvent.validateInput(request)).to.deep.equal([
        'items[0].quantity must be an integer >= 1',
        'items[0].unitPrice must be a number >= 0',
      ]);
    });

    for (const body of [null, [], 'text', 42]) {
      it(`rejects a non-object body (${JSON.stringify(body)})`, function () {
        expect(orderEvent.validateInput(body)).to.deep.equal(['body must be a JSON object']);
      });
    }
  });

  describe('validateEvent', function () {
    it('accepts a complete OrderCreated event', function () {
      expect(orderEvent.validateEvent(anOrder().buildEvent())).to.deep.equal([]);
    });

    it('requires the envelope fields', function () {
      const event = { ...anOrder().buildEvent(), schemaVersion: 2, eventId: '', occurredAt: 'yesterday' };
      expect(orderEvent.validateEvent(event)).to.deep.equal([
        'schemaVersion must be 1',
        'eventId is required',
        'occurredAt must be an ISO-8601 timestamp',
      ]);
    });
  });

  describe('buildProcessedResult', function () {
    it('computes itemCount and totalAmount rounded to 2 decimals', function () {
      const event = anOrder()
        .withItems({ sku: 'A', quantity: 3, unitPrice: 0.1 }, { sku: 'B', quantity: 1, unitPrice: 19.99 })
        .buildEvent();
      const result = orderEvent.buildProcessedResult(event, { topic: 't', partition: 0, offset: '7' });
      expect(result).to.include({
        itemCount: 4,
        totalAmount: 20.29,
        status: 'PROCESSED',
        sourceEventId: event.eventId,
      });
      expect(result.source).to.deep.equal({ topic: 't', partition: 0, offset: '7' });
    });
  });
});
