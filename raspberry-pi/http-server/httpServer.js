const express = require('express');
const { Client } = require('pg');
const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');

const { time } = require('console');

const app = express();
const PORT = 3000;

const SHARED_SECRET = 'hello';

//verifyes the token from udpServer
function verifyToken(token, timestamp) {
  const MAX_AGE_MS = 10000; // 10 seconds
  
  const expectedToken = crypto
    .createHmac('sha256', SHARED_SECRET)
    .update(timestamp)
    .digest('hex');

  return token === expectedToken;
}

//db info
const db = new Client({
  user: 'postgres',          
  host: 'localhost',
  database: 'mydatabase',        
  password: '123',  
  port: 5432,
});

//connect to db
db.connect()
  .then(() => console.log('HTTP Server Connected to PostgreSQL'))
  .catch(err => console.error('HTTP Server DB connection error:', err.stack));

//create http server
const server = http.createServer(app);

//attach websocket to http server
const wss = new WebSocket.Server({ server });

// To track connected public clients
const publicClients = new Set(); 
let udpSocket = null;

//websocket functionality
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const timestamp = url.searchParams.get('ts');

  //looks to se if there is a token, code for udp connection
  const isInternal = token && timestamp && verifyToken(token, timestamp);

  if(isInternal){
    console.log('UDP server connected!')
    udpSocket = ws;

    ws.on('message', (msg) => {
      //console.log('Message from UDP:', msg.toString());
      console.log('Message from UDP');
      //send data to clients
      try{
        const data = JSON.parse(msg.toString());

        for(const client of publicClients) {
          
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }     
       }

      } catch (err){
        console.error('Invalid JSON from UDP:', err.message);
      }
    
    });

    ws.on('close', () => {
      console.log('UDP server disconnected');
      udpSocket = null;
    });

    return;
  }

  console.log('Public WebSocket client connected');
  publicClients.add(ws);

  ws.on('message', () => {
    console.log('Rejected message from public client');
  });

  ws.on('close', () => {
    console.log('Public client disconnected');
    publicClients.delete(ws);
  });

});


// Basic GET route
app.get('/', (req, res) => {
    res.send('Hello from the server!');
  });

app.get('/data', async (req, res) => {

//seends all data older than 10 minutes then deletes that data
    try {
        const result = await db.query(`
          SELECT * FROM smarteye_expanded
          WHERE received_at < NOW() - INTERVAL '1 minutes'
          ORDER BY received_at ASC
        `);

        await db.query(`
          DELETE FROM smarteye_expanded
          WHERE received_at < NOW() - INTERVAL '1 minutes'
        `);

        console.log(`Deleted ${result.rows.length} old rows`);

        res.json(result.rows);

      } catch (err) {

        console.error('DB query failed:', err);
        res.status(500).send('Internal Server Error');
      }

});

  // Start the HTTP server
server.listen(PORT, () => {
    console.log(`HTTP + websocket server is running at http://localhost:${PORT}`);
  });

