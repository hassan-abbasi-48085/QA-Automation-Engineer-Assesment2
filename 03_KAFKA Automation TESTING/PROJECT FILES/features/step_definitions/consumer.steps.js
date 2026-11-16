// Steps for features/consumer.feature (KAFKA-C-01).
// Trigger: an independent kafkajs publisher. Oracle: an independent subscriber on the processed topic.
import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from 'chai';
import { config } from '../../test/support/config.js';
import { KafkaTestPublisher } from '../../test/clients/kafka-test-publisher.js';
import { waitForGroupStable } from '../../test/clients/kafka-test-subscriber.js';
import { anOrder } from '../../test/fixtures/order.builder.js';
import { parseItems, parseValue } from '../support/tables.js';

Given('the Node-RED consumer group is stable with at least one member', async function () {
  const admin = this.kafka.admin();
  await admin.connect();
  this.onCleanup(() => admin.disconnect());
  await waitForGroupStable(admin, config.nodeRedConsumerGroup);
});

Given(
  'an OrderCreated event for customer {string} in {string} with the items:',
  function (customerId, currency, table) {
    this.event = anOrder()
      .withOrderId(`ORD-${this.runId}`)
      .withCorrelationId(this.runId)
      .withCustomerId(customerId)
      .withCurrency(currency)
      .withItems(...parseItems(table))
      .buildEvent();
    this.orderId = this.event.orderId;
  },
);

When('the event is published directly to the {string} topic', async function (alias) {
  const publisher = await new KafkaTestPublisher(this.kafka).connect();
  this.onCleanup(() => publisher.close());
  this.published = await publisher.publishOrderCreated(this.event, { topic: this.topic(alias) });
});

Then('the OrderProcessed result has:', function (table) {
  // Expected values are literals in the feature file, never recomputed with the code under test.
  const result = this.record.json;
  expect(result.eventType).to.equal('OrderProcessed');
  for (const { field, value } of table.hashes()) {
    expect(result[field], field).to.deep.equal(parseValue(value));
  }
});

Then('the result references the source event and the published record', function () {
  const result = this.record.json;
  expect(result).to.include({
    correlationId: this.runId,
    sourceEventId: this.event.eventId,
    orderId: this.event.orderId,
  });
  expect(result.source).to.deep.equal(this.published);
});

Then('the result has an ISO-8601 {string} timestamp', function (field) {
  const value = this.record.json[field];
  expect(value, field).to.be.a('string');
  expect(Number.isNaN(Date.parse(value)), `${field} is ISO-8601`).to.equal(false);
});
