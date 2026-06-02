import {
  conversationEventsChannel,
  createConversationEventsSubscriber,
  parseConversationUpdatedEvent,
} from "@/lib/conversation-events";
import { getAgentDetails } from "@/lib/api";
import { getCurrentUser, getSessionId } from "@/lib/session";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function encodeSseMessage(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const [user, sessionId] = await Promise.all([
    getCurrentUser(),
    getSessionId(),
  ]);

  if (!user || !sessionId) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await getAgentDetails(sessionId, agentId);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      error.statusCode === 404
    ) {
      return new Response("Agent not found", { status: 404 });
    }

    throw error;
  }

  const encoder = new TextEncoder();
  let cleanup: (() => Promise<void>) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const subscriber = createConversationEventsSubscriber();
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;

      const send = (event: string, data: unknown) => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(encodeSseMessage(event, data)));
      };
      const close = async () => {
        if (closed) {
          return;
        }

        closed = true;

        if (heartbeat) {
          clearInterval(heartbeat);
        }

        await subscriber
          .unsubscribe(conversationEventsChannel)
          .catch(() => undefined);
        await subscriber.quit().catch(() => undefined);

        try {
          controller.close();
        } catch {}
      };
      const handleAbort = () => {
        void close();
      };

      cleanup = close;
      request.signal.addEventListener("abort", handleAbort, { once: true });

      try {
        await subscriber.connect();
        await subscriber.subscribe(conversationEventsChannel, (message: string) => {
          try {
            const event = parseConversationUpdatedEvent(message);

            if (
              !event ||
              event.userId !== user.id ||
              event.agentId !== agentId
            ) {
              return;
            }

            send("conversation", event);
          } catch {}
        });

        send("ready", { agentId, at: new Date().toISOString() });
        heartbeat = setInterval(() => {
          send("heartbeat", { at: new Date().toISOString() });
        }, 25_000);
      } catch (error) {
        closed = true;

        if (heartbeat) {
          clearInterval(heartbeat);
        }

        await subscriber.quit().catch(() => undefined);
        controller.error(error);
      }
    },
    async cancel() {
      await cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    },
  });
}
