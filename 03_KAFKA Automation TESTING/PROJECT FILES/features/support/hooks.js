// Cucumber hooks: step timeout, failure diagnostics and cleanup.
import { After, Status, setDefaultTimeout } from '@cucumber/cucumber';

// Per-step limit. Individual waits inside a step are bounded by config.waitMs (15 s by default).
setDefaultTimeout(60_000);

After(async function ({ result }) {
  if (result?.status === Status.FAILED) {
    // Attached to the HTML/JSON report, so a failure shows what the system actually returned.
    const context = { runId: this.runId, response: this.response, published: this.published, record: this.record };
    this.attach(JSON.stringify(context, null, 2), 'application/json');
  }
  await this.cleanup();
});
