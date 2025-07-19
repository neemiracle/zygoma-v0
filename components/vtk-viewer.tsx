"use client"

import React, { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RotateCcw, Palette } from "lucide-react"
import { cn } from "@/lib/utils"

interface VTKViewerProps {
  className?: string
  onFileLoad?: (fileName: string) => void
  onColorChange?: (color: string) => void
  currentColor?: string
  fileName?: string
}

// Utility function to convert hex to RGB (0-1 range for VTK)
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0.8, g: 0.8, b: 0.9 }
}

export const VTKViewer = React.forwardRef<VTKViewerRef, VTKViewerProps>(({ 
  className, 
  onFileLoad, 
  onColorChange, 
  currentColor = "#4F46E5",
  fileName = ""
}, ref) => {
  const vtkContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [vtkReady, setVtkReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")

  // VTK objects refs - using same pattern as reference
  const vtkModulesRef = useRef<any>({})
  const vtkObjectsRef = useRef<any>({
    fullScreenRenderWindow: null,
    renderer: null,
    renderWindow: null,
    currentActor: null
  })

  // Initialize VTK.js - exact pattern from reference
  useEffect(() => {
    if (!vtkContainerRef.current) return
    let mounted = true

    const initializeVTK = async () => {
      try {
        setIsLoading(true)
        setError("")
        console.log("Starting VTK initialization...")

        // 1️⃣ Load geometry profile FIRST (critical!)
        await import("vtk.js/Sources/Rendering/Profiles/Geometry")
        console.log("✓ Geometry profile loaded")

        // 2️⃣ Load required VTK modules
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
        console.log("✓ VTK modules loaded")

        if (!mounted || !vtkContainerRef.current) return

        // Store modules for later use
        vtkModulesRef.current = {
          vtkFullScreenRenderWindow,
          vtkInteractorStyleTrackballCamera,
          vtkSTLReader,
          vtkActor,
          vtkMapper,
        }

        // 3️⃣ Create render window
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

        // 4️⃣ Configure renderer
        renderer.setBackground(0.1, 0.1, 0.1)
        
        // Check VTK renderer capabilities
        console.log('VTK Renderer initialized with capabilities:', {
          background: renderer.getBackground(),
          numberOfActors: renderer.getActors().length,
          lighting: renderer.getAutomaticLightCreation()
        })
        
        // Set up better lighting for natural appearance
        renderer.setAutomaticLightCreation(true)
        
        // Get or create lights for better illumination
        const lights = renderer.getLights()
        if (lights.length === 0) {
          console.log('VTK will create automatic lighting')
        } else {
          console.log('Existing lights found:', lights.length)
        }

        // 5️⃣ Setup trackball camera interaction
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

        console.log("✓ VTK initialization complete")
        setVtkReady(true)
        setError("")
        setIsLoading(false)
      } catch (error) {
        console.error("VTK initialization failed:", error)
        setError(`VTK initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setIsLoading(false)
      }
    }

    initializeVTK()

    // Cleanup on unmount
    return () => {
      mounted = false
      // Cleanup VTK objects
      const { fullScreenRenderWindow, renderer } = vtkObjectsRef.current
      if (renderer) {
        // Remove all actors
        const actors = renderer.getActors()
        actors.forEach((actor: any) => {
          renderer.removeActor(actor)
        })
      }
      if (fullScreenRenderWindow) {
        fullScreenRenderWindow.delete?.()
      }
      // Clear references
      vtkObjectsRef.current = {}
    }
  }, [])

  // Load STL file - exact pattern from reference
  const loadSTLFile = async (file: File) => {
    if (!vtkReady || !vtkModulesRef.current || !vtkObjectsRef.current.renderer || !vtkObjectsRef.current.renderWindow) {
      setError("VTK not ready yet, please wait a moment and try again.")
      return
    }

    try {
      setIsLoading(true)
      setError("")
      console.log(`Loading STL file: ${file.name}`)

      const { vtkSTLReader, vtkActor, vtkMapper } = vtkModulesRef.current
      const { renderer, renderWindow, currentActor } = vtkObjectsRef.current

      // Parse file
      const arrayBuffer = await file.arrayBuffer()
      console.log(`File size: ${arrayBuffer.byteLength} bytes`)
      
      const reader = vtkSTLReader.newInstance()
      reader.parseAsArrayBuffer(arrayBuffer)
      const polyData = reader.getOutputData()

      // Check if polyData is valid
      if (!polyData || polyData.getNumberOfPoints() === 0) {
        throw new Error("Invalid STL file: No geometry data found")
      }
      
      // Check for embedded color data that might override our material colors
      console.log('STL Data Analysis:', {
        numberOfPoints: polyData.getNumberOfPoints(),
        numberOfCells: polyData.getNumberOfCells(),
        hasPointData: !!polyData.getPointData(),
        hasCellData: !!polyData.getCellData(),
        pointDataArrays: polyData.getPointData() ? polyData.getPointData().getNumberOfArrays() : 0,
        cellDataArrays: polyData.getCellData() ? polyData.getCellData().getNumberOfArrays() : 0
      })
      
      // Remove any color arrays that might override our material
      if (polyData.getPointData() && polyData.getPointData().getNumberOfArrays() > 0) {
        const pointData = polyData.getPointData()
        for (let i = pointData.getNumberOfArrays() - 1; i >= 0; i--) {
          const arrayName = pointData.getArrayName(i)
          console.log('Removing point data array:', arrayName)
          pointData.removeArray(i)
        }
      }
      
      if (polyData.getCellData() && polyData.getCellData().getNumberOfArrays() > 0) {
        const cellData = polyData.getCellData()
        for (let i = cellData.getNumberOfArrays() - 1; i >= 0; i--) {
          const arrayName = cellData.getArrayName(i)
          console.log('Removing cell data array:', arrayName)
          cellData.removeArray(i)
        }
      }

      // Build pipeline
      const mapper = vtkMapper.newInstance()
      mapper.setInputData(polyData)

      const actor = vtkActor.newInstance()
      actor.setMapper(mapper)
      
      // Set material properties - FORCE override any VTK defaults
      const property = actor.getProperty()
      const rgb = hexToRgb(currentColor)
      console.log('Initial STL load - setting color:', { currentColor, rgb })
      console.log('Current color state:', currentColor)
      console.log('Computed RGB values:', rgb)
      
      // AGGRESSIVE color setting - try multiple approaches
      console.log('Setting color with multiple methods...')
      
      // Method 1: Standard VTK color setting with proper RGB values
      console.log('Applying calculated RGB color:', rgb)
      
      property.setColor(rgb.r, rgb.g, rgb.b)
      property.setDiffuseColor(rgb.r, rgb.g, rgb.b)
      property.setAmbientColor(rgb.r, rgb.g, rgb.b)
      property.setSpecularColor(1, 1, 1) // White specular highlights
      
      console.log('Color applied:', rgb)
      
      // Method 2: Natural lighting ratios while preserving color accuracy
      // Balance between color accuracy and realistic lighting
      property.setAmbient(0.4)   // Moderate ambient for shadow detail
      property.setDiffuse(0.8)   // Strong diffuse for color visibility
      property.setSpecular(0.3)  // Natural specular highlights
      property.setSpecularPower(20) // Softer specular
      property.setOpacity(1.0)
      
      // Method 3: Force specific rendering modes
      property.setLighting(true)
      property.setInterpolationToPhong()
      
      // Method 4: FORCE override any embedded colors in STL
      if (property.setColorModeToUniform) {
        property.setColorModeToUniform()
        console.log('Set color mode to uniform')
      }
      
      // Method 5: Try disabling scalar visibility that might override colors
      if (mapper.setScalarVisibility) {
        mapper.setScalarVisibility(false)
        console.log('Disabled scalar visibility on mapper')
      }

      property.modified()
      actor.modified()

      // Replace previous actor
      if (currentActor && renderer) {
        console.log('Removing previous actor')
        renderer.removeActor(currentActor)
      }

      console.log('Adding new actor to renderer')
      renderer.addActor(actor)
      renderer.resetCamera()

      vtkObjectsRef.current.currentActor = actor
      renderWindow.render()

      console.log("✓ STL loaded successfully with color:", currentColor)
      onFileLoad?.(file.name)
      setIsLoading(false)
    } catch (err) {
      console.error("STL loading error:", err)
      const errorMessage = `Failed to load STL file: ${err instanceof Error ? err.message : 'Unknown error'}`
      setError(errorMessage)
      setIsLoading(false)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Handle file selection
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.name.toLowerCase().endsWith('.stl')) {
      setError("Please select a valid .stl file")
      return
    }
    await loadSTLFile(file)
  }

  // Handle color change
  const handleColorChange = (color: string) => {
    if (vtkObjectsRef.current.currentActor && vtkReady) {
      const property = vtkObjectsRef.current.currentActor.getProperty()
      const rgb = hexToRgb(color)

      property.setColor(rgb.r, rgb.g, rgb.b)
      property.setDiffuseColor(rgb.r, rgb.g, rgb.b)
      property.setAmbientColor(rgb.r, rgb.g, rgb.b)

      property.modified()
      vtkObjectsRef.current.renderWindow?.render()
    }
    onColorChange?.(color)
  }

  // Reset camera view
  const resetCamera = () => {
    if (vtkObjectsRef.current.renderer && vtkObjectsRef.current.renderWindow) {
      vtkObjectsRef.current.renderer.resetCamera()
      vtkObjectsRef.current.renderWindow.render()
    }
  }

  // Export current STL
  const exportSTL = async () => {
    if (!vtkObjectsRef.current.currentActor || !fileName) return

    try {
      // Simple re-download approach for now
      // In full implementation, you'd extract polyData and convert to STL
      alert("Export functionality would be implemented here")
    } catch (error) {
      console.error("Failed to export STL:", error)
      setError("Failed to export STL file")
    }
  }

  // Test function to load a sample STL file
  const loadTestSTL = async () => {
    try {
      console.log("Loading test STL file...")
      const response = await fetch("/test-cube.stl")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: "application/octet-stream" })
      const file = new File([blob], "test-cube.stl", { type: "application/octet-stream" })
      
      await loadSTLFile(file)
    } catch (error) {
      console.error("Failed to load test STL:", error)
      setError(`Failed to load test STL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Expose functions for parent component
  React.useImperativeHandle(ref, () => ({
    importSTL: () => fileInputRef.current?.click(),
    exportSTL,
    resetCamera,
    loadSTLFile,
    loadTestSTL
  }))

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 3D Viewer Container */}
      <div className="flex-1 relative">
        <div
          ref={vtkContainerRef}
          className="absolute inset-0 bg-slate-900"
        />

        {/* Reset Camera Button - Top Right Corner */}
        {vtkObjectsRef.current.currentActor && (
          <Button
            onClick={resetCamera}
            size="sm"
            variant="outline"
            className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}

        {/* Test STL Button - Top Left Corner (temporary for debugging) */}
        {vtkReady && !isLoading && (
          <Button
            onClick={loadTestSTL}
            size="sm"
            variant="outline"
            className="absolute top-4 left-4 z-10 bg-background/80 backdrop-blur-sm"
          >
            Load Test STL
          </Button>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
            <div className="bg-background p-4 rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm">
                {!vtkReady ? "Initializing VTK.js..." : "Loading STL file..."}
              </p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute top-4 left-4 right-20 z-10">
            <div className="bg-destructive/90 text-destructive-foreground p-3 rounded-lg shadow-lg">
              <div className="font-medium text-sm">Error:</div>
              <div className="text-xs mt-1">{error}</div>
              <Button
                onClick={() => setError("")}
                size="sm"
                variant="outline"
                className="mt-2 text-xs"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* VTK not ready state */}
        {!vtkReady && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background p-8 rounded-lg shadow-lg text-center">
              <p className="text-muted-foreground">
                VTK.js failed to initialize
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

VTKViewer.displayName = "VTKViewer"

// Export the ref type for parent components
export type VTKViewerRef = {
  importSTL: () => void
  exportSTL: () => void
  resetCamera: () => void
  loadSTLFile: (file: File) => Promise<void>
  loadTestSTL: () => Promise<void>
}