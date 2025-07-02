"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff, Loader2, AlertTriangle } from "lucide-react"
import { gameClient } from "@/lib/game-client"

export function ConnectionStatus() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "connecting" | "error">("disconnected")
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  useEffect(() => {
    const handleStatusChange = (data: { status: string; reconnectAttempts: number }) => {
      setStatus(data.status as any)
      setReconnectAttempts(data.reconnectAttempts)
    }

    gameClient.on("connection:statusChanged", handleStatusChange)

    // Set initial status
    setStatus(gameClient.getConnectionStatus())

    return () => {
      gameClient.off("connection:statusChanged", handleStatusChange)
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
          text: reconnectAttempts > 0 ? `Reconectando... (${reconnectAttempts}/5)` : "Conectando...",
          className: "bg-yellow-600",
        }
      case "error":
        return {
          icon: <AlertTriangle className="h-3 w-3" />,
          text: "Error de conexión",
          className: "bg-red-600",
        }
      default:
        return {
          icon: <WifiOff className="h-3 w-3" />,
          text: "Desconectado",
          className: "bg-gray-600",
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className="fixed top-4 right-4 z-50">
      <Badge className={`${config.className} text-white flex items-center gap-1 px-3 py-1`}>
        {config.icon}
        {config.text}
      </Badge>
    </div>
  )
}
