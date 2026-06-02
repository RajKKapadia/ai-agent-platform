import { createHmac, timingSafeEqual } from "node:crypto";

export interface WhatsAppInboundMessagePayload {
  channel: "whatsapp";
  messageId: string;
  phoneNumberId: string;
  from: string;
  text: string;
  timestamp?: string;
  contactName?: string;
  raw: Record<string, unknown>;
}

interface WhatsAppMessage {
  id?: unknown;
  from?: unknown;
  timestamp?: unknown;
  type?: unknown;
  text?: { body?: unknown };
}

interface WhatsAppChangeValue {
  metadata?: {
    phone_number_id?: unknown;
  };
  contacts?: Array<{
    wa_id?: unknown;
    profile?: {
      name?: unknown;
    };
  }>;
  messages?: WhatsAppMessage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function verifyMetaSignature(input: {
  rawBody: Buffer;
  appSecret: string;
  signatureHeader?: string;
}): boolean {
  const header = input.signatureHeader?.trim();

  if (!header?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", input.appSecret)
    .update(input.rawBody)
    .digest("hex");
  const actual = header.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function parseWhatsAppInboundMessages(
  payload: unknown,
): WhatsAppInboundMessagePayload[] {
  if (!isRecord(payload) || !Array.isArray(payload.entry)) {
    return [];
  }

  const events: WhatsAppInboundMessagePayload[] = [];

  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) {
      continue;
    }

    for (const change of entry.changes) {
      if (!isRecord(change) || !isRecord(change.value)) {
        continue;
      }

      const value = change.value as WhatsAppChangeValue;
      const phoneNumberId = toString(value.metadata?.phone_number_id);

      if (!phoneNumberId || !Array.isArray(value.messages)) {
        continue;
      }

      for (const message of value.messages) {
        const type = toString(message.type);
        const messageId = toString(message.id);
        const from = toString(message.from);
        const text = toString(message.text?.body);

        if (type !== "text" || !messageId || !from || !text) {
          continue;
        }

        const contact = value.contacts?.find((item) => item.wa_id === from);
        const contactName = toString(contact?.profile?.name);

        events.push({
          channel: "whatsapp",
          messageId,
          phoneNumberId,
          from,
          text,
          timestamp: toString(message.timestamp),
          contactName,
          raw: change.value,
        });
      }
    }
  }

  return events;
}

export function extractWhatsAppPhoneNumberIds(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.entry)) {
    return [];
  }

  const phoneNumberIds = new Set<string>();

  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) {
      continue;
    }

    for (const change of entry.changes) {
      if (!isRecord(change) || !isRecord(change.value)) {
        continue;
      }

      const value = change.value as WhatsAppChangeValue;
      const phoneNumberId = toString(value.metadata?.phone_number_id);

      if (phoneNumberId) {
        phoneNumberIds.add(phoneNumberId);
      }
    }
  }

  return Array.from(phoneNumberIds);
}

export function isWhatsAppInboundMessagePayload(
  value: unknown,
): value is WhatsAppInboundMessagePayload {
  return (
    isRecord(value) &&
    value.channel === "whatsapp" &&
    typeof value.messageId === "string" &&
    typeof value.phoneNumberId === "string" &&
    typeof value.from === "string" &&
    typeof value.text === "string"
  );
}

export async function sendWhatsAppTextMessage(input: {
  graphApiBaseUrl: string;
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}): Promise<void> {
  const response = await fetch(
    `${input.graphApiBaseUrl.replace(/\/$/, "")}/${input.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "text",
        text: {
          body: input.text,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 500);
    throw new Error(
      `Failed to send WhatsApp message: ${response.status} ${body}`,
    );
  }
}
