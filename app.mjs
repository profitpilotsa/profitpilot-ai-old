import express from "express";
import { createProfitPilotApi } from "./dist/vercel/api.mjs";

// Keep Express visible to Vercel's entrypoint detector. The build bundles only
// internal API modules; Node resolves external packages normally at runtime.
void express;

export default createProfitPilotApi();
