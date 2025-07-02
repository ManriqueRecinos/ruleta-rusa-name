import { type NextRequest, NextResponse } from "next/server"

// Simple in-memory storage (use Redis/Database in production)
const gameEvents = new Map<string, any[]>() // roomId -> events[]
const playerRooms = new Map<string, string>() // playerId -> roomId

export async function POST(request: NextRequest) {
  try {
    const { playerId, roomId, lastEventId } = await request.json()

    if (!playerId) {
      return NextResponse.json({ error: "Missing playerId" }, { status: 400 })
    }

    // Get events for the player's room
    const currentRoomId = roomId || playerRooms.get(playerId)
    if (!currentRoomId) {
      return NextResponse.json({ events: [] })
    }

    const events = gameEvents.get(currentRoomId) || []
    const newEvents = events.filter((event) => event.id > lastEventId)

    return NextResponse.json({ events: newEvents })
  } catch (error) {
    console.error("Poll error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
