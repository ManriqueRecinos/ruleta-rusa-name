import { type NextRequest, NextResponse } from "next/server"

// In-memory storage (use Redis in production)
const connections = new Map<string, { playerId: string; lastSeen: number; roomId?: string }>()

export async function POST(request: NextRequest) {
  try {
    const { playerId, roomId } = await request.json()

    if (!playerId) {
      return NextResponse.json({ error: "Missing playerId" }, { status: 400 })
    }

    // Update connection timestamp
    connections.set(playerId, {
      playerId,
      lastSeen: Date.now(),
      roomId,
    })

    return NextResponse.json({ success: true, timestamp: Date.now() })
  } catch (error) {
    console.error("Heartbeat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
