"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Target, Shield, Eye, Crosshair, Zap, Heart, Skull } from "lucide-react"

interface PlayerAction {
  playerId: number
  playerName: string
  action: string
  message: string
  timestamp: number
}

interface PlayerActionsProps {
  actions: PlayerAction[]
}

export function PlayerActions({ actions }: PlayerActionsProps) {
  const [visibleActions, setVisibleActions] = useState<PlayerAction[]>([])

  useEffect(() => {
    // Show only the last 3 actions
    const recentActions = actions.slice(-3)
    setVisibleActions(recentActions)

    // Auto-hide actions after 5 seconds
    const timeouts = recentActions.map((action, index) => {
      return setTimeout(
        () => {
          setVisibleActions((prev) => prev.filter((a) => a.timestamp !== action.timestamp))
        },
        5000 + index * 1000,
      ) // Stagger the hiding
    })

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout))
    }
  }, [actions])

  const getActionIcon = (action: string) => {
    switch (action) {
      case "shoot":
        return <Target className="h-4 w-4" />
      case "block":
        return <Shield className="h-4 w-4" />
      case "peek":
        return <Eye className="h-4 w-4" />
      case "target":
        return <Crosshair className="h-4 w-4" />
      case "event":
        return <Zap className="h-4 w-4" />
      case "heal":
        return <Heart className="h-4 w-4" />
      case "curse":
        return <Skull className="h-4 w-4" />
      default:
        return <Target className="h-4 w-4" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case "shoot":
        return "bg-red-600"
      case "block":
        return "bg-blue-600"
      case "peek":
        return "bg-purple-600"
      case "target":
        return "bg-orange-600"
      case "event":
        return "bg-yellow-600"
      case "heal":
        return "bg-green-600"
      case "curse":
        return "bg-purple-800"
      default:
        return "bg-gray-600"
    }
  }

  if (visibleActions.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-40 space-y-2">
      {visibleActions.map((action) => (
        <Card
          key={`${action.playerId}_${action.timestamp}`}
          className="border-red-800 bg-black/90 text-white animate-in slide-in-from-right duration-300"
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Badge className={`${getActionColor(action.action)} text-white`}>{getActionIcon(action.action)}</Badge>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-300">{action.playerName}</p>
                <p className="text-xs text-white">{action.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
