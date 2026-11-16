@producer
Feature: Node-RED order producer publishes OrderCreated events to Kafka
  As a client of the order service
  I want every valid order posted to the Node-RED producer to be published to Kafka
  So that downstream consumers receive it exactly once, and invalid orders never reach the topic

  The producer flow exposes POST /orders, validates the request, wraps it in the
  OrderCreated v1 envelope and publishes it to the "orders" topic (qa.orders.v1)
  with key = orderId and acks=all.

  Scenarios tagged @automated run with `npm run test:bdd`.
  Scenarios tagged @manual are executed by hand; the shell commands for each step
  are in docs/manual-test-scenarios.md.

  Background:
    Given the Kafka broker and Node-RED stack are running
    And a unique test run id

  @automated @KAFKA-P-01 @smoke
  Scenario: KAFKA-P-01 Producer publishes a valid event
    Given a test subscriber is listening on the "orders" topic
    And a valid order request for customer "CUST-1001" in "USD" with the items:
      | sku          | quantity | unitPrice |
      | SKU-RED-MUG  | 2        | 12.5      |
      | SKU-BLUE-PEN | 3        | 1.25      |
    When the order is posted to the producer with the run id as correlation id
    Then the producer responds with HTTP 202 and status "PUBLISHED"
    And exactly one record for the run arrives on the "orders" topic
    And the record key is the order id
    And the record partition and offset match the producer acknowledgement
    And the record has the headers:
      | header         | value        |
      | correlation-id | {runId}      |
      | event-type     | OrderCreated |
      | schema-version | 1            |
    And the record value is a valid "OrderCreated" envelope with the acknowledged event id
    And the business fields in the record equal the order request

  @manual @KAFKA-P-02
  Scenario Outline: KAFKA-P-02 Producer rejects an order with a missing or invalid field
    Given the end offset of the "orders" topic is noted
    And a valid order request where "<field>" is <change>
    When the order is posted to the producer with correlation id "manual-p02"
    Then the producer responds with HTTP 400 and status "REJECTED"
    And the error is "VALIDATION_FAILED" with the detail "<detail>"
    And the end offset of the "orders" topic is unchanged
    And the Node-RED log has a "REJECTED" warning for correlation id "manual-p02"

    Examples:
      | field      | change          | detail                                    |
      | customerId | missing         | customerId is required                    |
      | orderId    | missing         | orderId is required                       |
      | currency   | missing         | currency is required                      |
      | items      | missing         | items is required                         |
      | items      | an empty array  | items must be a non-empty array           |
      | currency   | lowercase "usd" | currency must be a 3-letter ISO 4217 code |

  @manual @KAFKA-P-03
  Scenario: KAFKA-P-03 Producer handles an unavailable broker and recovers without a restart
    Given the Kafka broker is stopped
    And a valid order request for customer "CUST-3003" in "USD"
    When the order is posted to the producer with correlation id "manual-p03"
    Then the producer responds with HTTP 503 and status "FAILED" within 5 seconds
    And the error is "BROKER_UNAVAILABLE" after 2 retries
    And the Node-RED container is still running
    When the Kafka broker is started again
    And the order is posted to the producer with correlation id "manual-p03-recovered"
    Then the producer responds with HTTP 202 and status "PUBLISHED"
    And only correlation id "manual-p03-recovered" is on the "orders" topic
    And the failed request was not buffered or replayed
