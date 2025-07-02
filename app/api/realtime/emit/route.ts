import { type NextRequest, NextResponse } from "next/server"

// In-memory storage (use Redis in production)
const rooms = new Map<string, any>()
const gameState = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const { playerId, roomId, event, data } = await request.json()

    if (!playerId || !event) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Handle different events
    const result = await handleEvent(event, data, playerId, roomId)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("Error handling event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function handleEvent(event: string, data: any, playerId: string, roomId?: string) {
  switch (event) {
    case "room:create":
      return handleCreateRoom(data, playerId)

    case "room:join":
      return handleJoinRoom(data, playerId)

    case "game:start":
      return handleStartGame(roomId, playerId)

    case "game:selectPower":
      return handleSelectPower(data, roomId, playerId)

    case "game:shoot":
      return handleShoot(roomId, playerId)

    case "game:targetShoot":
      return handleTargetShoot(data, roomId, playerId)

    case "chat:message":
      return handleChatMessage(data, roomId, playerId)

    default:
      console.log(`Unhandled event: ${event}`)
      return { message: "Event processed" }
  }
}

function handleCreateRoom(data: any, playerId: string) {
  const roomId = generateRoomCode()
  const room = {
    id: roomId,
    name: data.roomName,
    host: data.playerName,
    participants: [
      {
        id: Date.now(),
        name: data.playerName,
        playerId: playerId,
        isAlive: true,
        power: null,
        powerUsed: false,
        points: 0,
        lives: 1,
        cursed: false,
        protected: false,
        isConnected: true,
        lastSeen: Date.now(),
      },
    ],
    gameState: "lobby",
    currentPlayerIndex: 0,
    bulletsLeft: 10,
    round: 1,
    maxRounds: 3,
    createdAt: Date.now(),
  }

  rooms.set(roomId, room)
  gameState.set(roomId, { currentPowerSelection: 0 })

  return { roomId, room }
}

function handleJoinRoom(data: any, playerId: string) {
  const room = rooms.get(data.roomCode)

  if (!room) {
    throw new Error("Room not found")
  }

  if (room.participants.length >= 7) {
    throw new Error("Room is full")
  }

  // Check if player already in room
  const existingPlayer = room.participants.find((p: any) => p.playerId === playerId)
  if (existingPlayer) {
    existingPlayer.isConnected = true
    existingPlayer.lastSeen = Date.now()
  } else {
    room.participants.push({
      id: Date.now(),
      name: data.playerName,
      playerId: playerId,
      isAlive: true,
      power: null,
      powerUsed: false,
      points: 0,
      lives: 1,
      cursed: false,
      protected: false,
      isConnected: true,
      lastSeen: Date.now(),
    })
  }

  rooms.set(data.roomCode, room)

  return { room }
}

function handleStartGame(roomId: string | undefined, playerId: string) {
  if (!roomId) throw new Error("Room ID required")

  const room = rooms.get(roomId)
  if (!room) throw new Error("Room not found")

  // Only host can start game
  if (room.host !== room.participants.find((p: any) => p.playerId === playerId)?.name) {
    throw new Error("Only host can start game")
  }

  room.gameState = "powers"
  rooms.set(roomId, room)

  return { room }
}

function handleSelectPower(data: any, roomId: string | undefined, playerId: string) {
  if (!roomId) throw new Error("Room ID required")

  const room = rooms.get(roomId)
  if (!room) throw new Error("Room not found")

  const state = gameState.get(roomId) || {}
  const participant = room.participants.find((p: any) => p.playerId === playerId)

  if (!participant) throw new Error("Player not found")

  participant.power = data.power

  // Check if all players have selected powers
  const allSelected = room.participants.every((p: any) => p.power !== null)
  if (allSelected) {
    room.gameState = "playing"
    room.currentPlayerIndex = 0
  }

  rooms.set(roomId, room)

  return { room }
}

function handleShoot(roomId: string | undefined, playerId: string) {
  if (!roomId) throw new Error("Room ID required")

  const room = rooms.get(roomId)
  if (!room) throw new Error("Room not found")

  const alivePlayers = room.participants.filter((p: any) => p.isAlive)
  const currentPlayer = alivePlayers[room.currentPlayerIndex]

  if (currentPlayer.playerId !== playerId) {
    throw new Error("Not your turn")
  }

  // Simple bullet logic
  const bulletProbability = room.bulletsLeft / (room.bulletsLeft + alivePlayers.length - 1)
  const isBullet = Math.random() < bulletProbability

  if (isBullet) {
    // Player got bullet - they can choose target
    return { room, bulletTargetMode: true }
  } else {
    // Safe shot - next player's turn
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % alivePlayers.length
    rooms.set(roomId, room)
    return { room, safe: true }
  }
}

function handleTargetShoot(data: any, roomId: string | undefined, playerId: string) {
  if (!roomId) throw new Error("Room ID required")

  const room = rooms.get(roomId)
  if (!room) throw new Error("Room not found")

  const targetPlayer = room.participants.find((p: any) => p.id === data.targetId)
  if (!targetPlayer) throw new Error("Target not found")

  // Handle bullet hit
  if (targetPlayer.power === "block" && !targetPlayer.powerUsed) {
    targetPlayer.powerUsed = true
    // Blocked
  } else if (targetPlayer.lives > 1) {
    targetPlayer.lives--
  } else {
    targetPlayer.isAlive = false
    room.bulletsLeft--
  }

  // Next turn
  const alivePlayers = room.participants.filter((p: any) => p.isAlive)
  if (alivePlayers.length <= 1) {
    room.gameState = "finished"
  } else {
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % alivePlayers.length
  }

  rooms.set(roomId, room)

  return { room }
}

function handleChatMessage(data: any, roomId: string | undefined, playerId: string) {
  if (!roomId) throw new Error("Room ID required")

  const room = rooms.get(roomId)
  if (!room) throw new Error("Room not found")

  const participant = room.participants.find((p: any) => p.playerId === playerId)
  if (!participant) throw new Error("Player not found")

  return {
    message: data.message,
    playerName: participant.name,
    playerId: participant.id,
    timestamp: Date.now(),
  }
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}
