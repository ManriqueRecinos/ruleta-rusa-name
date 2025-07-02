import type { NextRequest } from "next/server"

// In-memory storage for demo (use Redis in production)
const connections = new Map<string, { playerId: string; lastSeen: number }>()
const rooms = new Map<string, any>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const playerId = searchParams.get("playerId")

  if (!playerId) {
    return new Response("Missing playerId", { status: 400 })
  }

  // Create Server-Sent Events stream
  const stream = new ReadableStream({
    start(controller) {
      // Store connection
      connections.set(playerId, { playerId, lastSeen: Date.now() })

      // Send initial connection confirmation
      const data = JSON.stringify({
        type: "connection:established",
        payload: { playerId, timestamp: Date.now() },
      })
      controller.enqueue(`data: ${data}\n\n`)

      // Keep connection alive with periodic pings
      const keepAlive = setInterval(() => {
        try {
          const pingData = JSON.stringify({
            type: "connection:ping",
            payload: { timestamp: Date.now() },
          })
          controller.enqueue(`data: ${pingData}\n\n`)
        } catch (error) {
          clearInterval(keepAlive)
          connections.delete(playerId)
        }
      }, 25000)

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive)
        connections.delete(playerId)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  })
}
