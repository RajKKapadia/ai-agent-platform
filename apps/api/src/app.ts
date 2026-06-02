import { appConfig } from "@repo/config";
import cors, { type CorsOptions } from "cors";
import express, { type Express } from "express";
import { errorHandler } from "./errors";
import { agentsRouter } from "./routes/agents";
import { authRouter } from "./routes/auth";
import { whatsAppWebhookRouter } from "./routes/whatsapp-webhook";

function getCorsOptions(): CorsOptions {
  const origin = appConfig.api.corsOrigin;

  if (origin === "*") {
    return { origin: true, credentials: true };
  }

  const allowedOrigins = origin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  };
}

export function createApp(): Express {
  const app = express();

  app.use(cors(getCorsOptions()));
  app.use(
    express.json({
      limit: "1mb",
      verify: (request, _response, buffer) => {
        (
          request as typeof request & {
            rawBody?: Buffer;
          }
        ).rawBody = Buffer.from(buffer);
      },
    }),
  );

  app.get("/health", (_request, response) => {
    response.status(200).json({ ok: true });
  });

  app.use("/auth", authRouter);
  app.use("/agents", agentsRouter);
  app.use("/webhooks/meta/whatsapp", whatsAppWebhookRouter);
  app.use(errorHandler);

  return app;
}
