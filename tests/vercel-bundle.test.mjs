import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

// Synthetic configuration only. Rejected requests must never reach persistence.
process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:1/test";
process.env.SALLA_WEBHOOK_SECURITY_STRATEGY = "signature";
process.env.SALLA_WEBHOOK_SECRET = "bundle-test-only-not-a-real-secret";
delete process.env.SALLA_SYNC_WORKER_SECRET;

test("native ESM deployment entry preserves health and fail-closed guards", async () => {
  const { default: app } = await import("../app.mjs");
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${base}/api/v1/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });
    for (const signature of [undefined, "invalid"]) {
      const headers = { "content-type": "application/json", "x-salla-security-strategy": "signature" };
      if (signature) headers["x-salla-signature"] = signature;
      const response = await fetch(`${base}/api/v1/webhooks/salla`, {
        method: "POST", headers, body: "{ invalid JSON: verify signature before parsing }",
      });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error, "UNAUTHORIZED");
    }
    const sync = await fetch(`${base}/api/v1/internal/salla-sync`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    assert.equal(sync.status, 401);
    assert.equal((await sync.json()).error, "UNAUTHORIZED");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
