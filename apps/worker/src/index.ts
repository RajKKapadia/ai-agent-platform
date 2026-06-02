import {
  createWhatsAppInboundWorker,
  processWhatsAppInboundMessage,
} from "@repo/agents";

const worker = createWhatsAppInboundWorker(async (job) => {
  await processWhatsAppInboundMessage(job.data);
});

worker.on("completed", (job) => {
  console.log(`Completed WhatsApp inbound job ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Failed WhatsApp inbound job ${job?.id ?? "unknown"}`, error);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}, closing worker`);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

console.log("WhatsApp inbound worker started");
