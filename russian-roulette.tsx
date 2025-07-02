"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Users, Target, Skull, Shield, Eye, Crosshair, Zap, Heart, Coins, Dice1, Copy } from "lucide-react"

type PowerType = "block" | "peek" | "target" | null
type EventType = "double_turn" | "skip_turn" | "extra_bullet" | "heal" | "curse" | null

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
  isAlive: boolean
  power: PowerType
  powerUsed: boolean
  points: number
  lives: number
  cursed: boolean
  protected: boolean
}

interface Room {
  id: string
  name: string
  host: string
  participants: Participant[]
  gameState: "lobby" | "powers" | "playing" | "finished"
  currentPlayerIndex: number
  bulletsLeft: number
  round: number
  maxRounds: number
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

  // Game states
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [bulletsLeft, setBulletsLeft] = useState(10)
  const [gameState, setGameState] = useState<"lobby" | "powers" | "playing" | "finished">("lobby")
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

  // Load room from localStorage on mount
  useEffect(() => {
    const savedRoom = localStorage.getItem("currentRoom")
    if (savedRoom) {
      const room = JSON.parse(savedRoom)
      setCurrentRoom(room)
      setGameMode("game")
      setGameState(room.gameState)
      setCurrentPlayerIndex(room.currentPlayerIndex)
      setBulletsLeft(room.bulletsLeft)
      setRound(room.round)
    }
  }, [])

  // Save room to localStorage whenever it changes
  useEffect(() => {
    if (currentRoom) {
      const roomToSave = {
        ...currentRoom,
        gameState,
        currentPlayerIndex,
        bulletsLeft,
        round,
      }
      localStorage.setItem("currentRoom", JSON.stringify(roomToSave))
    }
  }, [currentRoom, gameState, currentPlayerIndex, bulletsLeft, round])

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const createRoom = () => {
    if (!playerName.trim() || !roomName.trim()) return

    const newRoom: Room = {
      id: generateRoomCode(),
      name: roomName,
      host: playerName,
      participants: [
        {
          id: Date.now(),
          name: playerName,
          isAlive: true,
          power: null,
          powerUsed: false,
          points: 0,
          lives: 1,
          cursed: false,
          protected: false,
        },
      ],
      gameState: "lobby",
      currentPlayerIndex: 0,
      bulletsLeft: 10,
      round: 1,
      maxRounds: 3,
    }

    setCurrentRoom(newRoom)
    setGameMode("game")
    setGameState("lobby")
    addToLog(`Sala "${roomName}" creada por ${playerName}`)
  }

  const joinRoom = () => {
    if (!playerName.trim() || !roomCode.trim()) return

    // Simulate joining a room (in real implementation, this would fetch from server)
    const existingRoom = localStorage.getItem(`room_${roomCode}`)
    if (existingRoom) {
      const room = JSON.parse(existingRoom)
      const newParticipant: Participant = {
        id: Date.now(),
        name: playerName,
        isAlive: true,
        power: null,
        powerUsed: false,
        points: 0,
        lives: 1,
        cursed: false,
        protected: false,
      }

      room.participants.push(newParticipant)
      setCurrentRoom(room)
      setGameMode("game")
      setGameState(room.gameState)
      addToLog(`${playerName} se unió a la sala`)
    } else {
      // Create a mock room for demo purposes
      const mockRoom: Room = {
        id: roomCode,
        name: "Sala Demo",
        host: "Host",
        participants: [
          {
            id: 1,
            name: "Host",
            isAlive: true,
            power: null,
            powerUsed: false,
            points: 0,
            lives: 1,
            cursed: false,
            protected: false,
          },
          {
            id: Date.now(),
            name: playerName,
            isAlive: true,
            power: null,
            powerUsed: false,
            points: 0,
            lives: 1,
            cursed: false,
            protected: false,
          },
        ],
        gameState: "lobby",
        currentPlayerIndex: 0,
        bulletsLeft: 10,
        round: 1,
        maxRounds: 3,
      }
      setCurrentRoom(mockRoom)
      setGameMode("game")
      setGameState("lobby")
      addToLog(`${playerName} se unió a la sala demo`)
    }
  }

  const copyRoomCode = () => {
    if (currentRoom) {
      navigator.clipboard.writeText(currentRoom.id)
      addToLog("Código de sala copiado al portapapeles")
    }
  }

