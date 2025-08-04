"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Target, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

interface Landmark {
  x: number
  y: number
  z: number
  id: string
}

interface LandmarkTableProps {
  landmarks: Landmark[]
  onLandmarkClick?: (landmark: Landmark) => void
  onLandmarkDelete?: (landmarkId: string) => void
  selectedLandmarkId?: string
  className?: string
}

export function LandmarkTable({ 
  landmarks, 
  onLandmarkClick, 
  onLandmarkDelete, 
  selectedLandmarkId,
  className 
}: LandmarkTableProps) {
  if (landmarks.length === 0) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4" />
            Landmarks
            <Badge variant="secondary" className="ml-auto">
              0
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-4 text-muted-foreground text-sm">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No landmarks placed</p>
            <p className="text-xs mt-1">Shift+Click on STL to add</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Target className="w-4 h-4" />
          Landmarks
          <Badge variant="secondary" className="ml-auto">
            {landmarks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {landmarks.map((landmark, index) => (
            <div
              key={landmark.id}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors hover:bg-accent",
                selectedLandmarkId === landmark.id && "bg-accent border-primary"
              )}
              onClick={() => onLandmarkClick?.(landmark)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500 flex-shrink-0" />
                  <span className="text-sm font-medium">
                    L {index + 1}
                  </span>
                </div>
                {/* <div className="text-xs text-muted-foreground font-mono mt-1">
                  X: {landmark.x.toFixed(3)} Y: {landmark.y.toFixed(3)} Z: {landmark.z.toFixed(3)}
                </div> */}
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  onLandmarkDelete?.(landmark.id)
                }}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
        
        {/* {landmarks.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground">
              <p>• Click landmark to highlight</p>
              <p>• Red = selected landmark</p>
              <p>• Ctrl+Click STL to remove latest</p>
            </div>
          </div>
        )} */}
      </CardContent>
    </Card>
  )
}