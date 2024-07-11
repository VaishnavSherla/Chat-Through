const { Client } = require('pg');
require('dotenv').config();

// Initialize PostgreSQL client
const pgClient = new Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

// Connect to PostgreSQL
pgClient.connect()
    .then(() => console.log('Connected to PostgreSQL database'))
    .catch(err => console.error('PostgreSQL connection error', err.stack));

module.exports = { pgClient };
