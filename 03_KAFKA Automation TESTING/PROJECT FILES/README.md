# Kafka QA assessment: Node-RED producer/consumer with Gherkin (Cucumber) and Mocha + Chai tests

A real single-node Kafka broker (KRaft, no ZooKeeper), a Node-RED producer flow and consumer flow,
six test scenarios written in Gherkin (`features/*.feature`), and the producer and consumer scenarios
automated twice: as Cucumber + Chai step definitions and as Mocha + Chai specs.

```
HTTP POST /orders ─► [Node-RED producer] ─► qa.orders.v1 ─► [Node-RED consumer] ─┬─► qa.orders.processed.v1  (OrderProcessed)
                                               (key=orderId)   group: nodered-order-processor └─► qa.orders.dlq.v1  (OrderRejected)
```

For the end-to-end workflow diagrams and the code structure guideline, see [docs/e2e-workflow-and-code-structure.md](docs/e2e-workflow-and-code-structure.md).

## Prerequisites

* Docker with the Compose v2 plugin (`docker compose version`)
* Node.js 18.18 or newer (for the test runner only)
* Free ports: `9092` (Kafka, host listener) and `1880` (Node-RED)

## Quick start

```bash
# 1. Start Kafka, create the topics and start Node-RED (builds the Node-RED image the first time)
docker compose up -d --build --wait

# 2. Install the test dependencies (cucumber, mocha, chai, kafkajs)
npm ci

# 3. Run all integration tests: Gherkin features, then Mocha specs (optional: npm run lint)
npm test
#    ...or pick one
npm run test:bdd              # Gherkin features (Cucumber + Chai), report in reports/cucumber-report.html
npm run test:bdd:producer     # Gherkin KAFKA-P-01
npm run test:bdd:consumer     # Gherkin KAFKA-C-01
npm run test:mocha            # Mocha + Chai specs for the same two scenarios
npm run test:producer         # Mocha KAFKA-P-01
npm run test:consumer         # Mocha KAFKA-C-01
npm run test:unit             # contract unit tests, no broker needed
npm run test:bdd:dry          # checks every automated Gherkin step has a definition, no broker needed

# 4. Shut down and remove containers, network and broker data
docker compose down -v
```

`docker compose up --wait` returns only when the broker is healthy, the `kafka-init` job has created the
topics, and Node-RED answers on `:1880`. The Node-RED editor is at <http://localhost:1880>.

Useful while testing:

```bash
docker compose ps
docker compose logs -f node-red          # debug nodes and warnings are echoed here
docker compose restart node-red          # consumer restart (KAFKA-C-03)
docker compose stop kafka / start kafka  # broker outage (KAFKA-P-03)
```

## What's in the repository

| Path | Purpose |
|---|---|
| `docker-compose.yml` | `kafka` (apache/kafka:3.9.1, KRaft), one-shot `kafka-init` (creates the topics; auto-create is off), `node-red` |
| `node-red/flows.json` | Importable flows: tab **Order producer** and tab **Order consumer** |
| `node-red/lib/order-event.js` | Event contract: validation, envelope, downstream result. Shared by both flows. |
| `node-red/settings.js` | Runtime config. Exposes `kafkajs` and `orderEvent` to function nodes via `functionGlobalContext`. |
| `node-red/Dockerfile`, `node-red/package.json` | Node-RED 4.0.9 image with `kafkajs@2.2.4` baked into the userDir |
| `docs/order-created.v1.schema.json` | The event schema (documentation form of `order-event.js`) |
| `docs/e2e-workflow-and-code-structure.md` | End-to-end workflow diagrams, CI run, and the code structure / naming / coding guideline |
| `ci/github-actions-e2e.yml` | CI pipeline (GitHub Actions): lint, Gherkin dry run, start the stack, run all tests, reports and logs |
| `features/*.feature` | All six scenarios in Gherkin. `@automated` ones run; `@manual` ones are executed by hand |
| `features/step_definitions/`, `features/support/` | Cucumber step definitions (Chai assertions), World, hooks, table helpers |
| `cucumber.js` | Cucumber config: feature paths, `not @manual` tag filter, HTML/JSON reports in `reports/` |
| `docs/manual-test-scenarios.md` | All six test cases in Gherkin (same text as the feature files), with manual commands per step and observed results |
| `test/producer.int.test.js` | Automated KAFKA-P-01 |
| `test/consumer.int.test.js` | Automated KAFKA-C-01 |
| `test/clients/` | Client objects (see "Test code structure" below) |
| `test/fixtures/order.builder.js` | Test data builder for orders and OrderCreated events |
| `test/unit/order-event.test.js` | 15 fast unit tests for the event contract (no broker) |
| `test/support/config.js` | Single test config (env-overridable), run IDs, bounded-wait helper |
| `eslint.config.js`, `.prettierrc.json`, `.editorconfig` | Lint and format rules (`npm run lint`) |

