"use client"

import React, { useRef, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Download, RotateCcw, Palette } from "lucide-react"
import { cn } from "@/lib/utils"

interface VTKViewerProps {
  className?: string
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
    : { r: 0.8, g: 0.8, b: 0.8 }
}

export function VTKViewer({ className }: VTKViewerProps) {
  const vtkContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isVTKLoaded, setIsVTKLoaded] = useState(false)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [currentColor, setCurrentColor] = useState("#4F46E5")
  const [isLoading, setIsLoading] = useState(false)

  // VTK objects refs
  const fullScreenRenderWindowRef = useRef<any>(null)
  const rendererRef = useRef<any>(null)
  const renderWindowRef = useRef<any>(null)
  const currentActorRef = useRef<any>(null)

  // Initialize VTK.js
  useEffect(() => {
    const initializeVTK = async () => {
      if (typeof window === "undefined" || !vtkContainerRef.current) return

      try {
        setIsLoading(true)

        // Load VTK.js geometry profile first (critical!)
        await import("vtk.js/Sources/Rendering/Profiles/Geometry")

        // Load required VTK modules
        const [
          { default: vtkFullScreenRenderWindow },
          { default: vtkInteractorStyleTrackballCamera },
        ] = await Promise.all([
          import("vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow"),
          import("vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera"),
        ])

        // Create render window
        const fullScreenRenderWindow = vtkFullScreenRenderWindow.newInstance({
          rootContainer: vtkContainerRef.current,
          containerStyle: { 
            height: "100%", 
            width: "100%", 
            position: "relative",
            overflow: "hidden"
          }
        })

        // Setup renderer and interaction
        const renderer = fullScreenRenderWindow.getRenderer()
        const renderWindow = fullScreenRenderWindow.getRenderWindow()
        
        // Set dark background for better contrast
        renderer.setBackground(0.1, 0.1, 0.1)
        renderer.setAutomaticLightCreation(true)

        // Setup trackball camera interaction
        const interactor = fullScreenRenderWindow.getInteractor()
        const interactorStyle = vtkInteractorStyleTrackballCamera.newInstance()
        interactor.setInteractorStyle(interactorStyle)

        // Store refs
        fullScreenRenderWindowRef.current = fullScreenRenderWindow
        rendererRef.current = renderer
        renderWindowRef.current = renderWindow

        setIsVTKLoaded(true)
        setIsLoading(false)
      } catch (error) {
        console.error("Failed to initialize VTK.js:", error)
        setIsLoading(false)
      }
    }

    initializeVTK()

    // Cleanup on unmount
    return () => {
      if (fullScreenRenderWindowRef.current) {
        fullScreenRenderWindowRef.current.delete()
        fullScreenRenderWindowRef.current = null
      }
    }
  }, [])

  // Load STL file
  const loadSTLFile = async (file: File) => {
    if (!isVTKLoaded || !rendererRef.current) return

    try {
      setIsLoading(true)

      // Load VTK STL reader and related modules
      const [
        { default: vtkSTLReader },
        { default: vtkActor },
        { default: vtkMapper },
      ] = await Promise.all([
        import("vtk.js/Sources/IO/Geometry/STLReader"),
        import("vtk.js/Sources/Rendering/Core/Actor"),
        import("vtk.js/Sources/Rendering/Core/Mapper"),
      ])

      // Read file
      const arrayBuffer = await file.arrayBuffer()
      const reader = vtkSTLReader.newInstance()
      reader.parseAsArrayBuffer(arrayBuffer)
      const polyData = reader.getOutputData()

      // Remove previous actor if exists
      if (currentActorRef.current) {
        rendererRef.current.removeActor(currentActorRef.current)
      }

      // Create visualization pipeline
      const mapper = vtkMapper.newInstance()
      mapper.setInputData(polyData)
      
      const actor = vtkActor.newInstance()
      actor.setMapper(mapper)

      // Set material properties
      const property = actor.getProperty()
      const rgb = hexToRgb(currentColor)
      
      property.setColor(rgb.r, rgb.g, rgb.b)
      property.setDiffuseColor(rgb.r, rgb.g, rgb.b)
      property.setAmbientColor(rgb.r, rgb.g, rgb.b)
      property.setSpecularColor(1, 1, 1)
      
      // Lighting coefficients for better appearance
      property.setAmbient(0.4)
      property.setDiffuse(0.8)
      property.setSpecular(0.3)
      property.setSpecularPower(20)

      // Add to renderer
      rendererRef.current.addActor(actor)
      currentActorRef.current = actor

      // Reset camera to fit the model
      rendererRef.current.resetCamera()
      renderWindowRef.current.render()

      setCurrentFile(file)
      setIsLoading(false)
    } catch (error) {
      console.error("Failed to load STL file:", error)
      setIsLoading(false)
    }
  }

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.name.toLowerCase().endsWith('.stl')) {
      loadSTLFile(file)
    }
  }

  // Handle color change
  const handleColorChange = (color: string) => {
    setCurrentColor(color)
    
    if (currentActorRef.current && isVTKLoaded) {
      const property = currentActorRef.current.getProperty()
      const rgb = hexToRgb(color)
      
      property.setColor(rgb.r, rgb.g, rgb.b)
      property.setDiffuseColor(rgb.r, rgb.g, rgb.b)
      property.setAmbientColor(rgb.r, rgb.g, rgb.b)
      
      renderWindowRef.current?.render()
    }
  }

  // Reset camera view
  const resetCamera = () => {
    if (rendererRef.current && renderWindowRef.current) {
      rendererRef.current.resetCamera()
      renderWindowRef.current.render()
    }
  }

  // Export current STL
  const exportSTL = async () => {
    if (!currentActorRef.current || !currentFile) return

    try {
      // For now, we'll re-download the original file
      // In a full implementation, you'd extract the polyData and convert to STL format
      const url = URL.createObjectURL(currentFile)
      const a = document.createElement('a')
      a.href = url
      a.download = `exported_${currentFile.name}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to export STL:", error)
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Controls Header */}
      <div className="flex items-center gap-4 p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".stl"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            size="sm"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import STL
          </Button>
          
          <Button
            onClick={exportSTL}
            disabled={!currentFile || isLoading}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export STL
          </Button>
          
          <Button
            onClick={resetCamera}
            disabled={!currentFile || isLoading}
            variant="outline"
            size="sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset View
          </Button>
        </div>

        {/* Color Picker */}
        <div className="flex items-center gap-2 ml-auto">
          <Label htmlFor="color-picker" className="text-sm">Color:</Label>
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            <Input
              id="color-picker"
              type="color"
              value={currentColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-12 h-8 p-1 border rounded cursor-pointer"
              disabled={!currentFile || isLoading}
            />
          </div>
        </div>

        {/* File Info */}
        {currentFile && (
          <div className="text-sm text-muted-foreground">
            {currentFile.name} ({(currentFile.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}
      </div>

      {/* 3D Viewer */}
      <div className="flex-1 relative">
        <div
          ref={vtkContainerRef}
          className="absolute inset-0 bg-slate-900"
        />
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-background p-4 rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm">Loading VTK.js...</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!currentFile && !isLoading && isVTKLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Card className="p-8 text-center">
              <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No STL File Loaded</h3>
              <p className="text-muted-foreground mb-4">
                Click "Import STL" to load a 3D model
              </p>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Import STL File
              </Button>
            </Card>
          </div>
        )}

        {/* VTK not loaded state */}
        {!isVTKLoaded && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Failed to initialize 3D viewer
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}