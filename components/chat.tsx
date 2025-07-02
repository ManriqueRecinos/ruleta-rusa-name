"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Send, X } from "lucide-react"
import { realtimeClient } from "@/lib/realtime-client"

interface ChatMessage {
  id: string
  playerId: number
  playerName: string
  message: string
  timestamp: number
}

interface ChatProps {
  isOpen: boolean
  onToggle: () => void
  currentPlayerId: number
}

export function Chat({ isOpen, onToggle, currentPlayerId }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const handleChatMessage = (data: { playerId: number; playerName: string; message: string; timestamp: number }) => {
      const chatMessage: ChatMessage = {
        id: `${data.playerId}_${data.timestamp}`,
        playerId: data.playerId,
        playerName: data.playerName,
        message: data.message,
        timestamp: data.timestamp,
      }
      setMessages((prev) => [...prev, chatMessage])
    }

    const handleTypingStatus = (data: { playerId: number; playerName: string; isTyping: boolean }) => {
      if (data.playerId === currentPlayerId) return

      setTypingUsers((prev) => {
        if (data.isTyping) {
          return prev.includes(data.playerName) ? prev : [...prev, data.playerName]
        } else {
          return prev.filter((name) => name !== data.playerName)
        }
      })
    }

    realtimeClient.on("chat:messageReceived", handleChatMessage)
    realtimeClient.on("player:typingStatus", handleTypingStatus)

    return () => {
      realtimeClient.off("chat:messageReceived", handleChatMessage)
      realtimeClient.off("player:typingStatus", handleTypingStatus)
    }
  }, [currentPlayerId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    const success = await realtimeClient.emit("chat:message", { message: newMessage.trim() })
    if (success) {
      setNewMessage("")
      setIsTyping(false)
      realtimeClient.emit("player:typing", { isTyping: false })
    }
  }

  const handleInputChange = (value: string) => {
    setNewMessage(value)

    if (!isTyping && value.trim()) {
      setIsTyping(true)
      realtimeClient.emit("player:typing", { isTyping: true })
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      realtimeClient.emit("player:typing", { isTyping: false })
    }, 2000)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={onToggle} className="fixed bottom-4 right-4 z-50 bg-red-600 hover:bg-red-500 rounded-full p-3">
        <MessageCircle className="h-6 w-6" />
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 h-96 border-red-800 bg-black/90 text-white">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chat
          </div>
          <Button onClick={onToggle} size="sm" variant="ghost" className="text-red-300 hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col h-full p-4 pt-0">
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`p-2 rounded-lg ${
                message.playerId === currentPlayerId ? "bg-red-600/50 ml-4" : "bg-red-950/50 mr-4"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-red-300">{message.playerName}</span>
                <span className="text-xs text-red-400">{new Date(message.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm text-white">{message.message}</p>
            </div>
          ))}

          {typingUsers.length > 0 && (
            <div className="text-xs text-red-400 italic">
              {typingUsers.join(", ")} {typingUsers.length === 1 ? "está" : "están"} escribiendo...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe un mensaje..."
            className="bg-red-950/50 border-red-700 text-white placeholder:text-red-300"
            maxLength={200}
          />
          <Button onClick={sendMessage} disabled={!newMessage.trim()} size="sm" className="bg-red-600 hover:bg-red-500">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
