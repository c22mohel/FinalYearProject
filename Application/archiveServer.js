const express = require('express');
const axios = require('axios');
const { Client } = require('pg');
const startPolling = require('./polling/fetchFromPi');
const summaryRoute = require('./routes/summaryData');
const db = require('./db');

const app = express();
app.use(express.static('public'));
const PORT = 4000;

//url of the raspberry pi, where data is requested
const PI_URL = 'http://192.168.46.126:3000/data';

//startpolling
startPolling(PI_URL, db);

app.get('/data', async (req, res) => {
    try {
        const result = await db.query(`
        SELECT * FROM smarteye_expanded
        ORDER BY received_at DESC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Failed to fetch data from database:', err.message);
        res.status(500).send('Internal Server Error');
    }
});

//servers the summary html
app.get('/summary', (req, res) => {
    res.sendFile(__dirname + '/public/pages/summary.html');
  });
  
//gets the data from the database
app.get('/summaryData', summaryRoute(db));
  

app.listen(PORT, () => {
console.log(`Server running at http://localhost:${PORT}`);
});

  
