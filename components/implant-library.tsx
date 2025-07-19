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
                  <Button
                    key={implant.id}
                    variant={selectedImplant?.id === implant.id ? "default" : "ghost"}
                    className="w-full justify-start mb-1 h-auto p-3"
                    onClick={() => handleImplantSelect(implant)}
                  >
                    <div className="text-left">
                      <div className="font-medium text-sm">{implant.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ⌀{implant.diameter} × {implant.length}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {implant.surface}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Implant Info Panel */}
          <div className="w-1/2 border rounded-lg">
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-medium">Implant Details</h3>
            </div>
            <ScrollArea className="h-[calc(60vh-60px)]">
              <div className="p-4">
                {selectedImplant ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{selectedImplant.name}</CardTitle>
                      <CardDescription>{selectedImplant.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Basic Info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Diameter</div>
                          <div className="text-lg">{selectedImplant.diameter}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Length</div>
                          <div className="text-lg">{selectedImplant.length}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Surface</div>
                          <div>{selectedImplant.surface}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Material</div>
                          <div>{selectedImplant.material}</div>
                        </div>
                      </div>

                      <Separator />

                      {/* Features */}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-2">Features</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedImplant.features.map((feature, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Indications */}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-2">Indications</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedImplant.indications.map((indication, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {indication}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Available Sizes */}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-2">Available Sizes</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="font-medium">Diameters:</div>
                            <div className="text-muted-foreground">
                              {selectedImplant.sizes.diameter.join(", ")}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">Lengths:</div>
                            <div className="text-muted-foreground">
                              {selectedImplant.sizes.length.join(", ")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    Select an implant to view details
                  </div>
                )}
              </div>
            </ScrollArea>
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