  const addToLog = (message: string) => {
    setGameLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const triggerRandomEvent = () => {
    const random = Math.random()
    let cumulativeProbability = 0

    for (const event of EVENTS) {
      cumulativeProbability += event.probability
      if (random < cumulativeProbability) {
        setCurrentEvent(event)
        executeEvent(event)
        return
      }
    }
  }

  const executeEvent = (event: GameEvent) => {
    if (!currentRoom) return

    const alivePlayers = currentRoom.participants.filter((p) => p.isAlive)
    const currentPlayer = alivePlayers[currentPlayerIndex]

    switch (event.id) {
      case "double_turn":
        setDoubleTurn(true)
        addToLog(`🎲 ${currentPlayer.name} obtuvo Turno Doble!`)
        break
      case "skip_turn":
        setSkipNextTurn(true)
        addToLog(`⚡ El siguiente jugador perderá su turno!`)
        break
      case "extra_bullet":
        setBulletsLeft((prev) => prev + 1)
        addToLog(`🎯 Se agregó una bala extra al tambor!`)
        break
      case "heal":
        setCurrentRoom((prev) =>
          prev
            ? {
                ...prev,
                participants: prev.participants.map((p) =>
                  p.id === currentPlayer.id ? { ...p, lives: p.lives + 1 } : p,
                ),
              }
            : null,
        )
        addToLog(`❤️ ${currentPlayer.name} ganó una vida extra!`)
        break
      case "curse":
        setCurrentRoom((prev) =>
          prev
            ? {
                ...prev,
                participants: prev.participants.map((p) => (p.id === currentPlayer.id ? { ...p, cursed: true } : p)),
              }
            : null,
        )
        addToLog(`💀 ${currentPlayer.name} fue maldecido!`)
        break
    }

    setTimeout(() => setCurrentEvent(null), 3000)
  }

  const startGame = () => {
    if (currentRoom && currentRoom.participants.length >= 2) {
      setGameState("powers")
      setCurrentPowerSelection(0)
      addToLog("¡Comenzando selección de poderes!")
    }
  }

  const selectPower = (participantId: number, power: PowerType) => {
    if (!currentRoom) return

    setCurrentRoom((prev) =>
      prev
        ? {
            ...prev,
            participants: prev.participants.map((p) => (p.id === participantId ? { ...p, power } : p)),
          }
        : null,
    )
  }

  const nextPowerSelection = () => {
    if (!currentRoom) return

    if (currentPowerSelection < currentRoom.participants.length - 1) {
      setCurrentPowerSelection(currentPowerSelection + 1)
    } else {
      setGameState("playing")
      setCurrentPlayerIndex(0)
      addToLog("¡Que comience la ruleta rusa!")
    }
  }

  const shoot = () => {
    if (!currentRoom || bulletsLeft === 0 || gameState !== "playing") return

    const alivePlayers = currentRoom.participants.filter((p) => p.isAlive)
    if (alivePlayers.length <= 1) return

    const currentPlayer = alivePlayers[currentPlayerIndex]

    // Random event chance
    if (Math.random() < 0.2) {
      triggerRandomEvent()
    }

    // Calculate bullet probability (higher if cursed)
    const totalShotsRemaining = bulletsLeft + (alivePlayers.length - 1)
    let bulletProbability = bulletsLeft / totalShotsRemaining
    if (currentPlayer.cursed) {
      bulletProbability *= 1.5 // 50% more likely to get bullet if cursed
    }

    const isBullet = Math.random() < bulletProbability

    if (isBullet) {
      setBulletTargetMode(true)
      addToLog(`💥 ${currentPlayer.name} obtuvo una BALA! Puede elegir a quién disparar...`)
    } else {
      setLastShot("safe")
      addToLog(`🍀 ${currentPlayer.name} - disparo seguro`)
      nextTurn()
    }
  }

  const shootTarget = (targetId: number) => {
    if (!currentRoom) return

    const targetPlayer = currentRoom.participants.find((p) => p.id === targetId)
    const alivePlayers = currentRoom.participants.filter((p) => p.isAlive)
    const currentPlayer = alivePlayers[currentPlayerIndex]

    if (!targetPlayer || !currentPlayer) return

    // Check if target has protection
    if (targetPlayer.power === "block" && !targetPlayer.powerUsed) {
      setCurrentRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) => (p.id === targetPlayer.id ? { ...p, powerUsed: true } : p)),
            }
          : null,
      )
      addToLog(`🛡️ ${targetPlayer.name} bloqueó la bala!`)
      setLastShot("safe")
    } else if (targetPlayer.lives > 1) {
      setCurrentRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) => (p.id === targetPlayer.id ? { ...p, lives: p.lives - 1 } : p)),
            }
          : null,
      )
      addToLog(`💔 ${targetPlayer.name} perdió una vida! (${targetPlayer.lives - 1} restantes)`)
      setLastShot("bullet")
    } else {
      setCurrentRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) => (p.id === targetPlayer.id ? { ...p, isAlive: false } : p)),
            }
          : null,
      )
      setEliminatedPlayer(targetPlayer.name)
      setBulletsLeft((prev) => prev - 1)
      setLastShot("bullet")
      addToLog(`💀 ${targetPlayer.name} fue eliminado por ${currentPlayer.name}!`)

      // Award points to shooter
      setCurrentRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.id === currentPlayer.id ? { ...p, points: p.points + 100 } : p,
              ),
            }
          : null,
      )

      checkGameEnd()
    }

    setBulletTargetMode(false)
    nextTurn()
  }

  const nextTurn = () => {
    if (!currentRoom) return

    const alivePlayers = currentRoom.participants.filter((p) => p.isAlive)

    if (doubleTurn) {
      setDoubleTurn(false)
      addToLog("🎲 Turno doble completado")
    } else {
      let nextIndex = (currentPlayerIndex + 1) % alivePlayers.length

      if (skipNextTurn) {
        const skippedPlayer = alivePlayers[nextIndex]
        addToLog(`⚡ ${skippedPlayer.name} perdió su turno!`)
        nextIndex = (nextIndex + 1) % alivePlayers.length
        setSkipNextTurn(false)
      }

      setCurrentPlayerIndex(nextIndex)
    }

    setPeekResult(null)
    setTargetingMode(false)
  }

  const checkGameEnd = () => {
    if (!currentRoom) return

    const alivePlayers = currentRoom.participants.filter((p) => p.isAlive)

    if (alivePlayers.length <= 1) {
      if (round < maxRounds) {
        // Start next round
        setRound((prev) => prev + 1)
        setBulletsLeft(10)
        setCurrentPlayerIndex(0)

        // Reset some states for next round
        setCurrentRoom((prev) =>
          prev
            ? {
                ...prev,
                participants: prev.participants.map((p) => ({
                  ...p,
                  isAlive: true,
                  powerUsed: false,
                  cursed: false,
                  protected: false,
                  lives: 1,
                })),
              }
            : null,
        )

        addToLog(`🏁 Ronda ${round} completada! Comenzando ronda ${round + 1}...`)
        setGameState("powers")
        setCurrentPowerSelection(0)
      } else {
        setGameState("finished")
        addToLog("🏆 ¡Juego terminado!")
      }
    }
  }

  const resetGame = () => {
    localStorage.removeItem("currentRoom")
    setCurrentRoom(null)
    setGameMode("menu")
    setGameState("lobby")
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
  }

  if (gameMode === "menu") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-black p-4">
        <div className="mx-auto max-w-md">
          <Card className="border-red-800 bg-black/80 text-white">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-3xl font-bold text-red-400">
                <Skull className="h-8 w-8" />
                Ruleta Rusa Pro
                <Skull className="h-8 w-8" />
              </CardTitle>
              <p className="text-red-300">Multijugador • Poderes • Eventos</p>
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
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (gameMode === "create") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-black p-4">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-black p-4">
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
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
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
                          <span>{participant.name}</span>
                          {participant.name === currentRoom.host && <Badge className="bg-yellow-600">HOST</Badge>}
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

                <Button
                  onClick={startGame}
                  disabled={currentRoom.participants.length < 2}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3"
                >
                  {currentRoom.participants.length < 2 ? "Necesitas al menos 2 jugadores" : "Comenzar Juego"}
                </Button>
              </div>
            )}

            {/* Powers Selection Phase */}
            {gameState === "powers" && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-red-300 mb-2">Selección de Poderes - Ronda {round}</h2>
                  <p className="text-red-400">
                    Turno de:{" "}
                    <span className="font-bold text-white">
                      {currentRoom.participants[currentPowerSelection]?.name}
                    </span>
                  </p>
                  <p className="text-sm text-red-300 mt-1">
                    ({currentPowerSelection + 1}/{currentRoom.participants.length})
                  </p>
                </div>

                <div className="grid gap-4">
                  {POWERS.map((power) => (
                    <Card
                      key={power.id}
                      className={`cursor-pointer transition-all border-2 ${
                        currentRoom.participants[currentPowerSelection]?.power === power.id
                          ? "border-yellow-500 bg-yellow-900/20"
                          : "border-red-800 bg-red-950/30 hover:border-red-600"
                      }`}
                      onClick={() => selectPower(currentRoom.participants[currentPowerSelection]?.id, power.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${power.color}`}>{power.icon}</div>
                          <div className="flex-1">
                            <h3 className="font-bold text-white">{power.name}</h3>
                            <p className="text-sm text-red-300">{power.description}</p>
                          </div>
                          {currentRoom.participants[currentPowerSelection]?.power === power.id && (
                            <Badge className="bg-yellow-600">Seleccionado</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button
                  onClick={nextPowerSelection}
                  disabled={!currentRoom.participants[currentPowerSelection]?.power}
                  className="w-full bg-green-600 hover:bg-green-500"
                >
                  {currentPowerSelection < currentRoom.participants.length - 1 ? "Siguiente Jugador" : "Comenzar Ronda"}
                </Button>
              </div>
            )}

            {/* Playing Phase */}
            {gameState === "playing" && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    <Badge className="bg-red-700 text-white px-4 py-2 text-lg">Balas: {bulletsLeft}</Badge>
                    <Badge className="bg-green-700 text-white px-4 py-2 text-lg">Vivos: {alivePlayers.length}</Badge>
                    <Badge className="bg-purple-700 text-white px-4 py-2 text-lg">
                      Ronda: {round}/{maxRounds}
                    </Badge>
                  </div>
                </div>

                <Separator className="bg-red-800" />

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
                      {currentPlayer?.cursed && (
                        <Badge className="bg-purple-700">
                          <Skull className="h-3 w-3 mr-1" />
                          Maldito
                        </Badge>
                      )}
                    </div>
                  </div>

                  {lastShot && (
                    <div
                      className={`p-4 rounded-lg ${lastShot === "safe" ? "bg-green-900/50 border border-green-600" : "bg-red-900/50 border border-red-600"}`}
                    >
                      <p className="text-lg font-semibold">
                        {lastShot === "safe" ? "¡Disparo seguro! 🍀" : "¡BALA! 💀"}
                      </p>
                    </div>
                  )}

                  {/* Bullet Target Mode */}
                  {bulletTargetMode && (
                    <div className="space-y-4">
                      <h4 className="text-lg font-bold text-red-300">¡Tienes una BALA! Elige tu objetivo:</h4>
                      <div className="grid gap-2">
                        {currentRoom.participants
                          .filter((p) => p.isAlive)
                          .map((player) => (
                            <Button
                              key={player.id}
                              onClick={() => shootTarget(player.id)}
                              className="bg-red-700 hover:bg-red-600 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                {player.name}
                              </div>
                              <div className="flex items-center gap-1">
                                {player.power === "block" && !player.powerUsed && (
                                  <Shield className="h-4 w-4 text-blue-400" />
                                )}
                                <Badge variant="outline" className="border-green-600 text-green-300">
                                  <Heart className="h-3 w-3 mr-1" />
                                  {player.lives}
                                </Badge>
                              </div>
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}

                  {!bulletTargetMode && (
                    <Button
                      onClick={shoot}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-8 text-xl"
                    >
                      <Target className="h-6 w-6 mr-2" />
                      DISPARAR
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-lg font-semibold text-red-300">Jugadores:</h4>
                  <div className="grid gap-2">
                    {alivePlayers.map((participant, index) => (
                      <div
                        key={participant.id}
                        className={`flex items-center gap-2 p-3 rounded-lg border ${
                          index === currentPlayerIndex ? "bg-red-700/50 border-red-500" : "bg-red-950/30 border-red-800"
                        }`}
                      >
                        <Badge variant="outline" className="border-red-600 text-red-300">
                          #{index + 1}
                        </Badge>
                        <span className={index === currentPlayerIndex ? "font-bold text-white" : "text-red-200"}>
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
                          {participant.cursed && (
                            <Badge className="bg-purple-700">
                              <Skull className="h-3 w-3" />
                            </Badge>
                          )}
                          {index === currentPlayerIndex && <Badge className="bg-red-600 text-white">TURNO</Badge>}
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
                  <Button onClick={resetGame} className="flex-1 bg-green-600 hover:bg-green-500">
                    Nueva Partida
                  </Button>
                  <Button onClick={() => setGameMode("menu")} className="flex-1 bg-blue-600 hover:bg-blue-500">
                    Menú Principal
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
