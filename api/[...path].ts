import { createProfitPilotApi } from "../server/http/app";

// Vercel invokes the Express application as a serverless handler.  It must not
// listen on a port; local standalone hosting remains in server/index.ts.
export default createProfitPilotApi();
