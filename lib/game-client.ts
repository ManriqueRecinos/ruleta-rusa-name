interface GameEvents {
  "room:create": (data: { roomName: string; playerName: string }) => void
  "room:join": (data: { roomCode: string; playerName: string }) => void
  "room:leave": () => void
  "game:start": () => void
  "game:selectPower": (data: { power: string }) => void
  "game:shoot": () => void
  "game:targetShoot": (data: { targetId: number }) => void
  "chat:message": (data: { message: string }) => void
}

class GameClient {
  private eventHandlers: Map<string, Function[]> = new Map()
  private connectionStatus: "connected" | "disconnected" | "connecting" | "error" = "disconnected"
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000
  private pollingInterval: NodeJS.Timeout | null = null
  private playerId: string
  private roomId: string | null = null
  private lastEventId = 0

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

      // Test connection with a simple ping
      const response = await fetch("/api/game/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: this.playerId }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      this.connectionStatus = "connected"
      this.reconnectAttempts = 0
      this.startPolling()
      this.notifyStatusChange()

      console.log("Connected to game service")
      return true
    } catch (error) {
      console.error("Connection failed:", error)
      this.connectionStatus = "error"
      this.notifyStatusChange()
      this.handleReconnect()
      return false
    }
  }

  private startPolling() {
    // Poll for updates every 2 seconds
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollForUpdates()
      } catch (error) {
        console.error("Polling error:", error)
        this.handleConnectionLoss()
      }
    }, 2000)
  }

  private async pollForUpdates() {
    const response = await fetch("/api/game/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: this.playerId,
        roomId: this.roomId,
        lastEventId: this.lastEventId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (data.events && data.events.length > 0) {
      data.events.forEach((event: any) => {
        this.handleMessage(event.type, event.payload)
        this.lastEventId = Math.max(this.lastEventId, event.id)
      })
    }
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

  private handleConnectionLoss() {
    this.connectionStatus = "disconnected"
    this.notifyStatusChange()
    this.cleanup()
    this.handleReconnect()
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1)

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
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
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
      const response = await fetch("/api/game/action", {
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

      const result = await response.json()

      // Handle immediate response
      if (result.events) {
        result.events.forEach((event: any) => {
          this.handleMessage(event.type, event.payload)
        })
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

export const gameClient = new GameClient()
