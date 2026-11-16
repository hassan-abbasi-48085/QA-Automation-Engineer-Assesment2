// Client object for publishing test events straight to Kafka (bypasses Node-RED).
import { Partitioners } from 'kafkajs';
import { config } from '../support/config.js';

export class KafkaTestPublisher {
  constructor(kafka) {
    this.producer = kafka.producer({
      allowAutoTopicCreation: false,
      createPartitioner: Partitioners.DefaultPartitioner,
    });
  }

  async connect() {
    await this.producer.connect();
    return this;
  }

  /**
   * Publishes an OrderCreated event keyed by orderId, with the contract headers.
   * @returns {Promise<{ topic: string, partition: number, offset: string }>} where it landed
   */
  async publishOrderCreated(event, { topic = config.ordersTopic } = {}) {
    const [meta] = await this.producer.send({
      topic,
      acks: -1,
      messages: [
        {
          key: event.orderId,
          value: JSON.stringify(event),
          headers: {
            'correlation-id': event.correlationId,
            'event-type': event.eventType,
            'schema-version': String(event.schemaVersion),
          },
        },
      ],
    });
    return { topic, partition: meta.partition, offset: meta.baseOffset };
  }

  async close() {
    await this.producer.disconnect().catch(() => {});
  }
}
