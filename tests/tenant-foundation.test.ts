import { describe, expect, it } from "vitest";
import { ApiError, authorize } from "../server/phase1";
const owner={actor:{id:"u1",externalSubject:"user"},membership:{userId:"u1",organizationId:"org-a",role:"owner" as const},scope:{organizationId:"org-a",mode:"demo" as const},requestId:"test"};
describe("tenant foundation",()=>{it("allows a scoped owner",()=>expect(()=>authorize(owner,"finance")).not.toThrow());it("rejects cross-organization access",()=>{try{authorize({...owner,scope:{...owner.scope,organizationId:"org-b"}},"read");}catch(error){expect(error).toBeInstanceOf(ApiError);expect((error as ApiError).code).toBe("FORBIDDEN");}});});
