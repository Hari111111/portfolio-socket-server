require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configuration
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Middleware
app.use(cors({
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
}));
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Socket.IO Server is running' });
});

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// Socket handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join a specific room (optional, for chat app)
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    // Handle incoming messages
    socket.on('send-message', (data) => {
        console.log('Message received:', data);
        
        // Broadcast to all clients including sender (use io.emit)
        // Or broadcast to others (use socket.broadcast.emit)
        if (data.roomId) {
            io.to(data.roomId).emit('receive-message', data);
        } else {
            io.emit('receive-message', data);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    console.log(`Allowed Origin: ${ALLOWED_ORIGIN}`);
});
