export interface PlayerSession {
  playerId: string
  playerName: string
  roomId?: string
  createdAt: number
  lastActivity: number
}

class AuthManager {
  private readonly SESSION_KEY = "russian_roulette_session"
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

  createSession(playerName: string): PlayerSession {
    const session: PlayerSession = {
      playerId: this.generatePlayerId(),
      playerName,
      createdAt: Date.now(),
      lastActivity: Date.now(),
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
      if (Date.now() - session.lastActivity > this.SESSION_DURATION) {
        this.clearSession()
        return null
      }

      // Update last activity
      session.lastActivity = Date.now()
      this.saveSession(session)

      return session
    } catch (error) {
      console.error("Error getting session:", error)
      this.clearSession()
      return null
    }
  }

  updateSession(updates: Partial<PlayerSession>): void {
    const session = this.getSession()
    if (!session) return

    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: Date.now(),
    }

    this.saveSession(updatedSession)
  }

  clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY)
  }

  private saveSession(session: PlayerSession): void {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session))
  }

  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  isSessionValid(): boolean {
    const session = this.getSession()
    return session !== null
  }
}

export const authManager = new AuthManager()
