CREATE TABLE users (
    username VARCHAR(15) PRIMARY KEY,
    password VARCHAR(30) NOT NULL
);

CREATE TABLE heartbeats (
    username VARCHAR(15) PRIMARY KEY,
    last_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
