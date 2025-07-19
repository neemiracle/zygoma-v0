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
      <DialogContent className="max-w-6xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Implant Library</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-4 h-[60vh]">
          {/* Manufacturers Column */}
          <div className="w-1/4 border rounded-lg">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-medium">Manufacturers</h3>
            </div>
            <ScrollArea className="h-[calc(60vh-60px)]">
              <div className="p-2">
                {Object.entries(manufacturers).map(([id, manufacturer]) => (
                  <Button
                    key={id}
                    variant={selectedManufacturer === id ? "default" : "ghost"}
                    className="w-full justify-start mb-1"
                    onClick={() => handleManufacturerSelect(id)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{manufacturer.name}</div>
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
          <div className="w-1/4 border rounded-lg">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-medium">
                {selectedManufacturerData ? selectedManufacturerData.name : "Select Manufacturer"}
              </h3>
            </div>
            <ScrollArea className="h-[calc(60vh-60px)]">
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
                      <div className="flex gap-3">
                        {/* STL Photo Placeholder */}
                        <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded border flex items-center justify-center text-xs text-muted-foreground">
                          STL
                        </div>
                        
                        {/* Implant Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate text-foreground">
                            {implant.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <div className="flex items-center gap-2">
                              <span>⌀{implant.diameter}</span>
                              <span>•</span>
                              <span>{implant.length}</span>
                            </div>
                            <div className="mt-0.5">
                              {implant.surface} • {implant.material}
                            </div>
                          </div>
                          
                          {/* Medical Grade Indicator */}
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-green-600 font-medium">Medical Grade</span>
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
          <div className="w-1/2 border rounded-lg flex flex-col">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-medium">Implant Details</h3>
            </div>
            <div className="flex-1 p-4 overflow-hidden">
              {selectedImplant ? (
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold">{selectedImplant.name}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">{selectedImplant.description}</p>
                  </div>

                  {/* Basic Specifications */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Diameter</div>
                        <div className="text-lg font-semibold">{selectedImplant.diameter}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Surface</div>
                        <div className="text-sm">{selectedImplant.surface}</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Length</div>
                        <div className="text-lg font-semibold">{selectedImplant.length}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Material</div>
                        <div className="text-sm">{selectedImplant.material}</div>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Key Features */}
                  <div className="mb-4">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Key Features</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedImplant.features.slice(0, 4).map((feature, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Primary Indications */}
                  <div className="mb-4">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Primary Indications</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedImplant.indications.slice(0, 3).map((indication, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {indication}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Available Size Range */}
                  <div className="mt-auto">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Available Range</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-muted/30 p-2 rounded">
                        <div className="font-medium">Diameters</div>
                        <div className="text-muted-foreground">
                          {selectedImplant.sizes.diameter.slice(0, 3).join(", ")}
                          {selectedImplant.sizes.diameter.length > 3 && "..."}
                        </div>
                      </div>
                      <div className="bg-muted/30 p-2 rounded">
                        <div className="font-medium">Lengths</div>
                        <div className="text-muted-foreground">
                          {selectedImplant.sizes.length.slice(0, 3).join(", ")}
                          {selectedImplant.sizes.length.length > 3 && "..."}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <div className="text-lg mb-2">📋</div>
                    <div className="text-sm">Select an implant to view details</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
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