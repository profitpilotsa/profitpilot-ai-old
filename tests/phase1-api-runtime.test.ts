import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createProfitPilotApi } from "../server/http/app";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))));
});

async function requestHealth(path: "/health" | "/api/v1/health") {
  const server = createServer(createProfitPilotApi());
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP test listener");
  return fetch(`http://127.0.0.1:${address.port}${path}`);
}

describe("Phase 1 API runtime health", () => {
  it.each(["/health", "/api/v1/health"] as const)("returns a non-sensitive health response at %s", async (path) => {
    const response = await requestHealth(path);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
