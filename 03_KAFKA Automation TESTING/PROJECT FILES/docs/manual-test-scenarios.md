# Test cases in Gherkin: Kafka producer and consumer (Node-RED)

Six test cases, three for the producer flow and three for the consumer flow, written in Gherkin
(Given / When / Then). The Gherkin below is the same text as the executable feature files:

| Feature file | Test cases |
|---|---|
| [`features/producer.feature`](../features/producer.feature) | KAFKA-P-01, KAFKA-P-02, KAFKA-P-03 |
| [`features/consumer.feature`](../features/consumer.feature) | KAFKA-C-01, KAFKA-C-02, KAFKA-C-03 |

| Tag | Meaning |
|---|---|
| `@automated` | Runs with `npm run test:bdd` (Cucumber + Chai step definitions). KAFKA-P-01 and KAFKA-C-01. |
| `@manual` | Executed by hand. Each step's shell command is listed under the scenario. |
| `@KAFKA-<P\|C>-NN` | Test case ID; run one automated case with `npx cucumber-js --tags @KAFKA-P-01`. |

Every expected result describes what the supplied flows actually do. Each test case was executed
against the Docker Compose stack, and the observed values are recorded under **Observed**.

## System under test

| Item | Value |
|---|---|
| Producer trigger | `POST http://localhost:1880/orders` (Node-RED tab "Order producer") |
| `"orders"` topic | `qa.orders.v1` (1 partition), record key = `orderId` |
| Consumer | Node-RED tab "Order consumer", group ID `nodered-order-processor` |
| `"processed"` topic | `OrderProcessed` records on `qa.orders.processed.v1`, key = `orderId` |
| `"dlq"` topic | `OrderRejected` records on `qa.orders.dlq.v1` |
| Event contract | [`order-created.v1.schema.json`](order-created.v1.schema.json) |
| Producer retry config | `PRODUCER_RETRIES=2`, initial backoff 300 ms, connection timeout 1 s, request timeout 3 s |
| Offset commits | after every handled record (`autoCommitThreshold: 1`), only once the result or DLQ write succeeded |

## Background (applies to every test case)

```gherkin
Background:
  Given the Kafka broker and Node-RED stack are running
  And a unique test run id
```

Manual execution: start the stack with `docker compose up -d --build --wait`, then load these
helpers in a bash shell from the repository root.

```bash
# Kafka CLI inside the broker container
KAFKA="docker compose exec -T kafka /opt/kafka/bin"

# Read a topic from the beginning (exits after 5 s without new records)
read_topic() { $KAFKA/kafka-console-consumer.sh --bootstrap-server kafka:19092 --topic "$1" \
  --from-beginning --timeout-ms 5000 --property print.key=true --property print.headers=true 2>/dev/null; }

# Current end offset of the input topic
end_offset() { $KAFKA/kafka-get-offsets.sh --bootstrap-server kafka:19092 --topic qa.orders.v1; }

# Committed offset and lag of the Node-RED consumer group
group_lag() { $KAFKA/kafka-consumer-groups.sh --bootstrap-server kafka:19092 --describe --group nodered-order-processor; }

# Publish key|value lines to the input topic
publish() { $KAFKA/kafka-console-producer.sh --bootstrap-server kafka:19092 --topic qa.orders.v1 \
  --property parse.key=true --property key.separator='|'; }
```

"A unique test run id" means a correlation ID that no earlier run used. The manual commands use
fixed IDs such as `manual-p01` for readability; if you repeat a test case against the same broker,
append a suffix (for example `-$(date +%s)`) so earlier results can't be confused with the current run.

---

# Feature: Node-RED order producer publishes OrderCreated events to Kafka

```gherkin
@producer
Feature: Node-RED order producer publishes OrderCreated events to Kafka
  As a client of the order service
  I want every valid order posted to the Node-RED producer to be published to Kafka
  So that downstream consumers receive it exactly once, and invalid orders never reach the topic
```

