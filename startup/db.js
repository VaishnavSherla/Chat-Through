const { Pool } = require('pg');
require('dotenv').config();

// Initialize PostgreSQL pool
const pgClient = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pgClient.connect()
    .then(() => console.log('Connected to PostgreSQL database'))
    .catch(err => console.error('PostgreSQL connection error', err.stack));

pgClient.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = { pgClient };
