"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Target,
  Skull,
  Shield,
  Eye,
  Crosshair,
  Zap,
  Heart,
  Coins,
  Dice1,
  Copy,
  Wifi,
  AlertTriangle,
} from "lucide-react"
import { realtimeClient } from "@/lib/realtime-client"
import { authManager, type PlayerSession } from "@/lib/auth"
import { Chat } from "@/components/chat"
import { ConnectionStatus } from "@/components/connection-status"
import { PlayerActions } from "@/components/player-actions"

type PowerType = "block" | "peek" | "target" | null
type EventType = "double_turn" | "skip_turn" | "extra_bullet" | "heal" | "curse" | null
type GameState = "lobby" | "powers" | "playing" | "finished"

interface Power {
  id: PowerType
  name: string
  description: string
  icon: React.ReactNode
  color: string
}

interface GameEvent {
  id: EventType
  name: string
  description: string
  icon: React.ReactNode
  probability: number
}

interface Participant {
  id: number
  name: string
  playerId: string
  isAlive: boolean
  power: PowerType
  powerUsed: boolean
  points: number
  lives: number
  cursed: boolean
  protected: boolean
  isConnected: boolean
  lastSeen: number
}

interface Room {
  id: string
  name: string
  host: string
  participants: Participant[]
  gameState: GameState
  currentPlayerIndex: number
  bulletsLeft: number
  round: number
  maxRounds: number
  createdAt: number
}

interface PlayerAction {
  playerId: number
  playerName: string
  action: string
  message: string
  timestamp: number
}

const POWERS: Power[] = [
  {
    id: "block",
    name: "Escudo Divino",
    description: "Evita ser eliminado una vez",
    icon: <Shield className="h-5 w-5" />,
    color: "bg-blue-600",
  },
  {
    id: "peek",
    name: "Ojo Místico",
    description: "Ve si tu próximo disparo será una bala",
    icon: <Eye className="h-5 w-5" />,
    color: "bg-purple-600",
  },
  {
    id: "target",
    name: "Francotirador",
    description: "Dispara a otro jugador en tu turno",
    icon: <Crosshair className="h-5 w-5" />,
    color: "bg-orange-600",
  },
]

const EVENTS: GameEvent[] = [
  {
    id: "double_turn",
    name: "Turno Doble",
    description: "Juegas dos veces seguidas",
    icon: <Dice1 className="h-4 w-4" />,
    probability: 0.15,
  },
  {
    id: "skip_turn",
    name: "Saltar Turno",
    description: "El siguiente jugador pierde su turno",
    icon: <Zap className="h-4 w-4" />,
    probability: 0.1,
  },
  {
    id: "extra_bullet",
    name: "Bala Extra",
    description: "Se agrega una bala al tambor",
    icon: <Target className="h-4 w-4" />,
    probability: 0.08,
  },
  {
    id: "heal",
    name: "Vida Extra",
    description: "Ganas una vida adicional",
    icon: <Heart className="h-4 w-4" />,
    probability: 0.12,
  },
  {
    id: "curse",
    name: "Maldición",
    description: "Próximo disparo tiene más probabilidad de bala",
    icon: <Skull className="h-4 w-4" />,
    probability: 0.1,
  },
]

