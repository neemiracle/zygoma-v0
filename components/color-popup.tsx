"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RotateCcw } from "lucide-react"

interface ColorPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentColor: string
  onColorChange: (color: string) => void
}

// Default color palette
const DEFAULT_COLORS = [
  "#4F46E5", // Indigo (default)
  "#EF4444", // Red
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#F97316", // Orange
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#EC4899", // Pink
  "#6B7280", // Gray
  "#1F2937", // Dark Gray
]

const DEFAULT_COLOR = "#4F46E5"

export function ColorPopup({ open, onOpenChange, currentColor, onColorChange }: ColorPopupProps) {
  const [tempColor, setTempColor] = useState(currentColor)

  // Update temp color when currentColor changes or dialog opens
  useEffect(() => {
    if (open) {
      setTempColor(currentColor)
    }
  }, [open, currentColor])

  const handleColorSelect = (color: string) => {
    setTempColor(color)
  }

  const handleReset = () => {
    setTempColor(DEFAULT_COLOR)
  }

  const handleOk = () => {
    onColorChange(tempColor)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setTempColor(currentColor) // Reset to original color
    onOpenChange(false)
  }

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempColor(e.target.value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-full sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Model Color</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Default Color Palette */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Default Colors</Label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded border-2 transition-all hover:scale-110 ${
                    tempColor === color 
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-muted-foreground/20 hover:border-muted-foreground/40"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Custom Color Picker */}
          <div className="space-y-3">
            <Label htmlFor="custom-color" className="text-sm font-medium">
              Custom Color
            </Label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Input
                id="custom-color"
                type="color"
                value={tempColor}
                onChange={handleCustomColorChange}
                className="w-16 h-10 p-1 border rounded cursor-pointer flex-shrink-0"
              />
              <Input
                type="text"
                value={tempColor}
                onChange={(e) => setTempColor(e.target.value)}
                placeholder="#4F46E5"
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>

          {/* Color Preview */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Preview</Label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div 
                className="w-12 h-12 rounded border flex-shrink-0"
                style={{ backgroundColor: tempColor }}
              />
              <div className="text-sm text-muted-foreground break-all">
                Selected: {tempColor}
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="flex justify-start">
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="gap-2 w-full sm:w-auto"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Default
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleOk} className="w-full sm:w-auto">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}