import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import config from 'config';
import debug from 'debug';
import cosmos from './core/cosmos.js';
import issueApi from './routes/api/issue.js';

// create debug channels
const debugStartup = debug('app:startup');
const debugError = debug('app:error');

// create and configure app
const app = express();
app.use(helmet());
app.use(morgan('tiny'));
app.use(express.json());

// routes
app.get('/', (req, res) => res.json({ message: 'Server Running.' }));
app.get('/ping', (req, res) => res.json({ message: 'Ping.', now: new Date() }));
app.use('/api/issue', issueApi);

// error handlers
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found.' });
});
app.use((err, req, res, next) => {
  debugError(err);
  res.status(err.status || 500).json({ message: err.message });
});

// start app
const host = config.get('http.host');
const port = config.get('http.port');
app.listen(port, () => 
  debugStartup(`Server running at... http://${host}:${port}/`)
);
