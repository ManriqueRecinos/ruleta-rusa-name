import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { playerId } = await request.json()

    if (!playerId) {
      return NextResponse.json({ error: "Missing playerId" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      playerId,
    })
  } catch (error) {
    console.error("Ping error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
