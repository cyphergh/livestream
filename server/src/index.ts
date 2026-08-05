import { app } from './app';
import { config } from './config';

app.listen(config.PORT, () => {
  console.log(`🟢 Livestream API listening on ${app.server?.hostname}:${config.PORT}`);
  console.log(`   Health: ${config.API_URL}/health`);
});