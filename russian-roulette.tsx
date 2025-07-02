"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Target, Skull, Shield, Eye, Crosshair, Heart, Coins, Copy, Wifi, AlertTriangle } from "lucide-react"
import { gameClient } from "@/lib/game-client"
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
  const [gameState, setGameState] = useState<GameState>("lobby")
  const [gameLog, setGameLog] = useState<string[]>([])

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
      const connected = await gameClient.connect()
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

  // Event handlers
  useEffect(() => {
    const handleConnectionStatus = (data: { status: string }) => {
      setIsConnected(data.status === "connected")

      if (data.status === "error") {
        setConnectionError("Error de conexión - Reintentando...")
      } else if (data.status === "connected") {
        setConnectionError(null)
      }
    }

    const handleRoomCreated = (data: { roomId: string; room: Room }) => {
      setCurrentRoom(data.room)
      setGameMode("game")
      setGameState(data.room.gameState)
      authManager.updateSession({ roomId: data.roomId })
      gameClient.setRoomId(data.roomId)
      addToLog(`Sala "${data.room.name}" creada`)
    }

    const handleRoomJoined = (data: { room: Room }) => {
      setCurrentRoom(data.room)
      setGameMode("game")
      setGameState(data.room.gameState)
      authManager.updateSession({ roomId: data.room.id })
      gameClient.setRoomId(data.room.id)
      addToLog(`Te uniste a la sala "${data.room.name}"`)
    }

    const handleRoomUpdated = (data: { room: Room }) => {
      setCurrentRoom(data.room)
      setGameState(data.room.gameState)
    }

    const handleGameStateChanged = (data: { gameState: GameState; room: Room }) => {
      setGameState(data.gameState)
      setCurrentRoom(data.room)
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

    gameClient.on("connection:statusChanged", handleConnectionStatus)
    gameClient.on("room:created", handleRoomCreated)
    gameClient.on("room:joined", handleRoomJoined)
    gameClient.on("room:updated", handleRoomUpdated)
    gameClient.on("game:stateChanged", handleGameStateChanged)
    gameClient.on("game:playerAction", handlePlayerAction)

    return () => {
      gameClient.off("connection:statusChanged", handleConnectionStatus)
      gameClient.off("room:created", handleRoomCreated)
      gameClient.off("room:joined", handleRoomJoined)
      gameClient.off("room:updated", handleRoomUpdated)
      gameClient.off("game:stateChanged", handleGameStateChanged)
      gameClient.off("game:playerAction", handlePlayerAction)
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

    const success = await gameClient.emit("room:create", {
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

    const success = await gameClient.emit("room:join", {
      roomCode: roomCode.trim().toUpperCase(),
      playerName: playerName.trim(),
    })

    if (!success) {
      setConnectionError("Error al unirse a la sala")
    }
  }

  const leaveRoom = async () => {
    await gameClient.emit("room:leave")
    setCurrentRoom(null)
    setGameMode("menu")
    setGameState("lobby")
    authManager.updateSession({ roomId: undefined })
    gameClient.setRoomId(null)
    resetGameState()
  }

  const copyRoomCode = () => {
    if (currentRoom) {
      navigator.clipboard.writeText(currentRoom.id)
      addToLog("Código de sala copiado al portapapeles")
    }
  }

  const startGame = async () => {
    const success = await gameClient.emit("game:start")
    if (!success) {
      setConnectionError("Error al iniciar el juego")
    }
  }

  const selectPower = async (power: PowerType) => {
    const success = await gameClient.emit("game:selectPower", { power })
    if (!success) {
      setConnectionError("Error al seleccionar poder")
    }
  }

  const shoot = async () => {
    const success = await gameClient.emit("game:shoot")
    if (!success) {
      setConnectionError("Error al disparar")
    }
  }

  const shootTarget = async (targetId: number) => {
    const success = await gameClient.emit("game:targetShoot", { targetId })
    if (!success) {
      setConnectionError("Error al disparar al objetivo")
    }
  }

  const resetGameState = () => {
    setGameLog([])
    setPlayerActions([])
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
                El juego funciona completamente en tu navegador sin necesidad de servidores externos
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
            <h2 className="text-2xl font-bold text-red-400 mb-2">Conectando...</h2>
            <p className="text-red-300">Inicializando el juego</p>
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
  const currentPlayer = alivePlayers[currentRoom.currentPlayerIndex]
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
                  </Button>
                )}

                {playerName !== currentRoom.host && (
                  <div className="text-center text-red-300">Esperando que el host inicie el juego...</div>
                )}
              </div>
            )}

            {/* Powers Selection Phase */}
            {gameState === "powers" && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-red-300 mb-2">Selección de Poderes</h2>
                  <p className="text-red-400">Selecciona tu poder para esta partida</p>
                </div>

                {!myParticipant?.power ? (
                  <div className="grid gap-4">
                    {POWERS.map((power) => (
                      <Card
                        key={power.id}
                        className="cursor-pointer transition-all border-2 border-red-800 bg-red-950/30 hover:border-red-600"
                        onClick={() => selectPower(power.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${power.color}`}>{power.icon}</div>
                            <div className="flex-1">
                              <h3 className="font-bold text-white">{power.name}</h3>
                              <p className="text-sm text-red-300">{power.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="bg-green-900/50 border border-green-600 p-4 rounded-lg">
                      <p className="text-green-300">
                        Has seleccionado: <strong>{POWERS.find((p) => p.id === myParticipant.power)?.name}</strong>
                      </p>
                      <p className="text-sm text-green-400 mt-1">Esperando que otros jugadores seleccionen...</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Playing Phase */}
            {gameState === "playing" && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    <Badge className="bg-red-700 text-white px-4 py-2 text-lg">Balas: {currentRoom.bulletsLeft}</Badge>
                    <Badge className="bg-green-700 text-white px-4 py-2 text-lg">Vivos: {alivePlayers.length}</Badge>
                  </div>
                </div>

                <div className="text-center space-y-4">
                  <h3 className="text-2xl font-bold text-red-300">Turno de:</h3>
                  <div className="bg-red-950/50 p-6 rounded-lg border-2 border-red-600">
                    <p className="text-3xl font-bold text-white mb-2">{currentPlayer?.name}</p>
                    <div className="flex items-center justify-center gap-4 text-sm">
                      {currentPlayer?.power && (
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${POWERS.find((p) => p.id === currentPlayer.power)?.color}`}>
                            {POWERS.find((p) => p.id === currentPlayer.power)?.icon}
                          </div>
                          <span className={currentPlayer.powerUsed ? "text-gray-400 line-through" : "text-white"}>
                            {POWERS.find((p) => p.id === currentPlayer.power)?.name}
                          </span>
                        </div>
                      )}
                      <Badge className="bg-green-700">
                        <Heart className="h-3 w-3 mr-1" />
                        {currentPlayer?.lives}
                      </Badge>
                      <Badge className="bg-blue-700">
                        <Coins className="h-3 w-3 mr-1" />
                        {currentPlayer?.points}
                      </Badge>
                    </div>
                  </div>

                  {currentPlayer?.name === playerName && currentPlayer?.isConnected && (
                    <Button
                      onClick={shoot}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-8 text-xl"
                    >
                      <Target className="h-6 w-6 mr-2" />
                      DISPARAR
                    </Button>
                  )}

                  {currentPlayer?.name !== playerName && (
                    <div className="text-center text-red-300">Esperando que {currentPlayer?.name} tome su turno...</div>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-lg font-semibold text-red-300">Jugadores:</h4>
                  <div className="grid gap-2">
                    {alivePlayers.map((participant, index) => (
                      <div
                        key={participant.id}
                        className={`flex items-center gap-2 p-3 rounded-lg border ${
                          index === currentRoom.currentPlayerIndex
                            ? "bg-red-700/50 border-red-500"
                            : "bg-red-950/30 border-red-800"
                        }`}
                      >
                        <Badge variant="outline" className="border-red-600 text-red-300">
                          #{index + 1}
                        </Badge>
                        <span
                          className={`${index === currentRoom.currentPlayerIndex ? "font-bold text-white" : "text-red-200"} ${!participant.isConnected ? "opacity-50" : ""}`}
                        >
                          {participant.name}
                        </span>
                        <div className="flex items-center gap-1 ml-auto">
                          {participant.power && (
                            <div
                              className={`p-1 rounded ${POWERS.find((p) => p.id === participant.power)?.color} ${participant.powerUsed ? "opacity-50" : ""}`}
                            >
                              {POWERS.find((p) => p.id === participant.power)?.icon}
                            </div>
                          )}
                          <Badge variant="outline" className="border-green-600 text-green-300">
                            <Heart className="h-3 w-3 mr-1" />
                            {participant.lives}
                          </Badge>
                          <Badge variant="outline" className="border-blue-600 text-blue-300">
                            <Coins className="h-3 w-3 mr-1" />
                            {participant.points}
                          </Badge>
                          {!participant.isConnected && <Badge className="bg-red-600 text-xs">OFF</Badge>}
                          {index === currentRoom.currentPlayerIndex && (
                            <Badge className="bg-red-600 text-white">TURNO</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Game Log */}
                {gameLog.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-lg font-semibold text-red-300">Registro del juego:</h4>
                    <div className="bg-black/50 p-3 rounded-lg max-h-32 overflow-y-auto">
                      {gameLog.slice(-5).map((log, index) => (
                        <p key={index} className="text-sm text-red-200">
                          {log}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Finished Phase */}
            {gameState === "finished" && (
              <div className="text-center space-y-6">
                <div className="bg-red-900/50 p-8 rounded-lg border-2 border-red-600">
                  <Skull className="h-16 w-16 mx-auto mb-4 text-red-400" />
                  <h2 className="text-3xl font-bold text-red-400 mb-2">¡JUEGO TERMINADO!</h2>

                  <div className="space-y-4">
                    <h3 className="text-xl text-green-400">🏆 Clasificación Final:</h3>
                    {currentRoom.participants
                      .sort((a, b) => b.points - a.points)
                      .map((participant, index) => (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between bg-black/30 p-3 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              className={index === 0 ? "bg-yellow-600" : index === 1 ? "bg-gray-400" : "bg-orange-600"}
                            >
                              #{index + 1}
                            </Badge>
                            <span className="font-bold text-white">{participant.name}</span>
                            {participant.power && (
                              <div className={`p-1 rounded ${POWERS.find((p) => p.id === participant.power)?.color}`}>
                                {POWERS.find((p) => p.id === participant.power)?.icon}
                              </div>
                            )}
                            {!participant.isConnected && <Badge className="bg-red-600 text-xs">DESCONECTADO</Badge>}
                          </div>
                          <Badge className="bg-green-700">
                            <Coins className="h-3 w-3 mr-1" />
                            {participant.points} pts
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  {playerName === currentRoom.host && (
                    <Button onClick={startGame} className="flex-1 bg-green-600 hover:bg-green-500">
                      Nueva Partida
                    </Button>
                  )}
                  <Button onClick={leaveRoom} className="flex-1 bg-blue-600 hover:bg-blue-500">
                    Salir de la Sala
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
