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

const roomMembers = new Map();
const GROUP_MODE = 'group';
const PRIVATE_MODE = 'private';

const createRoomKey = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const removeSocketFromRooms = (socket) => {
    for (const roomId of socket.rooms) {
        if (roomId === socket.id) {
            continue;
        }

        const members = roomMembers.get(roomId);
        if (!members) {
            continue;
        }

        members.delete(socket.id);
        socket.leave(roomId);

        if (members.size === 0) {
            roomMembers.delete(roomId);
            continue;
        }

        io.to(roomId).emit('room-status', {
            roomId,
            participantCount: members.size,
            isFull: members.size >= 2,
        });
    }
};

const emitGroupStatus = () => {
    let participantCount = 0;

    for (const client of io.sockets.sockets.values()) {
        if (client.data.chatMode === GROUP_MODE) {
            participantCount += 1;
        }
    }

    for (const client of io.sockets.sockets.values()) {
        if (client.data.chatMode === GROUP_MODE) {
            client.emit('group-status', { participantCount });
        }
    }
};

const emitActiveUsers = () => {
    const activeUsers = [];
    const seenIds = new Set();
    
    for (const client of io.sockets.sockets.values()) {
        if (client.data.userId && !seenIds.has(client.data.userId)) {
            activeUsers.push(client.data.userId);
            seenIds.add(client.data.userId);
        }
    }
    
    io.emit('update-user-list', activeUsers);
};

// Socket handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    socket.data.chatMode = null;
    socket.data.userId = socket.handshake.query.userId || null;

    if (socket.data.userId) {
        emitActiveUsers();
    }

    socket.on('set-user-id', (userId) => {
        socket.data.userId = userId;
        emitActiveUsers();
    });

    socket.on('join-group', (callback) => {
        removeSocketFromRooms(socket);
        socket.data.chatMode = GROUP_MODE;
        emitGroupStatus();
        callback?.({ success: true, participantCount: [...io.sockets.sockets.values()].filter((client) => client.data.chatMode === GROUP_MODE).length });
    });

    socket.on('leave-group', (callback) => {
        if (socket.data.chatMode === GROUP_MODE) {
            socket.data.chatMode = null;
            emitGroupStatus();
        }

        callback?.({ success: true });
    });

    socket.on('create-room', (callback) => {
        removeSocketFromRooms(socket);
        socket.data.chatMode = PRIVATE_MODE;

        let roomId = createRoomKey();
        while (roomMembers.has(roomId)) {
            roomId = createRoomKey();
        }

        roomMembers.set(roomId, new Set([socket.id]));
        socket.join(roomId);

        console.log(`User ${socket.id} created room ${roomId}`);

        callback?.({
            success: true,
            roomId,
            participantCount: 1,
            isFull: false,
        });
    });

    socket.on('join-room', ({ roomId }, callback) => {
        const normalizedRoomId = roomId?.trim()?.toUpperCase();

        if (!normalizedRoomId) {
            callback?.({ success: false, message: 'Room key is required.' });
            return;
        }

        removeSocketFromRooms(socket);
        socket.data.chatMode = PRIVATE_MODE;

        const members = roomMembers.get(normalizedRoomId);
        if (!members) {
            callback?.({ success: false, message: 'Room not found.' });
            return;
        }

        if (members.has(socket.id)) {
            callback?.({
                success: true,
                roomId: normalizedRoomId,
                participantCount: members.size,
                isFull: members.size >= 2,
            });
            return;
        }

        if (members.size >= 2) {
            callback?.({ success: false, message: 'Room is full. Only 2 users are allowed.' });
            return;
        }

        members.add(socket.id);
        socket.join(normalizedRoomId);

        const roomStatus = {
            roomId: normalizedRoomId,
            participantCount: members.size,
            isFull: members.size >= 2,
        };

        io.to(normalizedRoomId).emit('room-status', roomStatus);
        console.log(`User ${socket.id} joined room ${normalizedRoomId}`);

        callback?.({ success: true, ...roomStatus });
    });

    socket.on('leave-room', (callback) => {
        removeSocketFromRooms(socket);
        socket.data.chatMode = null;
        callback?.({ success: true });
    });

    // Handle incoming messages
    socket.on('send-message', (data) => {
        console.log('Message received:', data);

        if (data?.mode === GROUP_MODE) {
            if (socket.data.chatMode !== GROUP_MODE) {
                socket.emit('chat-error', { message: 'Switch to group chat before sending group messages.' });
                return;
            }

            for (const client of io.sockets.sockets.values()) {
                if (client.data.chatMode === GROUP_MODE) {
                    client.emit('receive-message', {
                        ...data,
                        mode: GROUP_MODE,
                        roomId: '',
                    });
                }
            }
            return;
        }

        if (!data?.roomId) {
            socket.emit('chat-error', { message: 'Join a private room before sending messages.' });
            return;
        }

        if (socket.data.chatMode !== PRIVATE_MODE) {
            socket.emit('chat-error', { message: 'Switch to private chat before sending private messages.' });
            return;
        }

        const normalizedRoomId = data.roomId.trim().toUpperCase();
        const members = roomMembers.get(normalizedRoomId);

        if (!members || !members.has(socket.id)) {
            socket.emit('chat-error', { message: 'You are not part of this room.' });
            return;
        }

        io.to(normalizedRoomId).emit('receive-message', {
            ...data,
            mode: PRIVATE_MODE,
            roomId: normalizedRoomId,
        });
    });

    socket.on('disconnect', () => {
        const wasInGroup = socket.data.chatMode === GROUP_MODE;
        removeSocketFromRooms(socket);
        if (wasInGroup) {
            emitGroupStatus();
        }
        emitActiveUsers();
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    console.log(`Allowed Origin: ${ALLOWED_ORIGIN}`);
});