## KAFKA-P-01: Producer publishes a valid event (automated)

```gherkin
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
```

**Automated by:** `npm run test:bdd:producer` (also `npm run test:producer`, the Mocha version).

**Manual execution**

| Gherkin step | Command |
|---|---|
| a test subscriber is listening | `end_offset` (note it as `<N>`) |
| the order is posted | see below |
| exactly one record arrives / key / headers / envelope | `read_topic qa.orders.v1 \| grep manual-p01` |

```bash
curl -s -i -X POST localhost:1880/orders -H 'content-type: application/json' \
  -H 'x-correlation-id: manual-p01' \
  -d '{"orderId":"ORD-P01","customerId":"CUST-1001","currency":"USD","items":[{"sku":"SKU-RED-MUG","quantity":2,"unitPrice":12.5},{"sku":"SKU-BLUE-PEN","quantity":3,"unitPrice":1.25}]}'
```

Expected in detail: HTTP `202` `{"status":"PUBLISHED","topic":"qa.orders.v1","partition":0,"offset":"<N>","key":"ORD-P01","eventId":"<uuid>","correlationId":"manual-p01"}`;
exactly one record at offset `<N>` with key `ORD-P01`; the value has `schemaVersion: 1`,
`eventType: "OrderCreated"`, the same `eventId`, an ISO-8601 `occurredAt`, and the business fields as sent;
the end offset grew by exactly 1.

**Observed:** as expected. Automated run on 2026-11-14: 12/12 steps passed.

## KAFKA-P-02: Producer rejects an order with a missing or invalid field (manual)

```gherkin
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
```

**Manual execution**

| Gherkin step | Command |
|---|---|
| the end offset is noted | `end_offset` |
| the order is posted (first example row) | see below; for other rows remove or change the field named in the row |
| the end offset is unchanged | `end_offset` again, and `read_topic qa.orders.v1 \| grep -c manual-p02` gives `0` |
| the Node-RED log has a "REJECTED" warning | `docker compose logs node-red \| grep manual-p02` |

```bash
curl -s -i -X POST localhost:1880/orders -H 'content-type: application/json' \
  -H 'x-correlation-id: manual-p02' \
  -d '{"orderId":"ORD-P02","currency":"USD","items":[{"sku":"SKU-1","quantity":1,"unitPrice":5}]}'
```

Expected response for the first row: `{"status":"REJECTED","error":"VALIDATION_FAILED","details":["customerId is required"],"correlationId":"manual-p02"}`.

**Observed:** as expected (`400`, `details:["customerId is required"]`, end offset 31 before and after).
Re-executed on 2026-11-14 for all six example rows: each returned `400` with exactly the detail in its
`detail` column, and the end offset stayed at 19 before and after.
**Note:** a body that is not valid JSON is rejected by Node-RED's HTTP body parser with `400` and an
HTML error page, before the flow runs. That path is outside this test case.

## KAFKA-P-03: Producer handles an unavailable broker and recovers without a restart (manual)

```gherkin
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
```

**Manual execution**

| Gherkin step | Command |
|---|---|
| the Kafka broker is stopped | `docker compose stop kafka` |
| the order is posted (`manual-p03`) | see below |
| the Node-RED container is still running | `docker compose ps node-red` |
| the Kafka broker is started again | `docker compose start kafka`, then wait about 10 s |
| the order is posted (`manual-p03-recovered`) | the command below with the header changed to `manual-p03-recovered` |
| only `manual-p03-recovered` is on the topic | `read_topic qa.orders.v1 \| grep -E 'manual-p03'` |

```bash
curl -s -m 30 -w '\nHTTP %{http_code} in %{time_total}s\n' -X POST localhost:1880/orders \
  -H 'content-type: application/json' -H 'x-correlation-id: manual-p03' \
  -d '{"orderId":"ORD-P03","customerId":"CUST-3003","currency":"USD","items":[{"sku":"SKU-1","quantity":1,"unitPrice":5}]}'
```

