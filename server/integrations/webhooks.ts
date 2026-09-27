import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "../phase1";

export interface WebhookReceipt { provider: string; organizationId: string; storeId: string; externalEventId: string; payloadHash: string; }
export interface WebhookEventStore { reserve(receipt: WebhookReceipt): Promise<"reserved" | "duplicate">; markProcessed(receipt: WebhookReceipt): Promise<void>; markFailed(receipt: WebhookReceipt): Promise<void>; }
export function verifyHmacSignature(rawBody: Buffer, signature: string | undefined, secret: string | undefined): void {
  if (!secret) throw new ApiError("SERVICE_UNAVAILABLE", "Webhook verification is not configured", true);
  if (!signature) throw new ApiError("UNAUTHORIZED", "Webhook signature is required");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signature.replace(/^sha256=/i, ""), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer)) throw new ApiError("UNAUTHORIZED", "Webhook signature is invalid");
}
export async function processExactlyOnce(store: WebhookEventStore, receipt: WebhookReceipt, work: () => Promise<void>): Promise<"processed" | "duplicate"> {
  if (await store.reserve(receipt) === "duplicate") return "duplicate";
  try { await work(); await store.markProcessed(receipt); return "processed"; } catch (error) { await store.markFailed(receipt); throw error; }
}
