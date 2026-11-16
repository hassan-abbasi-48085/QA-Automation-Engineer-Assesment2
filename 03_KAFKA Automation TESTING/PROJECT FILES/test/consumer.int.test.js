// Automates manual scenario KAFKA-C-01 (consumer processes a valid event).
// Trigger: an independent kafkajs test publisher puts OrderCreated on the orders topic.
// Oracle: the OrderProcessed result the Node-RED consumer emits to the processed topic,
//         read by an independent subscriber with its own run-unique consumer group.
import { expect } from 'chai';
import { config, newRunId } from './support/config.js';
import { createKafka } from './clients/kafka.js';
import { KafkaTestPublisher } from './clients/kafka-test-publisher.js';
import { startTestSubscriber, waitForGroupStable } from './clients/kafka-test-subscriber.js';
import { anOrder } from './fixtures/order.builder.js';

describe('Kafka -> Node-RED consumer -> downstream result [KAFKA-C-01]', function () {
  const runId = newRunId('it-consumer');
  const kafka = createKafka(`qa-test-client-${runId}`);
  const event = anOrder()
    .withOrderId(`ORD-${runId}`)
    .withCorrelationId(runId)
    .withCustomerId('CUST-2002')
    .withCurrency('EUR')
    .withItems(
      { sku: 'SKU-LAPTOP-STAND', quantity: 1, unitPrice: 49.9 },
      { sku: 'SKU-USB-C-CABLE', quantity: 3, unitPrice: 7.3 },
    )
    .buildEvent();
  // Expected values are stated explicitly, not recomputed with the code under test.
  const expectedTotal = 71.8; // 1 x 49.90 + 3 x 7.30
  const expectedItemCount = 4;

  let admin;
  let subscriber;
  let publisher;

  before(async function () {
    admin = kafka.admin();
    await admin.connect();
    // The system under test must be subscribed before we publish.
    await waitForGroupStable(admin, config.nodeRedConsumerGroup);

    // Our own subscriber on the output topic must be ready before we publish.
    subscriber = await startTestSubscriber({
      kafka,
      topic: config.processedTopic,
      groupId: `qa-test-consumer-${runId}`,
    });
    publisher = await new KafkaTestPublisher(kafka).connect();
  });

  after(async function () {
    if (publisher) await publisher.close();
    if (subscriber) await subscriber.close();
    if (admin) await admin.disconnect().catch(() => {});
  });

  it('emits an OrderProcessed result with the computed totals for a valid OrderCreated event', async function () {
    // Act
    const source = await publisher.publishOrderCreated(event);
    const record = await subscriber.waitFor(
      (m) => m.json?.correlationId === runId,
      config.waitMs,
      `OrderProcessed with correlationId ${runId}`,
    );

    // Assert: record metadata
    expect(record.topic).to.equal(config.processedTopic);
    expect(record.key).to.equal(event.orderId);
    expect(record.headers).to.include({ 'correlation-id': runId, 'event-type': 'OrderProcessed' });

    // Assert: downstream result
    const result = record.json;
    expect(result).to.include({
      schemaVersion: 1,
      eventType: 'OrderProcessed',
      status: 'PROCESSED',
      correlationId: runId,
      sourceEventId: event.eventId,
      orderId: event.orderId,
      customerId: 'CUST-2002',
      currency: 'EUR',
      itemCount: expectedItemCount,
      totalAmount: expectedTotal,
    });
    // Traceability back to the exact input record we published
    expect(result.source).to.deep.equal(source);
    expect(Number.isNaN(Date.parse(result.processedAt)), 'processedAt is ISO-8601').to.equal(false);

    // Exactly one result for this run
    expect(subscriber.received.filter((m) => m.json?.correlationId === runId)).to.have.lengthOf(1);
  });
});