## Event schema (OrderCreated v1)

Record key = `orderId`. Headers: `correlation-id`, `event-type`, `schema-version`.

```json
{
  "schemaVersion": 1,
  "eventType": "OrderCreated",
  "eventId": "6f1c…",                     // set by producer
  "correlationId": "it-producer-1731…",   // X-Correlation-Id header or body.correlationId, else generated
  "occurredAt": "2026-11-12T22:22:33.000Z",
  "orderId": "ORD-1",                     // required
  "customerId": "CUST-1001",              // required
  "currency": "USD",                      // required, ^[A-Z]{3}$
  "items": [ { "sku": "SKU-1", "quantity": 2, "unitPrice": 9.99 } ]   // required, non-empty
}
```

The consumer turns a valid event into **OrderProcessed** on `qa.orders.processed.v1`:
`itemCount` = sum of quantities, `totalAmount` = sum of quantity × unitPrice (2 dp), `status: "PROCESSED"`,
`sourceEventId`, and `source {topic, partition, offset}`. Invalid JSON or a schema violation becomes
**OrderRejected** on `qa.orders.dlq.v1` (`reason: INVALID_JSON | SCHEMA_VALIDATION_FAILED`), and
processing continues. Full definition: `docs/order-created.v1.schema.json`.

## Flow behaviour (what the manual expected results are based on)

**Producer** (`POST /orders`)

| Case | HTTP | Kafka |
|---|---|---|
| Valid body | `202 {"status":"PUBLISHED", topic, partition, offset, key, eventId, correlationId}` | 1 record, `acks=all` |
| Missing or invalid required field | `400 {"status":"REJECTED","error":"VALIDATION_FAILED","details":[…]}` | nothing published |
| Broker unreachable | `503 {"status":"FAILED","error":"BROKER_UNAVAILABLE","retries":2,"elapsedMs":…}` after 2 retries (300 ms initial backoff, 1 s connect timeout). Observed: about 1 to 2 s. | nothing published, and nothing is buffered for later. The next request after the broker returns succeeds without restarting Node-RED. |

**Consumer**: group `nodered-order-processor`, `fromBeginning: true` for a brand-new group.
The offset is committed after every record, and only once the result or DLQ write has succeeded
(at-least-once). On shutdown or redeploy the consumer leaves the group cleanly, so a restart with the
same group ID resumes from the committed offset right away.

Retries and topic names come from environment variables in `docker-compose.yml`
(`PRODUCER_RETRIES`, `ORDERS_TOPIC`, `PROCESSED_TOPIC`, `DLQ_TOPIC`, `CONSUMER_GROUP_ID`, `KAFKA_BROKERS`).

### Design notes

* **Why function nodes with kafkajs, not a palette Kafka node:** the community Kafka nodes differ in
  their retry, commit and shutdown behaviour. A known client keeps the expected results in the
  manual scenarios exact and reviewable, and the setup needs only one dependency.
* **Why processing lives in the consumer function node:** the result or DLQ write is awaited inside
  `eachMessage`, so the offset is committed only after the downstream write succeeded. Splitting it
  across Node-RED wires would commit before the result exists. The node's two outputs still
  feed debug nodes, so the editor shows each processed and rejected record.
* **Startup and shutdown:** the consumer is started by a one-shot inject node, and the producer is
  created on its first request. Both register a `node.on('close', (removed, done) => …)` handler that
  disconnects. The function node's "On Stop" tab can't do this, because Node-RED doesn't wait for it.

### Importing the flows into another Node-RED instance

`flows.json` imports through *Menu → Import*. The function nodes need `kafkajs` and the contract
module in the global context, so on a non-Docker instance:

1. `cd ~/.node-red && npm install kafkajs@2.2.4`, then copy `node-red/lib/` into `~/.node-red/lib/`.
2. Add the `functionGlobalContext` block from `node-red/settings.js` to your `settings.js`.
3. Set `KAFKA_BROKERS` (for example `localhost:9092`) in the environment Node-RED starts with, then restart Node-RED.

## Gherkin test cases (BDD)

All six scenarios are written in Gherkin, one feature per side of the system:

