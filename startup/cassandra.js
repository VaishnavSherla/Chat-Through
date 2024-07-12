const cassandra = require('cassandra-driver');
require('dotenv').config();

const cloud = { secureConnectBundle: process.env['ASTRA_DB_SECURE_BUNDLE_PATH'] };
const authProvider = new cassandra.auth.PlainTextAuthProvider('token', process.env['ASTRA_DB_APPLICATION_TOKEN']);
const keyspace = process.env['ASTRA_DB_KEYSPACE'];

const cassandraClient = new cassandra.Client({
  cloud,
  authProvider,
  keyspace,
  pooling: {
    coreConnectionsPerHost: {
      [cassandra.types.distance.local]: 4,  // Number of connections per host for local data center
      [cassandra.types.distance.remote]: 2  // Number of connections per host for remote data center
    },
    maxRequestsPerConnection: 1024,
  }
});

cassandraClient.connect()
  .then(() => console.log('Connected to Astra DB'))
  .catch(err => console.error('Astra DB Connection Error:', err));

module.exports = { cassandraClient };