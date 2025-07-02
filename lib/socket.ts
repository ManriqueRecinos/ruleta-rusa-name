import { io, type Socket } from "socket.io-client"
import type { Room, PowerType, GameState } from "./types" // Assuming these types are declared in a separate file

export interface SocketEvents {
  // Room events
  "room:create": (data: { roomName: string; playerName: string }) => void
  "room:join": (data: { roomCode: string; playerName: string }) => void
  "room:leave": () => void
  "room:created": (data: { roomId: string; room: Room }) => void
  "room:joined": (data: { room: Room }) => void
  "room:updated": (data: { room: Room }) => void
  "room:error": (data: { message: string }) => void

  // Game events
  "game:start": () => void
  "game:selectPower": (data: { power: PowerType }) => void
  "game:shoot": () => void
  "game:targetShoot": (data: { targetId: number }) => void
  "game:stateChanged": (data: { gameState: GameState; room: Room }) => void
  "game:playerAction": (data: { playerId: number; action: string; message: string }) => void

  // Chat events
  "chat:message": (data: { message: string }) => void
  "chat:messageReceived": (data: { playerId: number; playerName: string; message: string; timestamp: number }) => void

  // Player events
  "player:disconnect": (data: { playerId: number; playerName: string }) => void
  "player:reconnect": (data: { playerId: number; playerName: string }) => void
  "player:typing": (data: { isTyping: boolean }) => void
  "player:typingStatus": (data: { playerId: number; playerName: string; isTyping: boolean }) => void
}

class SocketManager {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "ws://localhost:3001", {
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: true,
    })

    this.socket.on("connect", () => {
      console.log("Connected to server")
      this.reconnectAttempts = 0
    })

    this.socket.on("disconnect", (reason) => {
      console.log("Disconnected from server:", reason)
      if (reason === "io server disconnect") {
        // Server disconnected, try to reconnect
        this.handleReconnect()
      }
    })

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error)
      this.handleReconnect()
    })

    return this.socket
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        console.log(`Reconnection attempt ${this.reconnectAttempts}`)
        this.socket?.connect()
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  getSocket(): Socket | null {
    return this.socket
  }

  emit<K extends keyof SocketEvents>(event: K, data?: Parameters<SocketEvents[K]>[0]) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    }
  }

  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]) {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  off<K extends keyof SocketEvents>(event: K, callback?: SocketEvents[K]) {
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }
}

export const socketManager = new SocketManager()
