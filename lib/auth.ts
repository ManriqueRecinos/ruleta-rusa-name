import { v4 as uuidv4 } from "uuid"

export interface PlayerSession {
  playerId: string
  playerName: string
  roomId?: string
  createdAt: number
  lastActive: number
}

class AuthManager {
  private readonly SESSION_KEY = "rr_player_session"
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

  createSession(playerName: string): PlayerSession {
    const session: PlayerSession = {
      playerId: uuidv4(),
      playerName,
      createdAt: Date.now(),
      lastActive: Date.now(),
    }

    this.saveSession(session)
    return session
  }

  getSession(): PlayerSession | null {
    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY)
      if (!sessionData) return null

      const session: PlayerSession = JSON.parse(sessionData)

      // Check if session is expired
      if (Date.now() - session.createdAt > this.SESSION_DURATION) {
        this.clearSession()
        return null
      }

      // Update last active
      session.lastActive = Date.now()
      this.saveSession(session)

      return session
    } catch (error) {
      console.error("Error getting session:", error)
      return null
    }
  }

  updateSession(updates: Partial<PlayerSession>) {
    const session = this.getSession()
    if (session) {
      const updatedSession = { ...session, ...updates, lastActive: Date.now() }
      this.saveSession(updatedSession)
    }
  }

  private saveSession(session: PlayerSession) {
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session))
    } catch (error) {
      console.error("Error saving session:", error)
    }
  }

  clearSession() {
    localStorage.removeItem(this.SESSION_KEY)
  }

  isSessionValid(): boolean {
    const session = this.getSession()
    return session !== null
  }
}

export const authManager = new AuthManager()
