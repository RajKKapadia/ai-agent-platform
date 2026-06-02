import { appConfig } from "@repo/config";
import {
  Queue,
  Worker,
  type ConnectionOptions,
  type Processor,
} from "bullmq";

export const whatsAppInboundQueueName = "whatsapp-inbound-messages";

export interface WhatsAppInboundMessageJob {
  connectionEventId: string;
}

let sharedQueue: Queue<WhatsAppInboundMessageJob> | undefined;

export function createRedisConnectionOptions(): ConnectionOptions {
  const url = new URL(appConfig.redis.url);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname ? Number(url.pathname.slice(1)) || 0 : 0,
    maxRetriesPerRequest: null,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}

export function getWhatsAppInboundQueue(): Queue<WhatsAppInboundMessageJob> {
  if (!sharedQueue) {
    sharedQueue = new Queue<WhatsAppInboundMessageJob, void, string>(
      whatsAppInboundQueueName,
      {
        connection: createRedisConnectionOptions(),
      },
    );
  }

  return sharedQueue;
}

export async function enqueueWhatsAppInboundMessage(
  input: WhatsAppInboundMessageJob,
) {
  const queue = getWhatsAppInboundQueue();

  return queue.add("process", input, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    jobId: input.connectionEventId,
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

export function createWhatsAppInboundWorker(
  processor: Processor<WhatsAppInboundMessageJob>,
) {
  return new Worker<WhatsAppInboundMessageJob>(
    whatsAppInboundQueueName,
    processor,
    {
      concurrency: 5,
      connection: createRedisConnectionOptions(),
    },
  );
}
