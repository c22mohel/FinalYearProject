const express   = require('express');
const { createClient } = require('redis');
const WebSocket = require('ws');
const http      = require('http');
const crypto    = require('crypto');
const fs   = require('fs');
const path = require('path');

const hrtime = () => process.hrtime.bigint();

// two separate log files
const GET_TIMINGS_FILE    = path.join(__dirname, 'get_times.log');
const DELETE_TIMINGS_FILE = path.join(__dirname, 'delete_times.log');

const app  = express();
const PORT = 3000;

const SHARED_SECRET = 'hello';

// Set how long data is retained (in minutes)
const DATA_RETENTION_MINUTES = 1;

// Redis client setup 
const rclient = createClient({
  socket: { host: 'localhost', port: 6379 },
});
rclient.on('error', err => console.error('Redis Client Error', err));
(async () => {
  await rclient.connect();
  console.log('HTTP Server Connected to Redis');
})();

// ——— Auth helper ———
function verifyToken(token, timestamp) {
  const MAX_AGE_MS = 10_000; // 10 seconds
  const expected = crypto
    .createHmac('sha256', SHARED_SECRET)
    .update(timestamp)
    .digest('hex');
  // Optionally you could also check `Date.now() - Number(timestamp) <= MAX_AGE_MS`
  return token === expected;
}

// HTTP + WebSocket server setup 
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

let udpSocket = null;
const publicClients = new Set();

wss.on('connection', (ws, req) => {
  const url      = new URL(req.url, `http://${req.headers.host}`);
  const token    = url.searchParams.get('token');
  const timestamp= url.searchParams.get('ts');
  const isInternal = token && timestamp && verifyToken(token, timestamp);

  if (isInternal) {
    console.log('UDP server connected');
    udpSocket = ws;

    ws.on('message', msg => {
      // Broadcast raw UDP JSON to all public WS clients
      let data;
      try { data = JSON.parse(msg); }
      catch { return console.error('Invalid JSON from UDP'); }

      publicClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    });

    ws.on('close', () => {
      console.log('UDP server disconnected');
      udpSocket = null;
    });
    return;
  }

  // Otherwise it’s a public client
  console.log('Public WebSocket client connected');
  publicClients.add(ws);
  ws.on('close', () => publicClients.delete(ws));
});

// Basic GET route
app.get('/', (req, res) => res.send('Hello from the server!'));

//  GET /data: fetch & delete old records from Redis 
app.get('/data', async (req, res) => {
  try {
    const cutoff = Date.now() - DATA_RETENTION_MINUTES * 60 * 1000;


    //  first time GET
    const t0 = hrtime();

    // 1) Get all IDs with score <= cutoff
    const ids = await rclient.zRangeByScore('smarteye:by_time', 0, cutoff);
    if (ids.length === 0) {
      return res.json([]);
    }

    // 2) Fetch all records 
    const fetchPipe = rclient.multi();
    ids.forEach(id => fetchPipe.get(`smarteye:${id}`));
    const blobResults = await fetchPipe.exec(); 
    const records = blobResults.map(blob => JSON.parse(blob));

    //  second time get
    const t1 = hrtime();
    // log into file Get
    fs.appendFileSync(GET_TIMINGS_FILE, (t1 - t0).toString() + '\n');

    //first time delete
    const t2 = hrtime();

    // 3) Delete each hash + remove from sorted set
    const delPipe = rclient.multi();
    ids.forEach(id => {
      delPipe.del(`smarteye:${id}`);
      delPipe.zRem('smarteye:by_time', id);
    });
    await delPipe.exec();

    // second time delete
    const t3 = hrtime();
    // log to file delete
    fs.appendFileSync(DELETE_TIMINGS_FILE, (t3 - t2).toString() + '\n');

    console.log(`Served & deleted ${ids.length} records`);
    res.json(records);

  } catch (err) {
    console.error('Redis GET/DELETE error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`HTTP + WebSocket server running at http://localhost:${PORT}`);
});
