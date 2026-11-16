// Cucumber World: per-scenario state shared by the step definitions.
// A new World is created for every scenario, so scenarios never share state.
import { setWorldConstructor, World } from '@cucumber/cucumber';
import { config, newRunId } from '../../test/support/config.js';
import { createKafka } from '../../test/clients/kafka.js';

/** Topic aliases used in the feature files, so Gherkin never hard-codes topic names. */
const TOPICS = Object.freeze({
  orders: config.ordersTopic,
  processed: config.processedTopic,
});

export class KafkaOrdersWorld extends World {
  constructor(options) {
    super(options);
    this.runId = null;
    this.kafka = null;
    this.subscribers = {}; // topic alias -> test subscriber
    this.cleanups = [];

    // Scenario data, filled in by the steps
    this.orderId = null;
    this.orderRequest = null; // producer: body sent to POST /orders
    this.response = null; // producer: { status, body } from Node-RED
    this.event = null; // consumer: OrderCreated published straight to Kafka
    this.published = null; // consumer: { topic, partition, offset } of that record
    this.record = null; // the record the oracle subscriber matched
  }

  /** Creates the run-unique id (correlation id, order id, consumer group names) and a Kafka client. */
  startRun() {
    this.runId = newRunId('bdd');
    this.kafka = createKafka(`qa-bdd-${this.runId}`);
  }

  topic(alias) {
    const topic = TOPICS[alias];
    if (!topic) throw new Error(`Unknown topic alias "${alias}". Known aliases: ${Object.keys(TOPICS).join(', ')}`);
    return topic;
  }

  subscriberFor(alias) {
    const subscriber = this.subscribers[alias];
    if (!subscriber)
      throw new Error(
        `No test subscriber on "${alias}". Add: Given a test subscriber is listening on the "${alias}" topic`,
      );
    return subscriber;
  }

  /** Replaces {runId} placeholders in Gherkin table cells. */
  resolve(text) {
    return text.replaceAll('{runId}', this.runId);
  }

  /** Registers a cleanup action; actions run in reverse order after the scenario. */
  onCleanup(fn) {
    this.cleanups.push(fn);
  }

  async cleanup() {
    while (this.cleanups.length > 0) {
      const fn = this.cleanups.pop();
      await Promise.resolve()
        .then(fn)
        .catch(() => {}); // cleanup must never hide the real failure
    }
  }
}

setWorldConstructor(KafkaOrdersWorld);
