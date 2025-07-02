"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, MessageCircle } from "lucide-react"
import { socketManager } from "@/lib/socket"

interface ChatMessage {
  id: string
  playerId: number
  playerName: string
  message: string
  timestamp: number
  type: "message" | "system" | "action"
}

interface TypingIndicator {
  playerId: number
  playerName: string
}

interface ChatProps {
  isOpen: boolean
  onToggle: () => void
  currentPlayerId: number
}

export function Chat({ isOpen, onToggle, currentPlayerId }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const socket = socketManager.getSocket()
    if (!socket) return

    const handleMessageReceived = (data: {
      playerId: number
      playerName: string
      message: string
      timestamp: number
    }) => {
      const newMsg: ChatMessage = {
        id: `${data.playerId}-${data.timestamp}`,
        playerId: data.playerId,
        playerName: data.playerName,
        message: data.message,
        timestamp: data.timestamp,
        type: "message",
      }
      setMessages((prev) => [...prev, newMsg])
    }

    const handleTypingStatus = (data: { playerId: number; playerName: string; isTyping: boolean }) => {
      if (data.playerId === currentPlayerId) return

      setTypingUsers((prev) => {
        if (data.isTyping) {
          return prev.find((u) => u.playerId === data.playerId)
            ? prev
            : [...prev, { playerId: data.playerId, playerName: data.playerName }]
        } else {
          return prev.filter((u) => u.playerId !== data.playerId)
        }
      })
    }

    socket.on("chat:messageReceived", handleMessageReceived)
    socket.on("player:typingStatus", handleTypingStatus)

    return () => {
      socket.off("chat:messageReceived", handleMessageReceived)
      socket.off("player:typingStatus", handleTypingStatus)
    }
  }, [currentPlayerId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = () => {
    if (!newMessage.trim()) return

    socketManager.emit("chat:message", { message: newMessage.trim() })
    setNewMessage("")
    handleStopTyping()
  }

  const handleInputChange = (value: string) => {
    setNewMessage(value)

    if (value.trim() && !isTyping) {
      setIsTyping(true)
      socketManager.emit("player:typing", { isTyping: true })
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping()
    }, 1000)
  }

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false)
      socketManager.emit("player:typing", { isTyping: false })
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }

  const addSystemMessage = (message: string) => {
    const systemMsg: ChatMessage = {
      id: `system-${Date.now()}`,
      playerId: -1,
      playerName: "Sistema",
      message,
      timestamp: Date.now(),
      type: "system",
    }
    setMessages((prev) => [...prev, systemMsg])
  }

  if (!isOpen) {
    return (
      <Button onClick={onToggle} className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-500 rounded-full p-3 z-50">
        <MessageCircle className="h-6 w-6" />
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 h-96 bg-black/90 border-red-800 text-white z-50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-red-300">Chat</CardTitle>
          <Button variant="ghost" size="sm" onClick={onToggle} className="text-red-300 hover:text-white">
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 flex flex-col h-full">
        <ScrollArea className="flex-1 mb-3">
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className="text-sm">
                {msg.type === "system" ? (
                  <div className="text-yellow-400 italic text-center">{msg.message}</div>
                ) : (
                  <div>
                    <span className="text-blue-400 font-semibold">{msg.playerName}:</span>
                    <span className="ml-2 text-white">{msg.message}</span>
                  </div>
                )}
              </div>
            ))}
            {typingUsers.length > 0 && (
              <div className="text-xs text-gray-400 italic">
                {typingUsers.map((u) => u.playerName).join(", ")} está escribiendo...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Escribe un mensaje..."
            className="bg-red-950/50 border-red-700 text-white placeholder:text-red-300"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            size="sm"
            className="bg-blue-600 hover:bg-blue-500"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
