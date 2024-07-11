const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncMiddleware = require('../middlewares/async');
const { pgClient } = require('../startup/db');

const router = express.Router();

const signToken = username => {
    return jwt.sign({ username }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

const createSendToken = (username, statusCode, res, msg) => {
    const token = signToken(username);
    const expiresInDays = parseInt(process.env.JWT_COOKIE_EXPIRES_IN);
    const cookieOptions = {
        expires: new Date(
            Date.now() + expiresInDays * 24 * 60 * 60 * 1000
        ),
        httpOnly: true
    };
    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
    res.cookie('jwt', token, cookieOptions);
    
    return res.status(statusCode).json({
        status: 'success',
        message: msg,
        token,
        username
    });
};

router.post('/register', asyncMiddleware(async (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            status: 'fail',
            message: 'Please provide username and password'
        });
    }
    
    const { rows } = await pgClient.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length > 0) {
        return res.status(400).json({
            status: 'fail',
            message: 'Username already exists'
        });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await pgClient.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);

    return createSendToken(username, 201, res, 'Registered successfully');
}));

router.post('/login', asyncMiddleware(async (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            status: 'fail',
            message: 'Please provide username and password'
        });
    }

    const { rows } = await pgClient.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0) {
        return res.status(401).json({
            status: 'fail',
            message: 'Invalid username or password'
        });
    }

    const user = rows[0];

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
        return res.status(401).json({
            status: 'fail',
            message: 'Invalid username or password'
        });
    }
    
    return createSendToken(username, 200, res, 'Logged in successfully');
}));

module.exports = router;
