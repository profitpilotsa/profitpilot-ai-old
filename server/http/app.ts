import { randomUUID, timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { createDatabase } from "../db/client";
import { CommerceQueryService } from "../application/commerceQueryService";
import { SupabaseAuthVerifier } from "../foundation/auth";
import { RequestContextResolver } from "../foundation/context";
import { PostgresIntegrationRepository } from "../foundation/postgresIntegrationRepository";
import { PostgresTenantRepository } from "../foundation/postgresTenantRepository";
import { consoleLogger } from "../foundation/observability";
import { PostgresCommerceRepository } from "../repositories/postgresCommerce";
import { SallaWebhookReceiver } from "../application/sallaWebhookReceiver";
import { SallaSyncWorker } from "../application/sallaSyncWorker";
import { ApiError, type Mode } from "../phase1";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
function rateLimit(request: Request, response: Response, next: NextFunction) {
  const key = request.ip || "unknown"; const now = Date.now(); const prior = buckets.get(key);
  const bucket = !prior || prior.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : prior;
  bucket.count += 1; buckets.set(key, bucket);
  if (bucket.count > 120) return response.status(429).json({ error: "RATE_LIMITED" });
  next();
}
function bearer(request: Request): string { const value = request.header("authorization"); if (!value?.startsWith("Bearer ")) throw new ApiError("UNAUTHORIZED", "A bearer token is required"); return value.slice(7); }
function header(request: Request, name: string): string { const value = request.header(name); if (!value) throw new ApiError("VALIDATION_ERROR", `${name} is required`); return value; }
function internalWorkerAuthorized(request: Request): boolean { const secret = process.env.SALLA_SYNC_WORKER_SECRET; const received = request.header("authorization"); if (!secret || !received) return false; const expected = Buffer.from(`Bearer ${secret}`); const supplied = Buffer.from(received); return expected.length === supplied.length && timingSafeEqual(expected, supplied); }

/** Creates API routes only; static hosting remains in server/index.ts. */
export function createProfitPilotApi() {
  const app = express();
  app.disable("x-powered-by");
  // This route deliberately runs before express.json(): Salla's signature covers
  // the exact raw bytes and must be verified before parsing or queuing anything.
  app.post("/api/v1/webhooks/salla", express.raw({ type: "*/*", limit: "128kb" }), rateLimit, async (request, response, next) => {
    try {
      if (!Buffer.isBuffer(request.body)) throw new ApiError("VALIDATION_ERROR", "Salla webhook body is required");
      const receiver = new SallaWebhookReceiver(new PostgresIntegrationRepository(createDatabase()), {
        webhookSecret: process.env.SALLA_WEBHOOK_SECRET,
        securityStrategy: process.env.SALLA_WEBHOOK_SECURITY_STRATEGY,
        credentialEncryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY,
      });
      const receipt = await receiver.receive(request.body, {
        signature: request.header("x-salla-signature") ?? undefined,
        securityStrategy: request.header("x-salla-security-strategy") ?? undefined,
      });
      response.status(202).json(receipt);
    } catch (error) { next(error); }
  });
  app.use(express.json({ limit: "128kb" }));
  app.use(rateLimit);
  // Keep the standalone-server probe while also exposing it beneath Vercel's
  // file-based `/api` function namespace.
  app.get(["/health", "/api/v1/health"], (_request, response) => response.json({ status: "ok" }));
  app.post("/api/v1/internal/salla-sync", async (request, response, next) => {
    try {
      if (!internalWorkerAuthorized(request)) throw new ApiError("UNAUTHORIZED", "A worker authorization is required");
      const db = createDatabase();
      const result = await new SallaSyncWorker(new PostgresIntegrationRepository(db), new PostgresCommerceRepository(db), process.env.CREDENTIAL_ENCRYPTION_KEY).runOne();
      response.json({ result });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/commerce/products", async (request, response, next) => {
    const requestId = request.header("x-request-id") || randomUUID();
    try {
      const db = createDatabase();
      const tenantRepository = new PostgresTenantRepository(db);
      const auth = new SupabaseAuthVerifier();
      const subject = await auth.verifyBearer(bearer(request));
      const user = await tenantRepository.findUserBySubject(subject.subject);
      if (!user) throw new ApiError("FORBIDDEN", "No ProfitPilot workspace membership exists for this identity");
      const context = await new RequestContextResolver(auth, tenantRepository).resolve({ bearerToken: bearer(request), user, organizationId: header(request, "x-profitpilot-organization"), storeId: header(request, "x-profitpilot-store"), mode: header(request, "x-profitpilot-mode") as Mode, requestId });
      const platform = header(request, "x-profitpilot-platform");
      const data = await new CommerceQueryService(new PostgresCommerceRepository(db)).listProducts(context, platform);
      response.setHeader("x-request-id", requestId).json({ data, requestId });
    } catch (error) { next(error); }
  });
  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const requestId = request.header("x-request-id") || randomUUID();
    const known = error instanceof ApiError ? error : new ApiError("INTERNAL_ERROR", "The server could not complete the request");
    consoleLogger.error("api.request.failed", { requestId, code: known.code, method: request.method, path: request.path });
    response.status(known.code === "UNAUTHORIZED" ? 401 : known.code === "FORBIDDEN" ? 403 : known.code === "VALIDATION_ERROR" ? 400 : 503).setHeader("x-request-id", requestId).json({ error: known.code, requestId });
  });
  return app;
}
