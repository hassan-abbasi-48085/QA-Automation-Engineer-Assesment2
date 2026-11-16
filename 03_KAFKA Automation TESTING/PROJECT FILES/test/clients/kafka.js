// Factory for test-side kafkajs clients. They talk to the broker directly on the host
// listener and are fully independent of Node-RED.
import { Kafka, logLevel } from 'kafkajs';
import { config } from '../support/config.js';

export function createKafka(clientId) {
  return new Kafka({
    clientId,
    brokers: config.brokers,
    connectionTimeout: 3000,
    requestTimeout: 10000,
    retry: { retries: 3 },
    logLevel: logLevel.WARN,
  });
}
