// Automates manual scenario KAFKA-P-01 (producer publishes a valid event).
// Trigger: HTTP POST to the Node-RED producer flow (NodeRedOrdersClient).
// Oracle: an independent kafkajs subscriber with its own run-unique consumer group.
import { expect } from 'chai';
import { config, newRunId } from './support/config.js';
import { createKafka } from './clients/kafka.js';
import { NodeRedOrdersClient } from './clients/node-red-orders.client.js';
import { startTestSubscriber } from './clients/kafka-test-subscriber.js';
import { anOrder } from './fixtures/order.builder.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/; // crypto.randomUUID()

describe('Node-RED producer -> Kafka [KAFKA-P-01]', function () {
  const runId = newRunId('it-producer');
  const order = anOrder().withOrderId(`ORD-${runId}`).withCorrelationId(runId);
  const orderRequest = order.buildRequest();
  const orders = new NodeRedOrdersClient();
  let subscriber;

  before(async function () {
    // Subscriber is joined and positioned at the current end of the topic before we publish.
    subscriber = await startTestSubscriber({
      kafka: createKafka(`qa-test-subscriber-${runId}`),
      topic: config.ordersTopic,
      groupId: `qa-test-producer-${runId}`,
    });
  });

  after(async function () {
    if (subscriber) await subscriber.close();
  });

  it('publishes the OrderCreated event to the orders topic with key = orderId and the expected payload', async function () {
    // Act
    const { status, body: ack } = await orders.createOrder(orderRequest, { correlationId: runId });
    const record = await subscriber.waitFor(
      (m) => m.json?.correlationId === runId,
      config.waitMs,
      `OrderCreated with correlationId ${runId}`,
    );

    // Assert: HTTP acknowledgement
    expect(status, JSON.stringify(ack)).to.equal(202);
    expect(ack).to.include({
      status: 'PUBLISHED',
      topic: config.ordersTopic,
      key: orderRequest.orderId,
      correlationId: runId,
    });

    // Assert: topic, partition/offset and key
    expect(record.topic).to.equal(config.ordersTopic);
    expect(record.key).to.equal(orderRequest.orderId);
    expect(record.partition).to.equal(ack.partition);
    expect(record.offset).to.equal(ack.offset);

    // Assert: headers
    expect(record.headers).to.include({
      'correlation-id': runId,
      'event-type': 'OrderCreated',
      'schema-version': '1',
    });

    // Assert: envelope added by the producer + business fields passed through unchanged
    const event = record.json;
    expect(event).to.have.all.keys(
      'schemaVersion',
      'eventType',
      'eventId',
      'correlationId',
      'occurredAt',
      'orderId',
      'customerId',
      'currency',
      'items',
    );
    expect(event).to.include({
      schemaVersion: 1,
      eventType: 'OrderCreated',
      eventId: ack.eventId,
      correlationId: runId,
      orderId: orderRequest.orderId,
      customerId: orderRequest.customerId,
      currency: orderRequest.currency,
    });
    expect(event.eventId).to.match(UUID_V4);
    expect(Number.isNaN(Date.parse(event.occurredAt)), 'occurredAt is ISO-8601').to.equal(false);
    expect(event.items).to.deep.equal(orderRequest.items);

    // Assert: exactly one record for this run reached the topic
    expect(subscriber.received.filter((m) => m.json?.correlationId === runId)).to.have.lengthOf(1);
  });
});
