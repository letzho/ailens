import app from './app.js';
import { config, features } from './config.js';

app.listen(config.port, () => {
  console.log(`AI Lens API on http://localhost:${config.port}`);
  console.log('Features:', features());
});
