# Portfolio Socket Server

A production-ready Socket.io server built with Express and CORS support.

## Features
- **Real-time Messaging**: Multiple clients can connect and exchange messages.
- **Room Support**: Clients can join specific rooms (optional).
- **CORS Configured**: Ready to work with a separate Vercel frontend.
- **Environment Variables**: Managed via `.env` file.
- **Production Ready**: Optimized for deployment on Render.

## Prerequisites
- Node.js (v14 or later)
- npm or yarn

## Installation
1. Clone the repository or copy the files.
2. Install dependencies:
   ```bash
   npm install
   ```

## Local Development
1. Create a `.env` file from the logic in `index.js` or copy the example:
   ```env
   PORT=5000
   ALLOWED_ORIGIN=http://localhost:3000
   ```
2. Start the server in development mode:
   ```bash
   npm run dev
   ```

## Deployment on Render
1. Push your code to a GitHub repository.
2. Log in to [Render](https://render.com/).
3. Create a new **Web Service**.
4. Connect your GitHub repository.
5. Configure the service:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Add environment variables:
   - `PORT`: 10000 (Render's default)
   - `ALLOWED_ORIGIN`: Your Vercel frontend URL (e.g., `https://your-portfolio.vercel.app`)

## Frontend Integration Example (React/Next.js)
```javascript
import { io } from "socket.io-client";

const socket = io("https://your-socket-server.onrender.com", {
  withCredentials: true,
});

// To join a room
socket.emit("join-room", "room-123");

// To send a message
socket.emit("send-message", {
  roomId: "room-123",
  text: "Hello everyone!",
  sender: "John Doe"
});

// To receive messages
socket.on("receive-message", (data) => {
  console.log("New message:", data);
});
```

## Health Check
You can verify the server is running by visiting the root URL:
`GET https://your-socket-server.onrender.com/`
Response: `{"status": "ok", "message": "Socket.IO Server is running"}`
