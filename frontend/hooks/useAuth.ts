"use client"

import { useState } from "react"
import type { User } from "@/types"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleMicrosoftLogin = async () => {
    setIsLoggingIn(true)
    // In real implementation, this would use Microsoft Graph API
    setTimeout(() => {
      setUser({
        name: "John Doe",
        email: "john.doe@cloudextel.com",
        avatar: "/placeholder.svg?height=32&width=32",
      })
      setIsAuthenticated(true)
      setIsLoggingIn(false)
    }, 2000)
  }

  const handleLogout = () => {
    setUser(null)
    setIsAuthenticated(false)
  }

  return {
    user,
    isAuthenticated,
    isLoggingIn,
    handleMicrosoftLogin,
    handleLogout,
  }
}
