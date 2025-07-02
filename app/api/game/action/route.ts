import { type NextRequest, NextResponse } from "next/server"

// Simple in-memory storage
const rooms = new Map<string, any>()
const gameEvents = new Map<string, any[]>()
const playerRooms = new Map<string, string>()
let eventIdCounter = 1

function addEvent(roomId: string, type: string, payload: any) {
  if (!gameEvents.has(roomId)) {
    gameEvents.set(roomId, [])
  }

  const event = {
    id: eventIdCounter++,
    type,
    payload,
    timestamp: Date.now(),
  }

  gameEvents.get(roomId)!.push(event)

  // Keep only last 100 events per room
  const events = gameEvents.get(roomId)!
  if (events.length > 100) {
    gameEvents.set(roomId, events.slice(-100))
  }

  return event
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    const { playerId, roomId, event, data } = await request.json()

    if (!playerId || !event) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await handleEvent(event, data, playerId, roomId)

    return NextResponse.json({
      success: true,
      result,
      events: result.events || [],
    })
  } catch (error) {
    console.error("Action error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    )
  }
}

async function handleEvent(event: string, data: any, playerId: string, roomId?: string) {
  switch (event) {
    case "room:create":
      return handleCreateRoom(data, playerId)

    case "room:join":
      return handleJoinRoom(data, playerId)

    case "room:leave":
      return handleLeaveRoom(playerId, roomId)

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
      throw new Error(`Unknown event: ${event}`)
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
  playerRooms.set(playerId, roomId)

  const event = addEvent(roomId, "room:created", { roomId, room })

  return { roomId, room, events: [event] }
}

function handleJoinRoom(data: any, playerId: string) {
  const room = rooms.get(data.roomCode)

  if (!room) {
    throw new Error("Sala no encontrada")
  }

  if (room.participants.length >= 7) {
    throw new Error("La sala está llena")
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
  playerRooms.set(playerId, data.roomCode)

  const joinEvent = addEvent(data.roomCode, "room:joined", { room })
  const updateEvent = addEvent(data.roomCode, "room:updated", { room })

  return { room, events: [joinEvent, updateEvent] }
}

function handleLeaveRoom(playerId: string, roomId?: string) {
  const currentRoomId = roomId || playerRooms.get(playerId)
  if (!currentRoomId) {
    return { success: true }
  }

  const room = rooms.get(currentRoomId)
  if (room) {
    room.participants = room.participants.filter((p: any) => p.playerId !== playerId)

    if (room.participants.length === 0) {
      rooms.delete(currentRoomId)
      gameEvents.delete(currentRoomId)
    } else {
      rooms.set(currentRoomId, room)
      addEvent(currentRoomId, "room:updated", { room })
    }
  }

  playerRooms.delete(playerId)
  return { success: true }
}

function handleStartGame(roomId: string | undefined, playerId: string) {
  if (!roomId) throw new Error("Room ID requerido")

  const room = rooms.get(roomId)
  if (!room) throw new Error("Sala no encontrada")

  // Only host can start game
  const player = room.participants.find((p: any) => p.playerId === playerId)
  if (!player || player.name !== room.host) {
    throw new Error("Solo el host puede iniciar el juego")
  }

  if (room.participants.length < 2) {
    throw new Error("Se necesitan al menos 2 jugadores")
  }

  room.gameState = "powers"
  rooms.set(roomId, room)

  const event = addEvent(roomId, "game:stateChanged", { gameState: "powers", room })

  return { room, events: [event] }
}

function handleSelectPower(data: any, roomId: string | undefined, playerId: string) {
  if (!roomId) throw new Error("Room ID requerido")

  const room = rooms.get(roomId)
  if (!room) throw new Error("Sala no encontrada")

  const participant = room.participants.find((p: any) => p.playerId === playerId)
  if (!participant) throw new Error("Jugador no encontrado")

  participant.power = data.power

  // Check if all players have selected powers
  const allSelected = room.participants.every((p: any) => p.power !== null)
  if (allSelected) {
    room.gameState = "playing"
    room.currentPlayerIndex = 0
  }

  rooms.set(roomId, room)

  const events = [addEvent(roomId, "room:updated", { room })]

  if (allSelected) {
    events.push(addEvent(roomId, "game:stateChanged", { gameState: "playing", room }))
  }

  return { room, events }
}

function handleShoot(roomId: string | undefined, playerId: string) {
  if (!roomId) throw new Error("Room ID requerido")

  const room = rooms.get(roomId)
  if (!room) throw new Error("Sala no encontrada")

  const alivePlayers = room.participants.filter((p: any) => p.isAlive)
  const currentPlayer = alivePlayers[room.currentPlayerIndex]

  if (!currentPlayer || currentPlayer.playerId !== playerId) {
    throw new Error("No es tu turno")
  }

  // Simple bullet logic - 30% chance of bullet
  const isBullet = Math.random() < 0.3

  const events = []

  if (isBullet) {
    // Player got bullet - eliminate them or reduce lives
    if (currentPlayer.power === "block" && !currentPlayer.powerUsed) {
      currentPlayer.powerUsed = true
      events.push(
        addEvent(roomId, "game:playerAction", {
          playerId: currentPlayer.id,
          action: "block",
          message: `${currentPlayer.name} usó su escudo y bloqueó la bala!`,
        }),
      )
    } else if (currentPlayer.lives > 1) {
      currentPlayer.lives--
      events.push(
        addEvent(roomId, "game:playerAction", {
          playerId: currentPlayer.id,
          action: "hit",
          message: `${currentPlayer.name} recibió una bala pero sobrevivió! (${currentPlayer.lives} vidas restantes)`,
        }),
      )
    } else {
      currentPlayer.isAlive = false
      room.bulletsLeft--
      events.push(
        addEvent(roomId, "game:playerAction", {
          playerId: currentPlayer.id,
          action: "eliminated",
          message: `${currentPlayer.name} fue eliminado!`,
        }),
      )
    }
  } else {
    // Safe shot
    events.push(
      addEvent(roomId, "game:playerAction", {
        playerId: currentPlayer.id,
        action: "safe",
        message: `${currentPlayer.name} tuvo suerte - disparo seguro!`,
      }),
    )
  }

  // Check win condition
  const remainingPlayers = room.participants.filter((p: any) => p.isAlive)
  if (remainingPlayers.length <= 1) {
    room.gameState = "finished"
    if (remainingPlayers.length === 1) {
      remainingPlayers[0].points += 10
    }
    events.push(addEvent(roomId, "game:stateChanged", { gameState: "finished", room }))
  } else {
    // Next turn
    const alivePlayersAfter = room.participants.filter((p: any) => p.isAlive)
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % alivePlayersAfter.length
  }

  rooms.set(roomId, room)
  events.push(addEvent(roomId, "room:updated", { room }))

  return { room, isBullet, events }
}

function handleTargetShoot(data: any, roomId: string | undefined, playerId: string) {
  if (!roomId) throw new Error("Room ID requerido")

  const room = rooms.get(roomId)
  if (!room) throw new Error("Sala no encontrada")

  const targetPlayer = room.participants.find((p: any) => p.id === data.targetId)
  if (!targetPlayer) throw new Error("Objetivo no encontrado")

  const events = []

  // Handle bullet hit
  if (targetPlayer.power === "block" && !targetPlayer.powerUsed) {
    targetPlayer.powerUsed = true
    events.push(
      addEvent(roomId, "game:playerAction", {
        playerId: targetPlayer.id,
        action: "block",
        message: `${targetPlayer.name} bloqueó el disparo con su escudo!`,
      }),
    )
  } else if (targetPlayer.lives > 1) {
    targetPlayer.lives--
    events.push(
      addEvent(roomId, "game:playerAction", {
        playerId: targetPlayer.id,
        action: "hit",
        message: `${targetPlayer.name} fue herido! (${targetPlayer.lives} vidas restantes)`,
      }),
    )
  } else {
    targetPlayer.isAlive = false
    room.bulletsLeft--
    events.push(
      addEvent(roomId, "game:playerAction", {
        playerId: targetPlayer.id,
        action: "eliminated",
        message: `${targetPlayer.name} fue eliminado!`,
      }),
    )
  }

  // Check win condition
  const alivePlayers = room.participants.filter((p: any) => p.isAlive)
  if (alivePlayers.length <= 1) {
    room.gameState = "finished"
    if (alivePlayers.length === 1) {
      alivePlayers[0].points += 10
    }
    events.push(addEvent(roomId, "game:stateChanged", { gameState: "finished", room }))
  } else {
    // Next turn
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % alivePlayers.length
  }

  rooms.set(roomId, room)
  events.push(addEvent(roomId, "room:updated", { room }))

  return { room, events }
}

function handleChatMessage(data: any, roomId: string | undefined, playerId: string) {
  if (!roomId) throw new Error("Room ID requerido")

  const room = rooms.get(roomId)
  if (!room) throw new Error("Sala no encontrada")

  const participant = room.participants.find((p: any) => p.playerId === playerId)
  if (!participant) throw new Error("Jugador no encontrado")

  const event = addEvent(roomId, "chat:messageReceived", {
    playerId: participant.id,
    playerName: participant.name,
    message: data.message,
    timestamp: Date.now(),
  })

  return { events: [event] }
}