| Feature file | Scenario | Tags |
|---|---|---|
| `features/producer.feature` | KAFKA-P-01 Producer publishes a valid event | `@automated @smoke` |
| | KAFKA-P-02 Producer rejects a missing/invalid field (Scenario Outline, 6 examples) | `@manual` |
| | KAFKA-P-03 Producer handles an unavailable broker and recovers | `@manual` |
| `features/consumer.feature` | KAFKA-C-01 Consumer processes a valid event | `@automated @smoke` |
| | KAFKA-C-02 Malformed event goes to the DLQ, consumer continues (+ schema variant) | `@manual` |
| | KAFKA-C-03 Consumer restarts and resumes from its committed offset | `@manual` |

Example (from `features/consumer.feature`):

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
  And the OrderProcessed result has:
    | field       | value     |
    | status      | PROCESSED |
    | itemCount   | 4         |
    | totalAmount | 71.8      |
```

* `cucumber.js` excludes `@manual`, so `npm run test:bdd` runs only the automated scenarios. Run a
  single one with `npx cucumber-js --tags @KAFKA-P-01`. Manual steps link to the shell commands in
  `docs/manual-test-scenarios.md`.
* The **Background** checks the broker, topics and Node-RED are reachable and fails with
  `... Start the stack with: docker compose up -d --build --wait` if not, then creates the run id.
* Step definitions use the same client objects, builder and config as the Mocha specs, so the two
  suites differ only in how the scenario is written.
* Topics are referred to by alias (`"orders"`, `"processed"`); `{runId}` in a table cell is replaced
  with the run's correlation id. Table cells that look like numbers are compared as numbers.
* A new Cucumber World per scenario holds the state; the `After` hook closes every client and deletes
  the test consumer groups, and on failure attaches the response and record to the report.
* Reports: `reports/cucumber-report.html` (open in a browser) and `reports/cucumber-report.json`.
* `@cucumber/messages` is pinned to 27.2.0 through `overrides` in `package.json` (shared by Cucumber and
  the pretty formatter). Newer versions are
  ESM-only and break Cucumber 11 on Node 18.

## Automated tests

| Test | Manual ID | Trigger | Independent oracle |
|---|---|---|---|
| `features/producer.feature` (`@KAFKA-P-01`) / `test/producer.int.test.js` | KAFKA-P-01 | HTTP POST to the Node-RED producer | kafkajs subscriber on `qa.orders.v1`, run-unique group |
| `features/consumer.feature` (`@KAFKA-C-01`) / `test/consumer.int.test.js` | KAFKA-C-01 | kafkajs test producer publishes OrderCreated to `qa.orders.v1` | kafkajs subscriber on `qa.orders.processed.v1`, run-unique group |

* **Unique per run:** each run makes a `runId` (`it-<kind>-<epoch>-<uuid8>`). It is the correlation ID,
  appears in the `orderId`, and names the test's own consumer group, so runs never share offsets and
  only records from this run are matched.
* **Ready before publishing:** the subscriber records the topic's end offsets first, waits (bounded)
  for its `GROUP_JOIN`, then seeks to those offsets. Anything published after that is guaranteed to be
  seen, whatever `auto.offset.reset` timing does. The consumer test also waits until the Node-RED group
  is `Stable` with at least one member before publishing.
* **Bounded waits:** every wait has a timeout (`TEST_WAIT_MS`, default 15 s; Mocha timeout 60 s) and fails
  with a message naming what was missing.
* **Cleanup:** `after` hooks disconnect the producer, consumer and admin clients, and delete the run's
  test consumer group. Mocha runs without `--exit`, so a client left open would keep the process alive.
* **Assertions:** topic, key, partition/offset (matched against the HTTP ack), headers, the full payload
  (exact key set, passthrough fields, UUID `eventId`, ISO timestamps), computed totals, traceability
  back to the source offset, and exactly one matching record per run.

### Test code structure

Page Object Model is a UI pattern. The equivalent for API and messaging tests is the **client
object**: tests say *what* they do, and the client hides *how* (HTTP, kafkajs, readiness, cleanup).

```
features/                          # Gherkin layer (Cucumber + Chai)
├─ producer.feature                # KAFKA-P-01..03 (P-01 @automated)
├─ consumer.feature                # KAFKA-C-01..03 (C-01 @automated)
├─ step_definitions/
│  ├─ common.steps.js              #   Background, test subscriber, record key/headers
│  ├─ producer.steps.js            #   order request, POST, ack and envelope checks
│  └─ consumer.steps.js            #   group stable, publish event, OrderProcessed checks
└─ support/
   ├─ world.js                     #   per-scenario state, topic aliases, cleanup registry
   ├─ hooks.js                     #   step timeout, failure attachment, cleanup
   └─ tables.js                    #   data table → typed values
