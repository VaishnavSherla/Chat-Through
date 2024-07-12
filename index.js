const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const { pgClient } = require('./startup/db');
const { cassandraClient } = require('./startup/cassandra');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

app.get('/login', (req, res) => {
    res.status(200).render('login');
});

app.get('/register', (req, res) => {
    res.status(200).render('register');
});

app.get('/', (req, res) => {
    if (!req.cookies || !req.cookies.jwt) {
        return res.status(200).render('login');
    } else {
        try {
            const user = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET);
            if (!user) {
                return res.status(200).render('login');
            }
            res.status(200).render('index', { username: user.username });
        } catch (error) {
            console.error('JWT verification failed:', error);
            res.status(200).render('login');
        }
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('jwt');
    res.redirect('/login');
});


app.get('/getUsers', async (req, res) => {
    const { user } = req.body;

    // Extract JWT token from cookies
    const token = req.headers.cookie?.split('; ')
        .find(cookie => cookie.startsWith('jwt='))
        ?.split('=')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication error: Token not provided' });
    }

    try {
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                console.error('JWT verification error:', err);
                return res.status(401).json({ error: 'Authentication error: Invalid token' });
            }

            const authenticatedUser = decoded.username;

            // Connect to PostgreSQL client
            const client = await pgClient.connect();

            try {
                // Query to fetch users who are contacts of the authenticated user
                const query = `
                    SELECT user2
                    FROM contacts
                    WHERE user1 = $1
                `;
                const result = await client.query(query, [authenticatedUser]);

                // Release the client after query execution
                client.release();

                // Send the fetched users in the response
                res.status(200).json(result.rows);
            } catch (error) {
                console.error('Error executing query:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });
    } catch (error) {
        console.error('Error verifying JWT:', error);
        res.status(401).json({ error: 'Authentication error: Invalid token format' });
    }
});


app.get('/getUserStatus/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const client = await pgClient.connect();
        const query = 'SELECT last_timestamp FROM heartbeats WHERE username = $1';
        const values = [username];
        const result = await client.query(query, values);
        client.release();
        if (result.rows.length > 0) {
            res.status(200).json({ last_timestamp: result.rows[0].last_timestamp });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching user status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.post('/addContact', async (req, res) => {
    const { user } = req.body;
    
    const token = req.headers.cookie?.split('; ')
        .find(cookie => cookie.startsWith('jwt='))
        ?.split('=')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication error: Token not provided' });
    }

    try {
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                console.error('JWT verification error:', err);
                return res.status(401).json({ error: 'Authentication error: Invalid token' });
            }

            const user1 = decoded.username;

            // Check if user exists
            const checkUserQuery = `
                SELECT *
                FROM users
                WHERE (username = $1)
            `

            let result;
            result = await pgClient.query(checkUserQuery, [user]);

            if (result.rows.length != 1) {
                return res.status(400).json({ error: 'User does not exist!' });
            }


            // Check if the contact already exists in the contacts table
            const checkContactQuery = `
                SELECT *
                FROM contacts
                WHERE (user1 = $1 AND user2 = $2) OR (user1 = $2 AND user2 = $1)
            `;
            const checkContactValues = [user1, user];
            result = await pgClient.query(checkContactQuery, checkContactValues);

            if (result.rows.length > 0) {
                return res.status(400).json({ error: 'Contact already exists.' });
            }            

            const insertContactQuery = 'INSERT INTO contacts (user1, user2) VALUES ($1, $2), ($2, $1)';
            const insertContactValues = [user1, user];
            await pgClient.query(insertContactQuery, insertContactValues);

            res.status(200).json({ message: 'Contact added successfully.' });
        });
    } catch (error) {
        console.error('Error adding contact:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

const users = {};

io.use((socket, next) => {
    const token = socket.handshake.headers.cookie?.split('; ')
        .find(cookie => cookie.startsWith('jwt='))
        ?.split('=')[1];

    if (!token) {
        return next(new Error('Authentication error: Token not provided'));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('Authentication error:', err.message);
            return next(new Error('Authentication error'));
        }
        socket.user = decoded;
        users[decoded.username] = socket.id;
        console.log('User authenticated:', decoded.username);
        next();
    });
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('heartbeat', async() => {
        const user = socket.user.username;
        const client = await pgClient.connect();
        const updateQuery = `
                INSERT INTO heartbeats (username, last_timestamp)
                VALUES ($1, CURRENT_TIMESTAMP)
                ON CONFLICT (username)
                DO UPDATE SET last_timestamp = EXCLUDED.last_timestamp
            `;
        const values = [user];
        await client.query(updateQuery, values);
        
        client.release();

    });

    socket.on('fetch-messages', async ({ to, lastFetchedTimestamp = null }) => {
        try {
            if (lastFetchedTimestamp == '-1') {
                return;
            }
            const from = socket.user.username;
            console.log(lastFetchedTimestamp, from, to)
            const [user1, user2] = [from, to].sort();
            
            let query, params;
            const fetchSize = 11;
            const options = { prepare: true, fetchSize };

            if (lastFetchedTimestamp != null) {
                query = `
                    SELECT * FROM chats 
                    WHERE user1 = ? AND user2 = ? AND timestamp < ?
                    ORDER BY timestamp DESC 
                    LIMIT ?
                `;
                params = [user1, user2, lastFetchedTimestamp, fetchSize];
            } else {
                query = `
                    SELECT * FROM chats 
                    WHERE user1 = ? AND user2 = ?
                    ORDER BY timestamp DESC 
                    LIMIT ?
                `;
                params = [user1, user2, fetchSize];
            }

            const result = await cassandraClient.execute(query, params, options);
            let messages = result.rows;

            if (messages.length == 11) {
                messages.pop();
                const tenthItemTimestamp = messages[9].timestamp;
                lastFetchedTimestamp = tenthItemTimestamp;
            } else {
                lastFetchedTimestamp = '-1';
            }

            socket.emit('fetched-messages', {
                messages,
                lastFetchedTimestamp
            });
    
        } catch (err) {
            console.error('Error fetching messages:', err);
            socket.emit('fetch-messages-error', { error: 'Error fetching messages' });
        }
    });
    
    socket.on('send-message', async ({ to, text }) => {
        try {
            const from = socket.user.username;

            if (!from || !to || !text) {
                return socket.emit('message-error', { error: 'Invalid message details' });
            }

            const messageId = uuidv4();
            const timestamp = new Date();

            const [user1, user2] = [from, to].sort();

            await cassandraClient.execute(
                'INSERT INTO chats (chat_id, user1, user2, timestamp, sender_username, message) VALUES (?, ?, ?, ?, ?, ?)',
                [messageId, user1, user2, timestamp, from, text],
                { prepare: true }
            );

            const senderSocketId = users[from];
            const receiverSocketId = users[to];
            if (senderSocketId == receiverSocketId) {
                io.to(senderSocketId).emit('chat-message', { from, text });
                return;
            }
            if (senderSocketId) {
                io.to(senderSocketId).emit('chat-message', { from, text });
            }

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('chat-message', { from, text });
            }

        } catch (error) {
            console.error('Error storing message:', error);
            socket.emit('message-error', { error: 'Error storing message' });
        }
    });

    socket.on('disconnect', () => {
        const userId = Object.keys(users).find(key => users[key] === socket.id);
        if (userId) {
            console.log('User disconnected:', userId);
            delete users[userId];
        }
    });
});

server.listen(4000, () => {
    console.log('Server running on http://localhost:4000');
});
