"use client"

import { useUser } from "@auth0/nextjs-auth0"
import { DashboardContent } from "@/components/dashboard-content"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Dashboard() {
  const { user, isLoading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect via useEffect
  }

  return <DashboardContent />
}