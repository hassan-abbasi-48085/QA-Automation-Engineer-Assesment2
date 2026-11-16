# End-to-end workflow

This page walks through one order from the HTTP request to the downstream result. It then shows how
each automated test drives that path and what it checks. The diagrams are Mermaid; GitHub, GitLab and
VS Code (with a Mermaid extension) render them.

## 1. Components

```mermaid
flowchart LR
    client["Client<br/>(curl / NodeRedOrdersClient)"]

    subgraph NR["Node-RED container :1880"]
        direction TB
        subgraph P["Tab: Order producer"]
            httpIn["http in<br/>POST /orders"] --> validate["Validate request<br/>& build event"]
            validate -- valid --> publish["Publish to Kafka<br/>(kafkajs, acks=all)"]
            validate -- "invalid → 400" --> resp["http response"]
            publish -- "202 / 503" --> resp
        end
        subgraph C["Tab: Order consumer"]
            inject["inject (once)<br/>start consumer"] --> consumer["Kafka consumer:<br/>process order"]
        end
    end

    subgraph K["Kafka broker (KRaft) :9092 / kafka:19092"]
        orders[("qa.orders.v1<br/>key = orderId")]
        processed[("qa.orders.processed.v1")]
        dlq[("qa.orders.dlq.v1")]
    end

    client -->|"JSON body<br/>X-Correlation-Id"| httpIn
    resp -->|HTTP status + JSON| client
    publish -->|OrderCreated| orders
    orders -->|"group: nodered-order-processor"| consumer
    consumer -->|"valid → OrderProcessed"| processed
    consumer -->|"malformed / invalid → OrderRejected"| dlq
```

The event rules (required fields, envelope, totals) live in one module,
`node-red/lib/order-event.js`, and both tabs use it.

## 2. Runtime path of one order

```mermaid
sequenceDiagram
    autonumber
    participant Cl as Client
    participant PF as Node-RED producer flow
    participant OT as qa.orders.v1
    participant CF as Node-RED consumer (group nodered-order-processor)
    participant PT as qa.orders.processed.v1
    participant DT as qa.orders.dlq.v1

    Cl->>PF: POST /orders {orderId, customerId, currency, items}<br/>X-Correlation-Id: abc
    PF->>PF: validateInput()
    alt required field missing / invalid
        PF-->>Cl: 400 VALIDATION_FAILED (nothing published)
    else valid
        PF->>PF: buildEvent() adds schemaVersion, eventType,<br/>eventId, correlationId, occurredAt
        PF->>OT: send key=orderId, headers correlation-id / event-type / schema-version
        alt broker reachable
            OT-->>PF: ack (partition, offset)
            PF-->>Cl: 202 PUBLISHED {topic, partition, offset, eventId}
        else broker down (after 2 retries, ~1–2 s)
            PF-->>Cl: 503 BROKER_UNAVAILABLE (nothing buffered)
        end
    end

    OT->>CF: eachMessage(record)
    CF->>CF: JSON.parse + validateEvent()
    alt valid
        CF->>PT: OrderProcessed {itemCount, totalAmount, source offset}
    else malformed JSON / schema violation
        CF->>DT: OrderRejected {reason, errors, rawValue}
    end
    CF->>OT: commit offset (only after the write above succeeded)
    Note over CF,OT: At-least-once. A restart with the same group ID<br/>resumes after the last committed offset.
```

In words:

1. **Request:** the client POSTs an order. The correlation ID comes from the `X-Correlation-Id`
   header, then `body.correlationId`; if neither is set, a new UUID is used.
2. **Validate:** a missing or invalid field returns `400` straight away, and nothing reaches Kafka.
3. **Publish:** the producer wraps the order in the OrderCreated v1 envelope and sends it with
   key = `orderId` and `acks=all`. A broker ack gives `202` with the partition and offset. If the
   broker is unreachable after the configured retries, the client gets `503`.
