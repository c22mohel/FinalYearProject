const { Client } = require('pg');

//database info 
const db = new Client({
  user: 'mohamed',
  host: 'localhost',
  database: 'smarteye_longterm',
  password: '123',
  port: 5432,
});

//connect to database
db.connect()
  .then(() => console.log('Connected to PostgreSQL (from db.js)'))
  .catch((err) => console.error('DB connection error:', err.stack));

module.exports = db;