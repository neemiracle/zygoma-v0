"use client"

import React, { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { RotateCcw, X, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImplantViewerProps {
  implant: {
    name: string
    file: string
    diameter: string
    length: string
    surface: string
    material: string
  } | null
  isVisible: boolean
  onClose: () => void
  className?: string
  sidebarCollapsed?: boolean
}

// Utility function to convert hex to RGB (0-1 range for VTK)
// const hexToRgb = (hex: string) => {
//   const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
//   return result
//     ? {
//         r: parseInt(result[1], 16) / 255,
//         g: parseInt(result[2], 16) / 255,
//         b: parseInt(result[3], 16) / 255,
//       }
//     : { r: 0.8, g: 0.8, b: 0.9 }
// }

export function ImplantViewer({ implant, isVisible, onClose, className, sidebarCollapsed = false }: ImplantViewerProps) {
  const vtkContainerRef = useRef<HTMLDivElement>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [vtkReady, setVtkReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")

  // VTK objects refs
  const vtkModulesRef = useRef<Record<string, unknown>>({})
  const vtkObjectsRef = useRef<Record<string, unknown>>({
    fullScreenRenderWindow: null,
    renderer: null,
    renderWindow: null,
    currentActor: null
  })

  // Initialize VTK.js when component becomes visible or collapse state changes
  useEffect(() => {
    if (!isVisible || !vtkContainerRef.current) return
    
    // If we're collapsed, don't initialize VTK
    if (isCollapsed) return
    
    let mounted = true

    const initializeVTK = async () => {
      try {
        setIsLoading(true)
        setError("")
        console.log("Starting implant VTK initialization...")

        // Cleanup any existing VTK instance first
        const { fullScreenRenderWindow: existingRenderWindow, renderer: existingRenderer } = vtkObjectsRef.current
        if (existingRenderer) {
          const actors = existingRenderer.getActors()
          actors.forEach((actor: unknown) => {
            existingRenderer.removeActor(actor)
          })
        }
        if (existingRenderWindow) {
          existingRenderWindow.delete?.()
        }
        vtkObjectsRef.current = {}

        // Load geometry profile FIRST
        await import("vtk.js/Sources/Rendering/Profiles/Geometry")

        // Load required VTK modules
        const [
          { default: vtkFullScreenRenderWindow },
          { default: vtkInteractorStyleTrackballCamera },
          { default: vtkSTLReader },
          { default: vtkActor },
          { default: vtkMapper },
        ] = await Promise.all([
          import("vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow"),
          import("vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera"),
          import("vtk.js/Sources/IO/Geometry/STLReader"),
          import("vtk.js/Sources/Rendering/Core/Actor"),
          import("vtk.js/Sources/Rendering/Core/Mapper"),
        ])

        if (!mounted || !vtkContainerRef.current) return

        // Store modules for later use
        vtkModulesRef.current = {
          vtkFullScreenRenderWindow,
          vtkInteractorStyleTrackballCamera,
          vtkSTLReader,
          vtkActor,
          vtkMapper,
        }

        // Create render window
        const fullScreenRenderWindow = vtkFullScreenRenderWindow.newInstance({
          rootContainer: vtkContainerRef.current,
          containerStyle: {
            height: "100%",
            width: "100%",
            position: "relative",
          },
        })

        const renderer = fullScreenRenderWindow.getRenderer()
        const renderWindow = fullScreenRenderWindow.getRenderWindow()

        // Configure renderer with darker background for implant viewer
        renderer.setBackground(0.05, 0.05, 0.1)
        renderer.setAutomaticLightCreation(false)
        
        // Add custom lighting for better implant visualization
        const { default: vtkLight } = await import("vtk.js/Sources/Rendering/Core/Light")
        
        // Key light (main directional light)
        const keyLight = vtkLight.newInstance()
        keyLight.setColor(1.0, 1.0, 1.0)
        keyLight.setIntensity(0.8)
        keyLight.setLightTypeToHeadLight()
        keyLight.setPositional(false)
        renderer.addLight(keyLight)
        
        // Fill light (softer secondary light)
        const fillLight = vtkLight.newInstance()
        fillLight.setColor(0.9, 0.9, 1.0)
        fillLight.setIntensity(0.4)
        fillLight.setPosition(-1, 1, 0.5)
        fillLight.setFocalPoint(0, 0, 0)
        fillLight.setPositional(true)
        renderer.addLight(fillLight)
        
        // Rim light (back light for edge definition)
        const rimLight = vtkLight.newInstance()
        rimLight.setColor(1.0, 1.0, 0.9)
        rimLight.setIntensity(0.3)
        rimLight.setPosition(1, -1, -1)
        rimLight.setFocalPoint(0, 0, 0)
        rimLight.setPositional(true)
        renderer.addLight(rimLight)

        // Setup trackball camera interaction
        const interactor = fullScreenRenderWindow.getInteractor()
        const interactorStyle = vtkInteractorStyleTrackballCamera.newInstance()
        interactor.setInteractorStyle(interactorStyle)

        // Store VTK objects
        vtkObjectsRef.current = {
          fullScreenRenderWindow,
          renderer,
          renderWindow,
          currentActor: null
        }

        // Initialize rendering
        renderer.resetCamera()
        renderWindow.render()

        console.log("✓ Implant VTK initialization complete")
        setVtkReady(true)
        setIsLoading(false)

        // Force resize after a small delay to ensure proper rendering
        setTimeout(() => {
          if (fullScreenRenderWindow && mounted) {
            fullScreenRenderWindow.resize()
            renderWindow.render()
          }
        }, 100)
      } catch (error) {
        console.error("Implant VTK initialization failed:", error)
        setError(`VTK initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setIsLoading(false)
      }
    }

    initializeVTK()

    // Cleanup on unmount
    return () => {
      mounted = false
      const { fullScreenRenderWindow, renderer } = vtkObjectsRef.current
      if (renderer) {
        const actors = renderer.getActors()
        actors.forEach((actor: unknown) => {
          renderer.removeActor(actor)
        })
      }
      if (fullScreenRenderWindow) {
        fullScreenRenderWindow.delete?.()
      }
      vtkObjectsRef.current = {}
      setVtkReady(false)
    }
  }, [isVisible, isCollapsed])

  // Load implant STL when implant changes
  useEffect(() => {
    if (!implant || !vtkReady || !vtkModulesRef.current || !vtkObjectsRef.current.renderer) return

    const loadImplantSTL = async () => {
      try {
        setIsLoading(true)
        setError("")
        console.log(`Loading implant STL: ${implant.name}`)

        const { vtkSTLReader, vtkActor, vtkMapper } = vtkModulesRef.current
        const { renderer, renderWindow, currentActor } = vtkObjectsRef.current

        // Fetch and parse STL file
        const response = await fetch(implant.file)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        
        const reader = vtkSTLReader.newInstance()
        reader.parseAsArrayBuffer(arrayBuffer)
        const polyData = reader.getOutputData()

        if (!polyData || polyData.getNumberOfPoints() === 0) {
          throw new Error("Invalid STL file: No geometry data found")
        }

        // Build pipeline
        const mapper = vtkMapper.newInstance()
        mapper.setInputData(polyData)

        const actor = vtkActor.newInstance()
        actor.setMapper(mapper)
        
        // Set implant-specific material properties (premium titanium)
        const property = actor.getProperty()
        const rgb = { r: 0.85, g: 0.85, b: 0.9 } // Titanium color
        
        property.setColor(rgb.r, rgb.g, rgb.b)
        property.setDiffuseColor(rgb.r, rgb.g, rgb.b)
        property.setAmbientColor(rgb.r * 0.2, rgb.g * 0.2, rgb.b * 0.2)
        property.setSpecularColor(1.0, 1.0, 1.0)
        
        // Premium metallic appearance with better light response
        property.setAmbient(0.15)
        property.setDiffuse(0.6)
        property.setSpecular(0.9)
        property.setSpecularPower(50)
        property.setOpacity(1.0)
        property.setMetallic(0.8)
        property.setRoughness(0.2)
        
        property.setLighting(true)
        property.setInterpolationToPhong()

        if (mapper.setScalarVisibility) {
          mapper.setScalarVisibility(false)
        }

        property.modified()
        actor.modified()

        // Replace previous actor
        if (currentActor && renderer) {
          renderer.removeActor(currentActor)
        }

        renderer.addActor(actor)
        renderer.resetCamera()

        vtkObjectsRef.current.currentActor = actor
        renderWindow.render()

        console.log("✓ Implant STL loaded successfully")
        setIsLoading(false)
      } catch (err) {
        console.error("Implant STL loading error:", err)
        const errorMessage = `Failed to load implant STL: ${err instanceof Error ? err.message : 'Unknown error'}`
        setError(errorMessage)
        setIsLoading(false)
      }
    }

    loadImplantSTL()
  }, [implant, vtkReady])

  // Handle sidebar state changes and resize VTK
  useEffect(() => {
    if (vtkReady && !isCollapsed && vtkObjectsRef.current.fullScreenRenderWindow) {
      setTimeout(() => {
        if (vtkObjectsRef.current.fullScreenRenderWindow) {
          vtkObjectsRef.current.fullScreenRenderWindow.resize()
          vtkObjectsRef.current.renderWindow?.render()
          console.log('Implant VTK resized after sidebar state change')
        }
      }, 300) // Longer delay for sidebar animation
    }
  }, [sidebarCollapsed, vtkReady, isCollapsed])

  // Reset camera view
  const resetCamera = () => {
    if (vtkObjectsRef.current.renderer && vtkObjectsRef.current.renderWindow) {
      vtkObjectsRef.current.renderer.resetCamera()
      vtkObjectsRef.current.renderWindow.render()
    }
  }

  if (!isVisible) return null

  // Calculate position based on sidebar state and screen size
  const leftPosition = sidebarCollapsed ? "left-4 sm:left-20" : "left-4 sm:left-80"

  return (
    <Card className={cn(
      "fixed bottom-4 w-[calc(100vw-2rem)] sm:w-80 shadow-lg z-50 transition-all duration-300 ease-in-out",
      leftPosition,
      className
    )}>
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate">
              {implant?.name || "Implant Viewer"}
            </h3>
            {implant && (
              <p className="text-xs text-muted-foreground">
                ⌀{implant.diameter} × {implant.length}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setIsCollapsed(!isCollapsed)}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
            >
              {isCollapsed ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </Button>
            <Button
              onClick={onClose}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent className="p-0">
          <div className="h-36 sm:h-48 relative bg-slate-900">
            <div
              ref={vtkContainerRef}
              className="absolute inset-0"
            />

            {/* Reset Camera Button - Top Right Corner */}
            {vtkObjectsRef.current.currentActor && (
              <Button
                onClick={resetCamera}
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            )}

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="bg-background p-2 rounded text-xs">
                  Loading implant...
                </div>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-2">
                <div className="bg-destructive/90 text-destructive-foreground p-2 rounded text-xs text-center">
                  {error}
                </div>
              </div>
            )}

            {/* No implant state */}
            {!implant && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-muted-foreground text-xs">
                  No implant selected
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}