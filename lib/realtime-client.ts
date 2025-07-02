export interface RealtimeEvents {
  // Room events
  "room:create": (data: { roomName: string; playerName: string }) => void
  "room:join": (data: { roomCode: string; playerName: string }) => void
  "room:leave": () => void
  "room:created": (data: { roomId: string; room: any }) => void
  "room:joined": (data: { room: any }) => void
  "room:updated": (data: { room: any }) => void
  "room:error": (data: { message: string }) => void

  // Game events
  "game:start": () => void
  "game:selectPower": (data: { power: string }) => void
  "game:shoot": () => void
  "game:targetShoot": (data: { targetId: number }) => void
  "game:stateChanged": (data: { gameState: string; room: any }) => void
  "game:playerAction": (data: { playerId: number; action: string; message: string }) => void

  // Chat events
  "chat:message": (data: { message: string }) => void
  "chat:messageReceived": (data: { playerId: number; playerName: string; message: string; timestamp: number }) => void

  // Player events
  "player:disconnect": (data: { playerId: number; playerName: string }) => void
  "player:reconnect": (data: { playerId: number; playerName: string }) => void
}

class RealtimeClient {
  private eventHandlers: Map<string, Function[]> = new Map()
  private connectionStatus: "connected" | "disconnected" | "connecting" | "error" = "disconnected"
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000
  private heartbeatInterval: NodeJS.Timeout | null = null
  private eventSource: EventSource | null = null
  private playerId: string | null = null
  private roomId: string | null = null

  constructor() {
    this.playerId = this.generatePlayerId()
  }

  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  async connect(): Promise<boolean> {
    try {
      this.connectionStatus = "connecting"
      this.notifyStatusChange()

      // Try to establish connection using Server-Sent Events
      await this.connectWithSSE()

      this.connectionStatus = "connected"
      this.reconnectAttempts = 0
      this.startHeartbeat()
      this.notifyStatusChange()

      console.log("Connected to realtime service")
      return true
    } catch (error) {
      console.error("Connection failed:", error)
      this.connectionStatus = "error"
      this.notifyStatusChange()
      this.handleReconnect()
      return false
    }
  }

  private async connectWithSSE(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Use Server-Sent Events for real-time updates
        this.eventSource = new EventSource(`/api/realtime/connect?playerId=${this.playerId}`)

        this.eventSource.onopen = () => {
          console.log("SSE connection opened")
          resolve()
        }

        this.eventSource.onerror = (error) => {
          console.error("SSE connection error:", error)
          reject(error)
        }

        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data.type, data.payload)
          } catch (error) {
            console.error("Error parsing SSE message:", error)
          }
        }

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.connectionStatus === "connecting") {
            reject(new Error("Connection timeout"))
          }
        }, 10000)
      } catch (error) {
        reject(error)
      }
    })
  }

  private handleMessage(type: string, payload: any) {
    const handlers = this.eventHandlers.get(type) || []
    handlers.forEach((handler) => {
      try {
        handler(payload)
      } catch (error) {
        console.error(`Error handling message type ${type}:`, error)
      }
    })
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat()
    }, 30000) // Send heartbeat every 30 seconds
  }

  private async sendHeartbeat() {
    try {
      await fetch("/api/realtime/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: this.playerId, roomId: this.roomId }),
      })
    } catch (error) {
      console.error("Heartbeat failed:", error)
      this.handleConnectionLoss()
    }
  }

  private handleConnectionLoss() {
    this.connectionStatus = "disconnected"
    this.notifyStatusChange()
    this.cleanup()
    this.handleReconnect()
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff

      console.log(`Reconnection attempt ${this.reconnectAttempts} in ${delay}ms`)

      setTimeout(() => {
        this.connect()
      }, delay)
    } else {
      console.error("Max reconnection attempts reached")
      this.connectionStatus = "error"
      this.notifyStatusChange()
    }
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }

  disconnect() {
    this.cleanup()
    this.connectionStatus = "disconnected"
    this.notifyStatusChange()
  }

  async emit(event: string, data?: any): Promise<boolean> {
    if (this.connectionStatus !== "connected") {
      console.warn("Cannot emit event: not connected")
      return false
    }

    try {
      const response = await fetch("/api/realtime/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: this.playerId,
          roomId: this.roomId,
          event,
          data,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return true
    } catch (error) {
      console.error("Error emitting event:", error)
      this.handleConnectionLoss()
      return false
    }
  }

  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  off(event: string, handler?: Function) {
    if (!handler) {
      this.eventHandlers.delete(event)
      return
    }

    const handlers = this.eventHandlers.get(event) || []
    const index = handlers.indexOf(handler)
    if (index > -1) {
      handlers.splice(index, 1)
    }
  }

  private notifyStatusChange() {
    this.handleMessage("connection:statusChanged", {
      status: this.connectionStatus,
      playerId: this.playerId,
      reconnectAttempts: this.reconnectAttempts,
    })
  }

  getConnectionStatus() {
    return this.connectionStatus
  }

  getPlayerId() {
    return this.playerId
  }

  setRoomId(roomId: string | null) {
    this.roomId = roomId
  }
}

export const realtimeClient = new RealtimeClient()