test/
├─ producer.int.test.js            # KAFKA-P-01  (Arrange / Act / Assert)
├─ consumer.int.test.js            # KAFKA-C-01
├─ clients/                        # client objects, one per external interface
│  ├─ node-red-orders.client.js    #   NodeRedOrdersClient.createOrder(request, { correlationId })
│  ├─ kafka-test-publisher.js      #   KafkaTestPublisher.publishOrderCreated(event)
│  ├─ kafka-test-subscriber.js     #   startTestSubscriber() → waitFor() / close(); waitForGroupStable()
│  └─ kafka.js                     #   createKafka(): one place for client settings
├─ fixtures/
│  └─ order.builder.js             # anOrder().withItems(...).withCurrency('EUR').buildEvent()
└─ support/
   └─ config.js                    # config, newRunId(), withTimeout()
```

* **Test data builder:** every test starts from a valid default order and overrides only the fields
  that matter to it (`.without('customerId')` covers negative cases).
* **Independent oracle:** expected values such as `totalAmount: 71.8` are written out literally in
  the test. They are never recomputed with the code under test.
* **Lint and format:** `npm run lint` (ESLint recommended rules + Prettier check), `npm run format` to fix.

Environment overrides: `KAFKA_BROKERS` (default `localhost:9092`), `NODE_RED_URL` (default
`http://localhost:1880`), `TEST_WAIT_MS`.

## CI pipeline (GitHub Actions)

`ci/github-actions-e2e.yml` runs on every push to `main`, on every pull request, and on demand
(*Actions → kafka-e2e → Run workflow*). GitHub only picks it up from `.github/workflows/`, so copy it
there (for example as `.github/workflows/e2e.yml`) when you push. It runs the same commands as the Quick start:

```
checkout → setup Node 22 (npm cache) → npm ci → npm run lint → npm run test:unit → npm run test:bdd:dry
        → docker compose up -d --build --wait → npm test (Gherkin features + Mocha specs)
        → always: upload reports/ as the "cucumber-report" artifact
        → on failure: upload kafka / kafka-init / node-red logs as the "compose-logs" artifact
        → always: docker compose down -v
```

The job has a 20-minute timeout, read-only repository permissions, and cancels an older run on the
same branch when a new one starts. To use it, push this folder as the root of a GitHub repository.
The workflow needs no secrets.

There is no CD (deploy) stage. This project is a test harness, not a service, so there is nothing to
release. If a deploy target is added later, a deploy job would sit after `e2e` with `needs: e2e`.

## Verification log (2026-11-12, Linux, Docker 29.9, Compose v5.6, Node 22)

* `npm test` against the live stack: **2 passing** (about 10 s). It passed on every repeated run, both
  together and one file at a time.
* Rerun on 2026-11-13 after the refactor to client objects and builders: `npm test` 2 passing (twice),
  each file alone 1 passing, `npm run lint` clean.
* 2026-11-13 best-practice pass: unit tests added (15 passing), contract module de-duplicated,
  env config validated. Integration tests rerun afterwards: 2 passing. Lint clean.
* Negative checks: with Node-RED stopped, the consumer test fails in its `before` hook with
  `Consumer group nodered-order-processor not ready after 15000 ms (last state: Empty with 0 member(s))`,
  and the producer test fails with `fetch failed`. The tests don't pass vacuously.
* All six manual scenarios were executed against the stack. Observed values are recorded in
  `docs/manual-test-scenarios.md`.
* 2026-11-14 (Windows 11, Docker 27.4, Node 18.12) after adding the Gherkin layer: `npm test` →
  Cucumber **2 scenarios / 24 steps passed**, then Mocha **2 passing**; unit tests 15 passing; lint clean.
  With the stack down, the Background fails with `Kafka broker at localhost:9092 is not ready
  (Connection error: connect ECONNREFUSED ...). Start the stack with: ...`. Changing the expected
  `totalAmount` to 71.9 in the feature fails with `totalAmount: expected 71.8 to deeply equal 71.9`.

Known limitations: single partition and a single broker (by design, for a small reproducible setup).
At-least-once delivery, so a crash between the result write and the commit can duplicate a result.
A non-JSON HTTP body is rejected by Node-RED's body parser (`400`, HTML) before the flow runs.