export default function Component() {
  const [gameMode, setGameMode] = useState<"menu" | "create" | "join" | "game">("menu")
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [playerName, setPlayerName] = useState("")
  const [roomCode, setRoomCode] = useState("")
  const [roomName, setRoomName] = useState("")
  const [session, setSession] = useState<PlayerSession | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [playerActions, setPlayerActions] = useState<PlayerAction[]>([])
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Game states
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [bulletsLeft, setBulletsLeft] = useState(10)
  const [gameState, setGameState] = useState<GameState>("lobby")
  const [eliminatedPlayer, setEliminatedPlayer] = useState<string | null>(null)
  const [lastShot, setLastShot] = useState<"safe" | "bullet" | null>(null)
  const [currentPowerSelection, setCurrentPowerSelection] = useState(0)
  const [peekResult, setPeekResult] = useState<boolean | null>(null)
  const [targetingMode, setTargetingMode] = useState(false)
  const [gameLog, setGameLog] = useState<string[]>([])
  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null)
  const [bulletTargetMode, setBulletTargetMode] = useState(false)
  const [round, setRound] = useState(1)
  const [maxRounds] = useState(3)
  const [skipNextTurn, setSkipNextTurn] = useState(false)
  const [doubleTurn, setDoubleTurn] = useState(false)

  // Initialize session and connection
  useEffect(() => {
    const existingSession = authManager.getSession()
    if (existingSession) {
      setSession(existingSession)
      setPlayerName(existingSession.playerName)
    }

    // Initialize connection
    initializeConnection()
  }, [])

  const initializeConnection = async () => {
    try {
      setConnectionError(null)
      const connected = await realtimeClient.connect()
      setIsConnected(connected)
      
      if (!connected) {
        setConnectionError("No se pudo establecer conexión con el servidor")
      }
    } catch (error) {
      console.error("Connection initialization failed:", error)
      setConnectionError("Error al inicializar la conexión")
      setIsConnected(false)
    }
  }

  // Socket event handlers
  useEffect(() => {
    const handleConnectionStatus = (data: { status: string }) => {
      setIsConnected(data.status === 'connected')
      
      if (data.status === 'error') {
        setConnectionError("Error de conexión - Reintentando...")
      } else if (data.status === 'connected') {
        setConnectionError(null)
      }
    }

    const handleRoomCreated = (data: { roomId: string; room: Room }) => {
      setCurrentRoom(data.room)
      setGameMode("game")
      setGameState(data.room.gameState)
      authManager.updateSession({ roomId: data.roomId })
      realtimeClient.setRoomId(data.roomId)
      addToLog(`Sala "${data.room.name}" creada`)
    }

    const handleRoomJoined = (data: { room: Room }) => {
      setCurrentRoom(data.room)
      setGameMode("game")
      setGameState(data.room.gameState)
      authManager.updateSession({ roomId: data.room.id })
      realtimeClient.setRoomId(data.room.id)
      addToLog(`Te uniste a la sala "${data.room.name}"`)
    }

    const handleRoomUpdated = (data: { room: Room }) => {
      setCurrentRoom(data.room)
      setGameState(data.room.gameState)
      setCurrentPlayerIndex(data.room.currentPlayerIndex)
      setBulletsLeft(data.room.bulletsLeft)
      setRound(data.room.round)
    }

    const handleRoomError = (data: { message: string }) => {
      console.error("Room error:", data.message)
      addToLog(`Error: ${data.message}`)
      setConnectionError(data.message)
    }

    const handleGameStateChanged = (data: { gameState: GameState; room: Room }) => {
      setGameState(data.gameState)
      setCurrentRoom(data.room)
      setCurrentPlayerIndex(data.room.currentPlayerIndex)
      setBulletsLeft(data.room.bulletsLeft)
      setRound(data.room.round)
    }

    const handlePlayerAction = (data: { playerId: number; action: string; message: string }) => {
      const participant = currentRoom?.participants.find((p) => p.id === data.playerId)
      if (participant) {
        const action: PlayerAction = {
          playerId: data.playerId,
          playerName: participant.name,
          action: data.action,
          message: data.message,
          timestamp: Date.now(),
        }
        setPlayerActions((prev) => [...prev, action])
        addToLog(data.message)
      }
    }

    const handlePlayerDisconnect = (data: { playerId: number; playerName: string }) => {
      addToLog(`${data.playerName} se desconectó`)
    }

    const handlePlayerReconnect = (data: { playerId: number; playerName: string }) => {
      addToLog(`${data.playerName} se reconectó`)
    }

    realtimeClient.on('connection:statusChanged', handleConnectionStatus)
    realtimeClient.on('room:created', handleRoomCreated)
    realtimeClient.on('room:joined', handleRoomJoined)
    realtimeClient.on('room:updated', handleRoomUpdated)
    realtimeClient.on('room:error', handleRoomError)
    realtimeClient.on('game:stateChanged', handleGameStateChanged)
    realtimeClient.on('game:playerAction', handlePlayerAction)
    realtimeClient.on('player:disconnect', handlePlayerDisconnect)
    realtimeClient.on('player:reconnect', handlePlayerReconnect)

    return () => {
      realtimeClient.off('connection:statusChanged', handleConnectionStatus)
      realtimeClient.off('room:created', handleRoomCreated)
      realtimeClient.off('room:joined', handleRoomJoined)
      realtimeClient.off('room:updated', handleRoomUpdated)
      realtimeClient.off('room:error', handleRoomError)
      realtimeClient.off('game:stateChanged', handleGameStateChanged)
      realtimeClient.off('game:playerAction', handlePlayerAction)
      realtimeClient.off('player:disconnect', handlePlayerDisconnect)
      realtimeClient.off('player:reconnect', handlePlayerReconnect)
    }
  }, [currentRoom])

  const addToLog = useCallback((message: string) => {
    setGameLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }, [])

  const createRoom = async () => {
    if (!playerName.trim() || !roomName.trim()) return

    let currentSession = session
    if (!currentSession) {
      currentSession = authManager.createSession(playerName)
      setSession(currentSession)
    }

    const success = await realtimeClient.emit("room:create", {
      roomName: roomName.trim(),
      playerName: playerName.trim(),
    })

    if (!success) {
      setConnectionError("Error al crear la sala")
    }
  }

  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) return

    let currentSession = session
    if (!currentSession) {
      currentSession = authManager.createSession(playerName)
      setSession(currentSession)
    }

    const success = await realtimeClient.emit("room:join", {
      roomCode: roomCode.trim().toUpperCase(),
      playerName: playerName.trim(),
    })

    if (!success) {
      setConnectionError("Error al unirse a la sala")
    }
  }

  const leaveRoom = async () => {
    await realtimeClient.emit("room:leave")
    setCurrentRoom(null)
    setGameMode("menu")
    setGameState("lobby")
    authManager.updateSession({ roomId: undefined })
    realtimeClient.setRoomId(null)
    resetGameState()
  }

  const copyRoomCode = () => {
    if (currentRoom) {
      navigator.clipboard.writeText(currentRoom.id)
      addToLog("Código de sala copiado al portapapeles")
    }
  }

  const startGame = async () => {
    const success = await realtimeClient.emit("game:start")
    if (!success) {
      setConnectionError("Error al iniciar el juego")
    }
  }

  const selectPower = async (power: PowerType) => {
    const success = await realtimeClient.emit("game:selectPower", { power })
    if (!success) {
      setConnectionError("Error al seleccionar poder")
    }
  }

  const shoot = async () => {
    const success = await realtimeClient.emit("game:shoot")
    if (!success) {
      setConnectionError("Error al disparar")
    }
  }

  const shootTarget = async (targetId: number) => {
    const success = await realtimeClient.emit("game:targetShoot", { targetId })
    if (!success) {
      setConnectionError("Error al disparar al objetivo")
    }
  }

  const resetGameState = () => {
    setCurrentPlayerIndex(0)
    setBulletsLeft(10)
    setRound(1)
    setGameLog([])
    setEliminatedPlayer(null)
    setLastShot(null)
    setCurrentPowerSelection(0)
    setPeekResult(null)
    setTargetingMode(false)
    setBulletTargetMode(false)
    setCurrentEvent(null)
    setSkipNextTurn(false)
    setDoubleTurn(false)
    setPlayerActions([])
  }

  const resetGame = () => {
    leaveRoom()
  }

  const retryConnection = () => {
    setConnectionError(null)
    initializeConnection()
  }

  // Show connection error screen
  if (connectionError && !isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-black p-4 flex items-center justify-center">
        <Card className="border-red-800 bg-black/80 text-white max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-2xl font-bold text-red-400 mb-2">Error de Conexión</h2>
            <p className="text-red-300 mb-4">{connectionError}</p>
            <div className="space-y-2">
              <Button onClick={retryConnection} className="w-full bg-red-600 hover:bg-red-500">
                Reintentar Conexión
              </Button>
              <p className="text-xs text-red-400">
                Nota: Este juego requiere conexión a internet para funcionar en modo multijugador
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading screen while connecting
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-black p-4 flex items-center justify-center">
        <Card className="border-red-800 bg-black/80 text-white">
          <CardContent className="p-8 text-center">
            <Wifi className="h-16 w-16 mx-auto mb-4 text-red-400 animate-pulse" />
            <h2 className="text-2xl font-bold text-red-400 mb-2">Conectando al servidor...</h2>
            <p className="text-red-300">Por favor espera mientras establecemos la conexión</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (gameMode === "menu") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-black p-4">
        <ConnectionStatus />
        <div className="mx-auto max-w-md">
          <Card className="border-red-800 bg-black/80 text-white">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-3xl font-bold text-red-400">
                <Skull className="h-8 w-8" />
                Ruleta Rusa Online
                <Skull className="h-8 w-8" />
              </CardTitle>
              <p className="text-red-300">Multijugador • Tiempo Real • Chat</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Tu nombre"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-red-950/50 border-red-700 text-white placeholder:text-red-300"
              />

              <div className="space-y-2">
                <Button
                  onClick={() => setGameMode("create")}
                  disabled={!playerName.trim()}
                  className="w-full bg-green-600 hover:bg-green-500"
                >
                  Crear Sala
                </Button>

                <Button
                  onClick={() => setGameMode("join")}
                  disabled={!playerName.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-500"
                >
                  Unirse a Sala
                </Button>
              </div>

              {session && <div className="text-center text-sm text-red-300">Sesión activa: {session.playerName}</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (gameMode === "create") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-black p-4">
        <ConnectionStatus />
        <div className="mx-auto max-w-md">
          <Card className="border-red-800 bg-black/80 text-white">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-red-400">Crear Sala</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Nombre de la sala"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="bg-red-950/50 border-red-700 text-white placeholder:text-red-300"
              />

              <div className="space-y-2">
                <Button
                  onClick={createRoom}
                  disabled={!roomName.trim()}
                  className="w-full bg-green-600 hover:bg-green-500"
                >
                  Crear Sala
                </Button>

                <Button
                  onClick={() => setGameMode("menu")}
                  variant="outline"
                  className="w-full border-red-600 text-red-300 hover:bg-red-900/50"
                >
                  Volver
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (gameMode === "join") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-black p-4">
        <ConnectionStatus />
        <div className="mx-auto max-w-md">
          <Card className="border-red-800 bg-black/80 text-white">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-red-400">Unirse a Sala</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Código de sala"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="bg-red-950/50 border-red-700 text-white placeholder:text-red-300"
              />

              <div className="space-y-2">
                <Button onClick={joinRoom} disabled={!roomCode.trim()} className="w-full bg-blue-600 hover:bg-blue-500">
                  Unirse
                </Button>

                <Button
                  onClick={() => setGameMode("menu")}
                  variant="outline"
                  className="w-full border-red-600 text-red-300 hover:bg-red-900/50"
                >
                  Volver
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!currentRoom) return null

  const alivePlayers = currentRoom.participants.filter((p) => p.isAlive)
  const currentPlayer = alivePlayers[currentPlayerIndex]
  const myParticipant = currentRoom.participants.find((p) => p.name === playerName)

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-black p-4">
      <ConnectionStatus />
      <PlayerActions actions={playerActions} />
      <Chat isOpen={isChatOpen} onToggle={() => setIsChatOpen(!isChatOpen)} currentPlayerId={myParticipant?.id || 0} />

      <div className="mx-auto max-w-4xl">
        <Card className="border-red-800 bg-black/80 text-white">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-3xl font-bold text-red-400">
              <Skull className="h-8 w-8" />
              {currentRoom.name}
              <Skull className="h-8 w-8" />
            </CardTitle>
            <div className="flex items-center justify-center gap-4 text-sm text-red-300">
              <span>Sala: {currentRoom.id}</span>
              <Button onClick={copyRoomCode} size="sm" variant="ghost" className="text-red-300 hover:text-white">
                <Copy className="h-4 w-4" />
              </Button>
              <span>
                Ronda: {round}/{maxRounds}
              </span>
              <Button
                onClick={leaveRoom}
                size="sm"
                variant="outline"
                className="border-red-600 text-red-300 bg-transparent"
              >
                Salir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connection Error Banner */}
            {connectionError && (
              <div className="bg-red-900/50 border border-red-600 p-3 rounded-lg text-center">
                <p className="text-red-300">{connectionError}</p>
                <Button onClick={retryConnection} size="sm" className="mt-2 bg-red-600 hover:bg-red-500">
                  Reintentar
                </Button>
              </div>
            )}

            {/* Current Event Display */}
            {currentEvent && (
              <div className="bg-yellow-900/50 border border-yellow-600 p-4 rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {currentEvent.icon}
                  <h3 className="font-bold text-yellow-300">{currentEvent.name}</h3>
                </div>
                <p className="text-yellow-200">{currentEvent.description}</p>
              </div>
            )}

            {/* Lobby Phase */}
            {gameState === "lobby" && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-red-300 mb-4">Sala de Espera</h2>
                  <p className="text-red-400">Esperando jugadores... ({currentRoom.participants.length}/7)</p>
                </div>

                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-red-300">
                    <Users className="h-5 w-5" />
                    Jugadores
                  </h3>
                  <div className="grid gap-2">
                    {currentRoom.participants.map((participant, index) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between bg-red-950/30 p-3 rounded-lg border border-red-800"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-red-600 text-red-300">
                            #{index + 1}
                          </Badge>
                          <span className={participant.isConnected ? "text-white" : "text-gray-400"}>
                            {participant.name}
                          </span>
                          {participant.name === currentRoom.host && <Badge className="bg-yellow-600">HOST</Badge>}
                          {!participant.isConnected && <Badge className="bg-red-600">DESCONECTADO</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-700">
                            <Coins className="h-3 w-3 mr-1" />
                            {participant.points}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {playerName === currentRoom.host && (
                  <Button
                    onClick={startGame}
                    disabled={currentRoom.participants.length < 2}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3"
                  >
                    {currentRoom.participants.length < 2 ? "Necesitas al menos 2 jugadores" : "Comenzar Juego"}
                  </Button>\