4. **Consume:** the long-lived consumer reads `qa.orders.v1` with group `nodered-order-processor`.
5. **Process:** a valid event becomes **OrderProcessed** (item count, total, link back to the source
   offset) on `qa.orders.processed.v1`. Bad input becomes **OrderRejected** on the dead-letter topic,
   and the consumer moves on to the next record.
6. **Commit:** the offset is committed only after step 5's write succeeds, so a crash never skips a record.

## 3. How the automated tests drive the flow

Each test covers one half of the path, with an independent Kafka client as the oracle. Each run gets
a unique `runId`, which is used as the correlation ID, inside the order ID, and in the test's own
consumer group name.

### KAFKA-P-01: producer test (`test/producer.int.test.js`)

```mermaid
sequenceDiagram
    autonumber
    participant T as Mocha test
    participant S as Test subscriber<br/>(group qa-test-producer-runId)
    participant NR as Node-RED producer
    participant OT as qa.orders.v1

    T->>S: startTestSubscriber()
    S->>OT: record end offsets, join group, seek to recorded offsets
    S-->>T: ready (bounded wait)
    T->>NR: NodeRedOrdersClient.createOrder(order, {correlationId: runId})
    NR->>OT: OrderCreated (key = orderId)
    NR-->>T: 202 {partition, offset, eventId}
    OT->>S: record
    S-->>T: waitFor(correlationId = runId) within 15 s
    T->>T: assert topic, key, partition/offset = ack,<br/>headers, full payload, exactly one record
    T->>S: close() disconnect + delete test group
```

### KAFKA-C-01: consumer test (`test/consumer.int.test.js`)

```mermaid
sequenceDiagram
    autonumber
    participant T as Mocha test
    participant A as Kafka admin
    participant S as Test subscriber<br/>(group qa-test-consumer-runId)
    participant Pub as KafkaTestPublisher
    participant OT as qa.orders.v1
    participant NR as Node-RED consumer
    participant PT as qa.orders.processed.v1

    T->>A: waitForGroupStable(nodered-order-processor)
    A-->>T: Stable, 1 member (bounded wait)
    T->>S: startTestSubscriber() on processed topic
    S-->>T: ready
    T->>Pub: publishOrderCreated(anOrder()...buildEvent())
    Pub->>OT: OrderCreated (key = orderId)
    OT->>NR: record
    NR->>PT: OrderProcessed
    PT->>S: record
    S-->>T: waitFor(correlationId = runId) within 15 s
    T->>T: assert key, headers, itemCount 4, totalAmount 71.8,<br/>source = published offset, exactly one result
    T->>Pub: close()
    T->>S: close()
```

The two tests are independent: either can run alone (`npm run test:producer`,
`npm run test:consumer`) or both together (`npm test`).

## 4. Full run, from start to shutdown

```mermaid
flowchart TD
    A["docker compose up -d --build --wait"] --> B["kafka starts (KRaft)<br/>healthcheck passes"]
    B --> C["kafka-init creates the 3 topics, exits 0"]
    C --> D["node-red starts: producer ready,<br/>consumer joins its group"]
    D --> E["npm ci"]
    E --> F["npm test<br/>KAFKA-P-01 + KAFKA-C-01"]
    F --> G{"2 passing?"}
    G -- yes --> H["optional: manual scenarios<br/>docs/manual-test-scenarios.md"]
    G -- no --> X["docker compose logs node-red / kafka<br/>failure message names what was missing"]
    H --> I["docker compose down -v<br/>(removes containers, network, broker data)"]
    X --> I
```

## 5. Where each scenario sits on the path

| Step on the path | Scenario | Automated |
|---|---|---|
| Request → publish (happy path) | KAFKA-P-01 | yes, `producer.int.test.js` |
| Request rejected before Kafka | KAFKA-P-02 | manual |
| Publish while broker down | KAFKA-P-03 | manual |
| Consume → OrderProcessed | KAFKA-C-01 | yes, `consumer.int.test.js` |
| Consume malformed → DLQ, then continue | KAFKA-C-02 | manual |
| Consumer restart → resume from committed offset | KAFKA-C-03 | manual |
