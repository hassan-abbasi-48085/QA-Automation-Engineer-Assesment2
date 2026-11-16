// Client object for an independent Kafka test subscriber (oracle side of the tests).
import { config, withTimeout } from '../support/config.js';

function decode(topic, partition, message) {
  const headers = {};
  for (const [k, v] of Object.entries(message.headers || {})) headers[k] = v == null ? null : v.toString();
  const value = message.value ? message.value.toString('utf8') : null;
  let json = null;
  try {
    json = value ? JSON.parse(value) : null;
  } catch {
    json = null;
  }
  return {
    topic,
    partition,
    offset: message.offset,
    key: message.key ? message.key.toString('utf8') : null,
    headers,
    value,
    json,
  };
}

/**
 * Independent test subscriber on `topic` using a dedicated, run-unique consumer group.
 *
 * Readiness: the current end offset of every partition is recorded BEFORE anything is
 * published; after the group join completes the consumer explicitly seeks to those
 * offsets. Anything published after start() resolves is therefore guaranteed to be
 * delivered, independent of auto.offset.reset timing.
 */
export async function startTestSubscriber({ kafka, topic, groupId, readyTimeoutMs = config.waitMs }) {
  const admin = kafka.admin();
  const consumer = kafka.consumer({ groupId, sessionTimeout: 10000, heartbeatInterval: 1000 });
  const received = [];
  const waiters = new Set();

  await admin.connect();
  const startOffsets = await admin.fetchTopicOffsets(topic); // throws if the topic does not exist

  const joined = new Promise((resolve) => {
    const off = consumer.on(consumer.events.GROUP_JOIN, (e) => {
      off();
      resolve(e);
    });
  });

  await consumer.connect();
  await consumer.subscribe({ topics: [topic], fromBeginning: false });
  await consumer.run({
    autoCommit: false, // test groups never need committed offsets
    eachMessage: async ({ topic: t, partition, message }) => {
      const m = decode(t, partition, message);
      received.push(m);
      for (const w of waiters) w(m);
    },
  });

  const join = await withTimeout(joined, readyTimeoutMs, `test subscriber ${groupId} to join its group`);
  for (const { partition, high } of startOffsets) {
    consumer.seek({ topic, partition, offset: high });
  }

  return {
    groupId,
    startOffsets,
    assignment: join.payload.memberAssignment,
    received,

    /** Resolves with the first message (already received or future) matching `predicate`. */
    waitFor(predicate, timeoutMs = config.waitMs, what = 'matching message') {
      const existing = received.find(predicate);
      if (existing) return Promise.resolve(existing);
      let listener;
      const found = new Promise((resolve) => {
        listener = (m) => {
          if (predicate(m)) resolve(m);
        };
        waiters.add(listener);
      });
      return withTimeout(
        found,
        timeoutMs,
        `${what} on ${topic} (received ${received.length} other message(s))`,
      ).finally(() => waiters.delete(listener));
    },

    /** Disconnects the consumer and removes its consumer group from the broker. */
    async close() {
      waiters.clear();
      await consumer.disconnect().catch(() => {});
      await admin.deleteGroups([groupId]).catch(() => {});
      await admin.disconnect().catch(() => {});
    },
  };
}

/** Polls the broker until `groupId` is Stable with at least one member (bounded). */
export async function waitForGroupStable(admin, groupId, timeoutMs = config.waitMs) {
  const deadline = Date.now() + timeoutMs;
  let last = 'unknown';
  while (Date.now() < deadline) {
    const { groups } = await admin.describeGroups([groupId]);
    const g = groups[0];
    last = `${g.state} with ${g.members.length} member(s)`;
    if (g.state === 'Stable' && g.members.length > 0) return g;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Consumer group ${groupId} not ready after ${timeoutMs} ms (last state: ${last})`);
}
