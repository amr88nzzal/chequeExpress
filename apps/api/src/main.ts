import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
createApp().listen(config.port, () => {
  // never log the token or the database URL
  console.log(JSON.stringify({ msg: 'api listening', port: config.port }));
});
