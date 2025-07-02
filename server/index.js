const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

app.use(cors())
app.use(express.json())

// Game state management
const rooms = new Map()
const playerSessions = new Map()

// Utility functions
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function createRoom(roomName, hostName, hostSocketId) {
  const roomId = generateRoomCode()
  const room = {
    id: roomId,
    name: roomName,
    host: hostName,
    participants: [
      {
        id: Date.now(),
        name: hostName,
        socketId: hostSocketId,
        isAlive: true,
        power: null,
        powerUsed: false,
        points: 0,
        lives: 1,
        cursed: false,
        protected: false,
        isConnected: true,
        lastSocketId: hostSocketId, // Fixed undeclared variable lastS
      },
    ],
  }
  rooms.set(roomId, room)
  return room
}

// Additional code can be added here for further functionality
