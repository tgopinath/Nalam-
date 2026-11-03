import { config } from './config.js';
import { db } from './db.js';
import { createApp } from './app.js';

await db.migrate.latest();
const app = createApp();
app.listen(config.port, () => {
  console.log(`Nalam API listening on ${config.apiPublicUrl} (${config.env}, payments: ${config.payments.mode}, sms: ${config.sms.provider})`);
});
