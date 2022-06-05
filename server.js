import express from 'express';
import config from 'config';
import debug from 'debug';

// create debug channel
const debugStartup = debug('app:startup');

// create and configure app
const app = express();

// routes
app.get('/', (req, res) => res.json({ message: 'Server Running.' }));
app.get('/ping', (req, res) => res.json({ message: 'Ping.', now: new Date() }));

// start app
const host = config.get('http.host');
const port = config.get('http.port');
app.listen(port, () =>
  debugStartup(`Server running at... http://${host}:${port}/`)
);
