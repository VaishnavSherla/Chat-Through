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
    try {
        const result = await pgClient.query('SELECT username FROM users');
        res.send(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send({ error: 'Internal Server Error' });
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
                messages.pop(); // Remove the last message
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
    
    // Send message event
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

    // Disconnect event
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
