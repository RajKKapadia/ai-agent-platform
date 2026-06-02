import {
  createConnectionEventIfNew,
  getAgentConnectionByVerificationTokenHash,
  getWhatsAppConnectionByPhoneNumberId,
  markAgentConnectionActive,
} from "@repo/db";
import {
  decryptSecret,
  enqueueWhatsAppInboundMessage,
  extractWhatsAppPhoneNumberIds,
  hashSecret,
  parseWhatsAppInboundMessages,
  verifyMetaSignature,
} from "@repo/agents";
import { Router, type Router as ExpressRouter } from "express";
import { HttpError } from "../errors";

interface RequestWithRawBody {
  rawBody?: Buffer;
}

export const whatsAppWebhookRouter: ExpressRouter = Router();

function queryString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function getRawBody(request: RequestWithRawBody): Buffer {
  if (!request.rawBody) {
    throw new HttpError(400, "Missing raw request body");
  }

  return request.rawBody;
}

whatsAppWebhookRouter.get("/", async (request, response, next) => {
  try {
    const mode = queryString(request.query["hub.mode"]);
    const verificationToken = queryString(request.query["hub.verify_token"]);
    const challenge = queryString(request.query["hub.challenge"]);

    if (mode !== "subscribe" || !verificationToken || !challenge) {
      throw new HttpError(400, "Invalid webhook verification request");
    }

    const connection = await getAgentConnectionByVerificationTokenHash(
      hashSecret(verificationToken),
    );

    if (!connection || connection.channel !== "whatsapp") {
      throw new HttpError(403, "Invalid verification token");
    }

    await markAgentConnectionActive(connection.id);

    return response.status(200).send(challenge);
  } catch (error) {
    next(error);
  }
});

whatsAppWebhookRouter.post("/", async (request, response, next) => {
  try {
    const rawBody = getRawBody(request as RequestWithRawBody);
    const phoneNumberIds = extractWhatsAppPhoneNumberIds(request.body);

    if (phoneNumberIds.length === 0) {
      return response.status(200).json({ ok: true, ignored: true });
    }

    const connections = await Promise.all(
      phoneNumberIds.map((phoneNumberId) =>
        getWhatsAppConnectionByPhoneNumberId(phoneNumberId),
      ),
    );
    const connectionsByPhoneNumberId = new Map<
      string,
      NonNullable<(typeof connections)[number]>
    >();

    for (const [index, connection] of connections.entries()) {
      const phoneNumberId = phoneNumberIds[index];

      if (!phoneNumberId) {
        throw new HttpError(400, "Missing phone number id");
      }

      if (!connection || connection.channel !== "whatsapp") {
        throw new HttpError(404, "WhatsApp connection not found");
      }

      const appSecret = decryptSecret({
        ciphertext: connection.appSecretCiphertext,
        iv: connection.appSecretIv,
        authTag: connection.appSecretAuthTag,
      });
      const isValidSignature = verifyMetaSignature({
        rawBody,
        appSecret,
        signatureHeader: request.header("x-hub-signature-256"),
      });

      if (!isValidSignature) {
        throw new HttpError(401, "Invalid webhook signature");
      }

      connectionsByPhoneNumberId.set(phoneNumberId, connection);
    }

    const messages = parseWhatsAppInboundMessages(request.body);

    await Promise.all(
      messages.map(async (message) => {
        const connection = connectionsByPhoneNumberId.get(
          message.phoneNumberId,
        );

        if (!connection || connection.channel !== "whatsapp") {
          throw new HttpError(404, "WhatsApp connection not found");
        }

        if (connection.status === "disabled") {
          return;
        }

        const { event, created } = await createConnectionEventIfNew({
          connectionId: connection.id,
          externalEventId: message.messageId,
          eventType: "whatsapp.message",
          payload: { ...message },
        });

        if (created || event.status === "queued") {
          await enqueueWhatsAppInboundMessage({
            connectionEventId: event.id,
          });
        }
      }),
    );

    return response.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});