Expected response while the broker is down: `{"status":"FAILED","error":"BROKER_UNAVAILABLE","message":"<kafkajs connection error>","retries":2,"elapsedMs":<n>,"correlationId":"manual-p03"}`.
The producer node shows a red "broker unavailable" status and the log has `{"result":"PUBLISH_FAILED",...}`.

**Observed:** `503` in 0.8–2.0 s (`elapsedMs` 834–1977, error `getaddrinfo ENOTFOUND kafka`), both on a
fresh producer and on one that was already connected. Node-RED kept running. After
`docker compose start kafka`, the next request returned `202`. Only the post-recovery correlation IDs
were on the topic.

---

# Feature: Node-RED order consumer turns OrderCreated events into downstream results

```gherkin
@consumer
Feature: Node-RED order consumer turns OrderCreated events into downstream results
  As the order-processing service
  I want every OrderCreated event on Kafka to be processed exactly once
  So that valid orders produce an OrderProcessed result and bad input never blocks the consumer
```

## KAFKA-C-01: Consumer processes a valid event and produces a downstream result (automated)

```gherkin
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
```

**Automated by:** `npm run test:bdd:consumer` (also `npm run test:consumer`, the Mocha version).

**Manual execution**

| Gherkin step | Command |
|---|---|
| the consumer group is stable | `group_lag` shows a CONSUMER-ID |
| the event is published | see below |
| exactly one record arrives on "processed" / result fields | `read_topic qa.orders.processed.v1 \| grep manual-c01` |
| (lag check) | `group_lag` shows `LAG 0` |

```bash
echo 'ORD-C01|{"schemaVersion":1,"eventType":"OrderCreated","eventId":"c01-evt-1","correlationId":"manual-c01","occurredAt":"2026-11-12T10:00:00Z","orderId":"ORD-C01","customerId":"CUST-2002","currency":"EUR","items":[{"sku":"SKU-LAPTOP-STAND","quantity":1,"unitPrice":49.9},{"sku":"SKU-USB-C-CABLE","quantity":3,"unitPrice":7.3}]}' | publish
```

Expected in detail: `sourceEventId:"c01-evt-1"`, `source = {topic:"qa.orders.v1", partition:0, offset:"<input offset>"}`,
nothing for `manual-c01` on the DLQ, and the consumer node status shows "processed ORD-C01 @<offset>".

**Observed:** as expected. Automated run on 2026-11-14: 12/12 steps passed.

## KAFKA-C-02: Consumer sends a malformed event to the DLQ and continues (manual)

```gherkin
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
```

**Manual execution**

| Gherkin step | Command |
|---|---|
| the malformed record, then the valid one, are published | first command below |
| OrderRejected arrives on "dlq" | `read_topic qa.orders.dlq.v1 \| grep ORD-C02-BAD` |
| OrderProcessed for `manual-c02` arrives | `read_topic qa.orders.processed.v1 \| grep manual-c02` |
| the consumer group lag is 0 | `group_lag` |
| (variant) the schema-breaking record is published | second command below, then `read_topic qa.orders.dlq.v1 \| grep ORD-C02-X` |

```bash
printf '%s\n' \
  'ORD-C02-BAD|{"orderId": "ORD-C02-BAD", this is not json' \
  'ORD-C02-OK|{"schemaVersion":1,"eventType":"OrderCreated","eventId":"c02-evt-1","correlationId":"manual-c02","occurredAt":"2026-11-12T10:00:00Z","orderId":"ORD-C02-OK","customerId":"CUST-4004","currency":"USD","items":[{"sku":"SKU-1","quantity":2,"unitPrice":10}]}' \
  | publish

echo 'ORD-C02-X|{"schemaVersion":1,"eventType":"OrderCreated","orderId":"ORD-C02-X"}' | publish
```

