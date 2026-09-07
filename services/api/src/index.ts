import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { migrate } from "./db.js";
import { seedCatalog, seedTenantDemo } from "./seed.js";

migrate();
seedCatalog();
seedTenantDemo();

const app = createApp();
const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Ticker CMS API http://localhost:${port}`);
});
