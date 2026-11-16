@consumer
Feature: Node-RED order consumer turns OrderCreated events into downstream results
  As the order-processing service
  I want every OrderCreated event on Kafka to be processed exactly once
  So that valid orders produce an OrderProcessed result and bad input never blocks the consumer

  The consumer flow reads the "orders" topic (qa.orders.v1) in consumer group
  nodered-order-processor. A valid event becomes OrderProcessed on the "processed"
  topic (qa.orders.processed.v1). Invalid JSON or a schema violation becomes
  OrderRejected on the "dlq" topic (qa.orders.dlq.v1). The offset is committed only
  after that write succeeds (at-least-once).

  Scenarios tagged @automated run with `npm run test:bdd`.
  Scenarios tagged @manual are executed by hand; the shell commands for each step
  are in docs/manual-test-scenarios.md.

  Background:
    Given the Kafka broker and Node-RED stack are running
    And a unique test run id

  @automated @KAFKA-C-01 @smoke
  Scenario: KAFKA-C-01 Consumer processes a valid event and produces a downstream result
    Given the Node-RED consumer group is stable with at least one member
    And a test subscriber is listening on the "processed" topic
    And an OrderCreated event for customer "CUST-2002" in "EUR" with the items:
      | sku              | quantity | unitPrice |
      | SKU-LAPTOP-STAND | 1        | 49.9      |
      | SKU-USB-C-CABLE  | 3        | 7.3       |
    When the event is published directly to the "orders" topic
    Then exactly one record for the run arrives on the "processed" topic
    And the record key is the order id
    And the record has the headers:
      | header         | value          |
      | correlation-id | {runId}        |
      | event-type     | OrderProcessed |
    And the OrderProcessed result has:
      | field         | value     |
      | schemaVersion | 1         |
      | status        | PROCESSED |
      | customerId    | CUST-2002 |
      | currency      | EUR       |
      | itemCount     | 4         |
      | totalAmount   | 71.8      |
    And the result references the source event and the published record
    And the result has an ISO-8601 "processedAt" timestamp

  @manual @KAFKA-C-02
  Scenario: KAFKA-C-02 Consumer sends a malformed event to the DLQ and continues with the next valid event
    Given the Node-RED consumer group is stable with at least one member
    When a record with key "ORD-C02-BAD" and the value "{"orderId": "ORD-C02-BAD", this is not json" is published to the "orders" topic
    And a valid OrderCreated event with key "ORD-C02-OK" and correlation id "manual-c02" is published right after it
    Then one OrderRejected record with key "ORD-C02-BAD" arrives on the "dlq" topic
    And its reason is "INVALID_JSON" and its rawValue is the original text
    And its source offset is the offset of the malformed record
    And one OrderProcessed result for "manual-c02" arrives on the "processed" topic at source offset + 1
    And the consumer group lag is 0

  @manual @KAFKA-C-02
  Scenario: KAFKA-C-02 (variant) Consumer rejects valid JSON that breaks the schema
    Given the Node-RED consumer group is stable with at least one member
    When a record with key "ORD-C02-X" and the value "{"schemaVersion":1,"eventType":"OrderCreated","orderId":"ORD-C02-X"}" is published to the "orders" topic
    Then one OrderRejected record with key "ORD-C02-X" arrives on the "dlq" topic
    And its reason is "SCHEMA_VALIDATION_FAILED" with the errors:
      | error                                    |
      | customerId is required                   |
      | currency is required                     |
      | items is required                        |
      | eventId is required                      |
      | correlationId is required                |
      | occurredAt must be an ISO-8601 timestamp |
    And the consumer group lag is 0

  @manual @KAFKA-C-03
  Scenario: KAFKA-C-03 Consumer restarts and resumes from its committed offset with the same group id
    Given the consumer group lag is 0 and the committed offset is noted as C
    When the Node-RED consumer is stopped
    Then the consumer group has no active members and its committed offset is still C
    When 2 valid OrderCreated events are published to the "orders" topic
    Then the consumer group lag is 2
    When the Node-RED consumer is started again with the same group id
    Then the consumer group lag returns to 0 with a new consumer id
    And each of the 2 events produces exactly one OrderProcessed result, in order
    And no event before offset C is processed again
