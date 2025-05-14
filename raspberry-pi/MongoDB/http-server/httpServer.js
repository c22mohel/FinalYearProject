const express = require('express');
const { MongoClient } = require('mongodb');
const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

//used for logging
const hrtime = () => process.hrtime.bigint();

// two separate log files
const GET_TIMINGS_FILE    = path.join(__dirname, 'get_times.log');
const DELETE_TIMINGS_FILE = path.join(__dirname, 'delete_times.log');

const app = express();
const PORT = 3000;
const SHARED_SECRET = 'hello';

// Set how long data is retained (in minutes)
const DATA_RETENTION_MINUTES = 1;

let collection;

//verifyes the token from udpServer
function verifyToken(token, timestamp) {
  const MAX_AGE_MS = 10000; // 10 seconds
  
  const expectedToken = crypto
    .createHmac('sha256', SHARED_SECRET)
    .update(timestamp)
    .digest('hex');

  return token === expectedToken;
}

// Connect to MongoDB
const mongoClient = new MongoClient('mongodb://localhost:27017');
mongoClient.connect().then(() => {
  const db = mongoClient.db('mydatabase');
  collection = db.collection('smarteye_expanded');
  console.log('HTTP Server Connected to MongoDB');
}).catch(err => console.error('MongoDB connection error:', err));


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
//sends all data older than cutoff date then deletes that data
    try {

        const cutoffTime = new Date(Date.now() - DATA_RETENTION_MINUTES * 60 * 1000);

        //first time get 
        const t0 = hrtime();

        const oldDocs = await collection.find({
            received_at: { $lt: cutoffTime }
        }).sort({ received_at: 1 }).toArray();

        // second time get
        const t1 = hrtime();
        // log into file Get
        fs.appendFileSync(GET_TIMINGS_FILE, (t1 - t0).toString() + '\n');

        //first time delete
        const t2 = hrtime();

        const deleteResult = await collection.deleteMany({
            received_at: { $lt: cutoffTime }
        });

        // second time delete
        const t3 = hrtime();
        // log to file delete
        fs.appendFileSync(DELETE_TIMINGS_FILE, (t3 - t2).toString() + '\n');

        console.log(`Deleted ${oldDocs.length} old documents`);
        res.json(oldDocs);

      } catch (err) {

        console.error('DB query failed:', err);
        res.status(500).send('Internal Server Error');
      }

});

  // Start the HTTP server
server.listen(PORT, () => {
    console.log(`HTTP + websocket server is running at http://localhost:${PORT}`);
  });

