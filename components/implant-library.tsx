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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface Implant {
  id: string
  name: string
  diameter: string
  length: string
  file: string
  thumbnail: string
  surface: string
  material: string
  description: string
  features: string[]
  indications: string[]
  sizes: {
    diameter: string[]
    length: string[]
  }
}

interface Manufacturer {
  name: string
  logo: string
  description: string
  implants: Record<string, Implant>
}

interface ImplantCatalog {
  manufacturers: Record<string, Manufacturer>
}

interface ImplantLibraryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImplantSelect?: (implant: Implant, manufacturer: string) => void
}

export function ImplantLibrary({ open, onOpenChange, onImplantSelect }: ImplantLibraryProps) {
  const [catalog, setCatalog] = useState<ImplantCatalog | null>(null)
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("")
  const [selectedImplant, setSelectedImplant] = useState<Implant | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load implant catalog
  useEffect(() => {
    if (open && !catalog) {
      loadCatalog()
    }
  }, [open, catalog])

  const loadCatalog = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/implants/catalog.json")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setCatalog(data)
      
      // Select first manufacturer by default
      const firstManufacturer = Object.keys(data.manufacturers)[0]
      if (firstManufacturer) {
        setSelectedManufacturer(firstManufacturer)
      }
    } catch (error) {
      console.error("Failed to load implant catalog:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleManufacturerSelect = (manufacturerId: string) => {
    setSelectedManufacturer(manufacturerId)
    setSelectedImplant(null) // Clear implant selection when manufacturer changes
  }

  const handleImplantSelect = (implant: Implant) => {
    setSelectedImplant(implant)
  }

  const handleOk = () => {
    if (selectedImplant && selectedManufacturer) {
      onImplantSelect?.(selectedImplant, selectedManufacturer)
    }
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  if (!catalog) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading implant library...</span>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const manufacturers = catalog.manufacturers
  const selectedManufacturerData = selectedManufacturer ? manufacturers[selectedManufacturer] : null
  const implants = selectedManufacturerData ? Object.values(selectedManufacturerData.implants) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] h-[90vh] flex flex-col p-0 md:max-w-6xl">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Implant Library</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 overflow-hidden">
          {/* Manufacturers Column */}
          <div className="w-full lg:w-1/4 border rounded-lg flex flex-col min-h-0">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-medium">Manufacturers</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {Object.entries(manufacturers).map(([id, manufacturer]) => (
                  <Button
                    key={id}
                    variant={selectedManufacturer === id ? "default" : "ghost"}
                    className="w-full justify-start mb-1 text-left h-auto p-2"
                    onClick={() => handleManufacturerSelect(id)}
                  >
                    <div className="flex flex-col items-start">
                      <div className="font-medium text-sm">{manufacturer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {Object.keys(manufacturer.implants).length} implants
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Implants Column */}
          <div className="w-full lg:w-1/4 border rounded-lg flex flex-col min-h-0">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-medium text-sm">
                {selectedManufacturerData ? selectedManufacturerData.name : "Select Manufacturer"}
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {implants.map((implant) => (
                  <Card
                    key={implant.id}
                    className={`cursor-pointer mb-2 transition-all hover:shadow-md ${
                      selectedImplant?.id === implant.id 
                        ? "ring-2 ring-primary bg-primary/5" 
                        : "hover:bg-muted/30"
                    }`}
                    onClick={() => handleImplantSelect(implant)}
                  >
                    <CardContent className="p-3">
                      <div className="flex gap-2">
                        {/* STL Photo Placeholder */}
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded border flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                          STL
                        </div>
                        
                        {/* Implant Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs truncate text-foreground">
                            {implant.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <div className="flex items-center gap-1">
                              <span>⌀{implant.diameter}</span>
                              <span>•</span>
                              <span>{implant.length}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Implant Info Panel */}
          <div className="w-full lg:w-1/2 border rounded-lg flex flex-col min-h-0">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-medium">Implant Details</h3>
            </div>
            <div className="flex-1 p-4 min-h-0 overflow-hidden flex items-center justify-center">
              {selectedImplant ? (
                <div className="text-center">
                  {/* STL Image */}
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mb-4 mx-auto">
                    <div className="text-center">
                      <div className="text-2xl md:text-3xl mb-1">🦷</div>
                      <div className="text-xs text-muted-foreground">STL Preview</div>
                    </div>
                  </div>
                  
                  {/* Implant Name Only */}
                  <h4 className="text-base md:text-lg font-semibold text-center break-words">{selectedImplant.name}</h4>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <div className="text-3xl md:text-4xl mb-3">🦷</div>
                  <div className="text-sm">Select an implant to view details</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Close
          </Button>
          <Button onClick={handleOk} disabled={!selectedImplant}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}