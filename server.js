import express from 'express';
import helmet from 'helmet'
import config from 'config';
import debug from 'debug';

// create debug channels
const debugStartup = debug('app:startup');

// create and configure app
const app = express();
app.use(helmet());

// routes
app.get('/', (req, res) => res.json({ message: 'Server Running.' }));
app.get('/ping', (req, res) => res.json({ message: 'Ping.', now: new Date() }));

// start app
const host = config.get('http.host');
const port = config.get('http.port');
app.listen(port, () =>
  debugStartup(`Server running at... http://${host}:${port}/`)
);
