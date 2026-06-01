import { appConfig } from "@repo/config";
import { createApp } from "./app.js";

const app = createApp();
const port = appConfig.server.port;

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
