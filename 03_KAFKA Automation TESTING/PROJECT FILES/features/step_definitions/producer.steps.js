// Steps for features/producer.feature (KAFKA-P-01).
// Trigger: HTTP POST to the Node-RED producer. Oracle: an independent kafkajs subscriber.
import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from 'chai';
import { NodeRedOrdersClient } from '../../test/clients/node-red-orders.client.js';
import { anOrder } from '../../test/fixtures/order.builder.js';
import { parseItems } from '../support/tables.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ENVELOPE_KEYS = [
  'schemaVersion',
  'eventType',
  'eventId',
  'correlationId',
  'occurredAt',
  'orderId',
  'customerId',
  'currency',
  'items',
];

Given(
  'a valid order request for customer {string} in {string} with the items:',
  function (customerId, currency, table) {
    this.orderRequest = anOrder()
      .withOrderId(`ORD-${this.runId}`)
      .withCorrelationId(this.runId)
      .withCustomerId(customerId)
      .withCurrency(currency)
      .withItems(...parseItems(table))
      .buildRequest();
    this.orderId = this.orderRequest.orderId;
  },
);

When('the order is posted to the producer with the run id as correlation id', async function () {
  this.response = await new NodeRedOrdersClient().createOrder(this.orderRequest, { correlationId: this.runId });
});

Then('the producer responds with HTTP {int} and status {string}', function (httpStatus, status) {
  const { status: actualStatus, body } = this.response;
  expect(actualStatus, JSON.stringify(body)).to.equal(httpStatus);
  expect(body.status).to.equal(status);
});

Then('the record partition and offset match the producer acknowledgement', function () {
  expect(this.response.body).to.include({
    topic: this.record.topic,
    partition: this.record.partition,
    offset: this.record.offset,
    key: this.orderId,
    correlationId: this.runId,
  });
});

Then('the record value is a valid {string} envelope with the acknowledged event id', function (eventType) {
  const event = this.record.json;
  expect(event).to.have.all.keys(...ENVELOPE_KEYS);
  expect(event).to.include({
    schemaVersion: 1,
    eventType,
    eventId: this.response.body.eventId,
    correlationId: this.runId,
  });
  expect(event.eventId).to.match(UUID_V4);
  expect(Number.isNaN(Date.parse(event.occurredAt)), 'occurredAt is ISO-8601').to.equal(false);
});

Then('the business fields in the record equal the order request', function () {
  const { orderId, customerId, currency, items } = this.record.json;
  expect({ orderId, customerId, currency, items }).to.deep.equal(this.orderRequest);
});
