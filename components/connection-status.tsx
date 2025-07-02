"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff, Loader2 } from "lucide-react"
import { socketManager } from "@/lib/socket"

export function ConnectionStatus() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected")
  const [playerCount, setPlayerCount] = useState(0)

  useEffect(() => {
    const socket = socketManager.getSocket()
    if (!socket) return

    const handleConnect = () => setStatus("connected")
    const handleDisconnect = () => setStatus("disconnected")
    const handleConnecting = () => setStatus("connecting")

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("connecting", handleConnecting)

    // Set initial status
    setStatus(socket.connected ? "connected" : "disconnected")

    return () => {
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("connecting", handleConnecting)
    }
  }, [])

  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: <Wifi className="h-3 w-3" />,
          text: "Conectado",
          className: "bg-green-600",
        }
      case "connecting":
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: "Conectando...",
          className: "bg-yellow-600",
        }
      default:
        return {
          icon: <WifiOff className="h-3 w-3" />,
          text: "Desconectado",
          className: "bg-red-600",
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className="fixed top-4 right-4 z-50">
      <Badge className={`${config.className} text-white flex items-center gap-1`}>
        {config.icon}
        {config.text}
      </Badge>
    </div>
  )
}
