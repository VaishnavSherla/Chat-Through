// requirements/cassandra.js
const cassandra = require('cassandra-driver');
require('dotenv').config();

// Configure Cassandra client
const cloud = { secureConnectBundle: process.env['ASTRA_DB_SECURE_BUNDLE_PATH'] };
const authProvider = new cassandra.auth.PlainTextAuthProvider('token', process.env['ASTRA_DB_APPLICATION_TOKEN']);
const keyspace = process.env['ASTRA_DB_KEYSPACE'];

const cassandraClient = new cassandra.Client({ cloud, authProvider, keyspace });

cassandraClient.connect()
  .then(() => console.log('Connected to Astra DB'))
  .catch(err => console.error('Astra DB Connection Error:', err));

module.exports = { cassandraClient };