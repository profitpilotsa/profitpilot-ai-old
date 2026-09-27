import type { IncomingMessage, ServerResponse } from "node:http";
import { createProfitPilotApi } from "../server/http/app";

const app = createProfitPilotApi();

export default function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  return app(request, response);
}