Expected in detail: the DLQ record has `correlationId:null` (none could be read) and `rawValue` equal
to the original text; the OrderProcessed result has `itemCount:2`, `totalAmount:20`; Node-RED logs a
`{"result":"REJECTED","reason":"INVALID_JSON",...}` warning and the consumer node status turns yellow.

**Observed:** as expected. The bad record at offset 26 went to the DLQ with `INVALID_JSON`, the valid
record at offset 27 was processed (`totalAmount 20`), and lag was 0. The schema variant produced
`SCHEMA_VALIDATION_FAILED` with the six errors in the table.

## KAFKA-C-03: Consumer restarts and resumes from its committed offset (manual)

```gherkin
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
```

**Manual execution**

| Gherkin step | Command |
|---|---|
| lag is 0 and C is noted | `group_lag` (CURRENT-OFFSET = C) |
| the Node-RED consumer is stopped | `docker compose stop node-red` |
| no active members, offset still C | `group_lag` prints `Consumer group 'nodered-order-processor' has no active members.` |
| 2 events are published | command below |
| lag is 2 | `group_lag`: CURRENT-OFFSET = C, LOG-END-OFFSET = C+2 |
| the consumer is started again | `docker compose up -d --wait node-red` |
| lag returns to 0, results exactly once | after about 5 s: `group_lag`, then the `read_topic` count below |

```bash
RUN=$(date +%s)
for id in A B; do
  echo "ORD-C03-$id|{\"schemaVersion\":1,\"eventType\":\"OrderCreated\",\"eventId\":\"c03-evt-$id-$RUN\",\"correlationId\":\"manual-c03-$id-$RUN\",\"occurredAt\":\"2026-11-12T10:00:00Z\",\"orderId\":\"ORD-C03-$id\",\"customerId\":\"CUST-5005\",\"currency\":\"USD\",\"items\":[{\"sku\":\"SKU-1\",\"quantity\":1,\"unitPrice\":3.5}]}"
done | publish

read_topic qa.orders.processed.v1 | grep -oE '"correlationId":"manual-c0[1-3][^"]*"' | sort | uniq -c
```

Expected in detail: each correlation ID, including earlier ones such as `manual-c01` and `manual-c02`,
appears exactly once. The consumer leaves the group cleanly on shutdown, so the restart does not wait
for the 10 s session timeout.

**Observed:** as expected, on two separate executions. In the first, committed 28 with log end 31 gave
lag 3 while stopped (two valid events plus the schema-variant record); after restart, committed 31 and
lag 0, with `manual-c02`, `manual-c03-a` and `manual-c03-b` each processed once. The second run, using
the commands above, went from committed 32 / lag 2 to committed 34 / lag 0, again with no reprocessing.
**Delivery guarantee:** at-least-once. A crash after the result is written but before the commit can
produce a duplicate result. A hard kill (`docker kill`) skips the graceful group leave, so the restart
waits up to the 10 s session timeout before it gets the partition.

---

## Execution summary

| ID | Test case | Type | Last executed | Result |
|---|---|---|---|---|
| KAFKA-P-01 | Producer publishes a valid event | `@automated` | 2026-11-14 (Cucumber + Mocha) | Pass |
| KAFKA-P-02 | Producer rejects a missing or invalid field | `@manual` | 2026-11-14 (all 6 rows) | Pass |
| KAFKA-P-03 | Producer handles an unavailable broker and recovers | `@manual` | 2026-11-12 | Pass |
| KAFKA-C-01 | Consumer processes a valid event | `@automated` | 2026-11-14 (Cucumber + Mocha) | Pass |
| KAFKA-C-02 | Malformed event to DLQ, consumer continues (+ schema variant) | `@manual` | 2026-11-12 | Pass |
| KAFKA-C-03 | Consumer restarts and resumes from its committed offset | `@manual` | 2026-11-12 | Pass |
