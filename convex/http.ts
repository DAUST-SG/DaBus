import { httpRouter } from "convex/server";
import { handleWaveWebhook } from "./webhooks";

const http = httpRouter();

http.route({
  path: "/wave",
  method: "POST",
  handler: handleWaveWebhook,
});

export default http;
