// Steps shared by the producer and consumer features.
import { Given, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { config, withTimeout } from '../../test/support/config.js';
import { createKafka } from '../../test/clients/kafka.js';
import { startTestSubscriber } from '../../test/clients/kafka-test-subscriber.js';

const START_HINT = 'Start the stack with: docker compose up -d --build --wait';

Given('the Kafka broker and Node-RED stack are running', async function () {
  const admin = createKafka('qa-bdd-precheck').admin();
  try {
    await withTimeout(admin.connect(), config.waitMs, `Kafka broker at ${config.brokers.join(',')}`);
    await admin.fetchTopicOffsets(config.ordersTopic); // throws if the topics were not created
  } catch (err) {
    const cause = err.cause?.message ?? err.message;
    throw new Error(`Kafka broker at ${config.brokers.join(',')} is not ready (${cause}). ${START_HINT}`);
  } finally {
    await admin.disconnect().catch(() => {});
  }

  let res;
  try {
    res = await fetch(config.nodeRedUrl, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    throw new Error(`Node-RED is not reachable at ${config.nodeRedUrl} (${err.message}). ${START_HINT}`);
  }
  expect(res.ok, `Node-RED at ${config.nodeRedUrl} answered HTTP ${res.status}`).to.equal(true);
});

Given('a unique test run id', function () {
  this.startRun();
});

Given('a test subscriber is listening on the {string} topic', async function (alias) {
  // Ready before anything is published: end offsets recorded, group joined, positioned.
  const subscriber = await startTestSubscriber({
    kafka: this.kafka,
    topic: this.topic(alias),
    groupId: `qa-test-bdd-${alias}-${this.runId}`,
  });
  this.subscribers[alias] = subscriber;
  this.onCleanup(() => subscriber.close());
});

Then('exactly one record for the run arrives on the {string} topic', async function (alias) {
  const subscriber = this.subscriberFor(alias);
  const isThisRun = (m) => m.json?.correlationId === this.runId;

  this.record = await subscriber.waitFor(isThisRun, config.waitMs, `a record with correlationId ${this.runId}`);

  expect(this.record.topic).to.equal(this.topic(alias));
  expect(subscriber.received.filter(isThisRun), 'records for this run').to.have.lengthOf(1);
});

Then('the record key is the order id', function () {
  expect(this.record.key).to.equal(this.orderId);
});

Then('the record has the headers:', function (table) {
  for (const { header, value } of table.hashes()) {
    expect(this.record.headers[header], `header "${header}"`).to.equal(this.resolve(value));
  }
});
