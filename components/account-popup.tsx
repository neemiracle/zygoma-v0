"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Trash2, AlertTriangle } from "lucide-react"
// import { useUser } from "@auth0/nextjs-auth0"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AccountPopupProps {
  user: {
    name: string
    email: string
    avatar: string
  }
  userSub: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AccountPopup({ user, userSub, open, onOpenChange }: AccountPopupProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true)
      
      // Make API call to delete account
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userSub || user.email // Use Auth0 user sub ID, fallback to email
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Show success message briefly before logout
        alert('Account successfully deleted. You will be logged out now.')
        // Redirect to logout after successful deletion
        window.location.href = '/auth/logout'
      } else {
        // Show specific error message from server
        const errorMessage = data.error || 'Failed to delete account'
        const details = data.details || ''
        console.error('Account deletion failed:', errorMessage)
        
        if (response.status === 501) {
          // Configuration error - show helpful message
          alert(`Account deletion is not configured yet.\n\n${details}\n\nPlease contact support or check the AUTH0_SETUP.md file for setup instructions.`)
        } else {
          alert(`Failed to delete account: ${errorMessage}`)
        }
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Failed to delete account. Please check your connection and try again.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[90vw] w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Account Information</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* User Profile Section */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="text-lg">
                  {user.name?.slice(0, 2)?.toUpperCase() || "CN"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-semibold break-words">{user.name}</h3>
                <p className="text-sm text-muted-foreground break-all">{user.email}</p>
                <Badge variant="secondary" className="mt-1">
                  Free Account
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Danger Zone */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Once you delete your account, there is no going back. This action cannot be undone.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account
              and remove your data from our servers. All your STL files and settings will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Yes, delete my account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}