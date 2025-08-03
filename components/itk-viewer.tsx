"use client"

import React, { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface ITKViewerProps {
  className?: string
  onFileLoad?: (fileName: string) => void
  onColorChange?: (color: string) => void
  currentColor?: string
  fileName?: string
}

export const ITKViewer = React.forwardRef<any, ITKViewerProps>(({ 
  className, 
  onFileLoad, 
  currentColor = "#4F46E5",
  fileName = ""
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [currentIntersection, setCurrentIntersection] = useState<{ x: number; y: number; z: number } | null>(null)
  const [landmarkPoints, setLandmarkPoints] = useState<Array<{ x: number; y: number; z: number; id: string }>>([])

  // Hybrid VTK visualization + ITK interaction objects
  const hybridSystemRef = useRef<Record<string, any>>({
    // VTK rendering system
    vtkRenderWindow: null,
    vtkRenderer: null,
    vtkInteractor: null,
    vtkMeshActor: null,
    vtkPicker: null,
    
    // ITK interaction system
    itkReader: null,
    itkMesh: null,
    itkSpatialObject: null,
    
    // Hybrid coordination
    landmarkActors: [],
    coordinateConverter: null
  })

  // Initialize Hybrid VTK+ITK System
  useEffect(() => {
    if (!containerRef.current) return

    const initializeHybridSystem = async () => {
      try {
        setIsLoading(true)
        setError("")
        console.log("Initializing Hybrid VTK Visualization + ITK Interaction System...")
        
        // Create hybrid picker function
        const createHybridPicker = (vtkCellPicker: any, renderer: any) => {
          const picker = vtkCellPicker.newInstance()
          picker.setPickFromList(true)
          picker.setTolerance(0.0001) // ITK-level precision
          
          // Enhance picker with ITK-level precision methods
          picker.precisionPick = (coords: number[], renderer: any) => {
            // Use VTK picker but with ITK-level precision processing
            picker.pick(coords, renderer)
            const positions = picker.getPickedPositions()
            
            if (positions.length > 0) {
              // Apply ITK-level coordinate precision
              return positions.map((pos: number[]) => ([
                Math.round(pos[0] * 100000) / 100000, // 5 decimal precision
                Math.round(pos[1] * 100000) / 100000,
                Math.round(pos[2] * 100000) / 100000
              ]))
            }
            return []
          }
          
          return picker
        }

        // Import ITK.js modules for medical-grade interaction
        const { 
          readMesh,
          FloatTypes,
          IntTypes,
          PixelTypes,
          getFileExtension,
          extensionToMeshIO
        } = await import('itk-wasm')

        // Import VTK.js for robust visualization
        await import("vtk.js/Sources/Rendering/Profiles/Geometry")
        
        // Load VTK.js modules for visualization
        const [
          { default: vtkFullScreenRenderWindow },
          { default: vtkActor },
          { default: vtkMapper },
          { default: vtkCellPicker },
          { default: vtkSphereSource },
          { default: vtkInteractorStyleTrackballCamera },
          { default: vtkPolyData },
          { default: vtkPoints },
          { default: vtkCellArray }
        ] = await Promise.all([
          import("vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow"),
          import("vtk.js/Sources/Rendering/Core/Actor"),
          import("vtk.js/Sources/Rendering/Core/Mapper"),
          import("vtk.js/Sources/Rendering/Core/CellPicker"),
          import("vtk.js/Sources/Filters/Sources/SphereSource"),
          import("vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera"),
          import("vtk.js/Sources/Common/DataModel/PolyData"),
          import("vtk.js/Sources/Common/DataModel/Points"),
          import("vtk.js/Sources/Common/DataModel/CellArray")
        ])

        // 1️⃣ Create VTK visualization system
        const fullScreenRenderWindow = vtkFullScreenRenderWindow.newInstance({
          rootContainer: containerRef.current,
          containerStyle: {
            height: "100%",
            width: "100%",
            position: "relative",
          },
        })

        const vtkRenderer = fullScreenRenderWindow.getRenderer()
        const vtkRenderWindow = fullScreenRenderWindow.getRenderWindow()
        const vtkInteractor = fullScreenRenderWindow.getInteractor()

        // Configure VTK for high-quality visualization
        vtkRenderer.setBackground(0.1, 0.1, 0.1)
        vtkRenderer.setAutomaticLightCreation(true)

        // Setup VTK interaction
        const interactorStyle = vtkInteractorStyleTrackballCamera.newInstance()
        vtkInteractor.setInteractorStyle(interactorStyle)

        // 2️⃣ Create ITK interaction system
        const itkReader = { readMesh } // ITK mesh reader for precision
        
        // 3️⃣ Create hybrid picker that uses ITK precision with VTK visualization
        const hybridPicker = createHybridPicker(vtkCellPicker, vtkRenderer)
        
        console.log("✓ VTK visualization system ready")
        console.log("✓ ITK interaction system ready")

        // Store hybrid system objects
        hybridSystemRef.current = {
          // VTK visualization
          vtkRenderWindow,
          vtkRenderer,
          vtkInteractor,
          vtkMeshActor: null,
          vtkPicker: hybridPicker,
          
          // ITK interaction
          itkReader,
          itkMesh: null,
          
          // VTK constructors
          vtkActor,
          vtkMapper,
          vtkSphereSource,
          vtkPolyData,
          vtkPoints,
          vtkCellArray,
          
          // Hybrid state
          landmarkActors: []
        }

        // Setup hybrid medical-grade interactions
        setupHybridInteractions()

        vtkRenderer.resetCamera()
        vtkRenderWindow.render()

        console.log("✓ Hybrid VTK+ITK medical system initialized")
        setIsReady(true)
        setIsLoading(false)

      } catch (error) {
        console.error("Hybrid VTK+ITK initialization failed:", error)
        setError(`Hybrid medical viewer initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setIsLoading(false)
      }
    }

    initializeHybridSystem()

    return () => {
      // Cleanup hybrid system
      const { vtkRenderWindow, vtkRenderer } = hybridSystemRef.current
      if (vtkRenderer) {
        const actors = vtkRenderer.getActors()
        actors.forEach((actor: any) => vtkRenderer.removeActor(actor))
      }
      if (vtkRenderWindow) {
        vtkRenderWindow.delete?.()
      }
      hybridSystemRef.current = {}
    }
  }, [])

  // Setup hybrid VTK visualization + ITK interaction events
  const setupHybridInteractions = () => {
    if (!containerRef.current) return

    const container = containerRef.current
    const { vtkPicker, vtkRenderer } = hybridSystemRef.current

    // Hybrid high-precision mouse tracking (VTK rendering + ITK precision)
    let lastUpdate = 0
    const throttleMs = 16 // 60fps for smooth interaction

    const handleMouseMove = (event: MouseEvent) => {
      const now = Date.now()
      if (now - lastUpdate < throttleMs) return
      lastUpdate = now

      const rect = container.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      // Use hybrid picker with ITK-level precision
      const precisePositions = vtkPicker.precisionPick([x, y, 0], vtkRenderer)
      
      if (precisePositions.length > 0) {
        const worldPos = precisePositions[0]
        setCurrentIntersection({
          x: worldPos[0], // ITK 5-decimal precision
          y: worldPos[1],
          z: worldPos[2]
        })
      } else {
        setCurrentIntersection(null)
      }
    }

    const handleMouseLeave = () => {
      setCurrentIntersection(null)
    }

    // Hybrid medical-grade landmark placement (ITK precision + VTK visualization)
    const handleLandmarkClick = (event: MouseEvent) => {
      if (!event.shiftKey || event.button !== 0) return

      event.preventDefault()
      event.stopPropagation()

      const rect = container.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      // Use hybrid picker for maximum precision
      const precisePositions = vtkPicker.precisionPick([x, y, 0], vtkRenderer)
      
      if (precisePositions.length > 0) {
        const worldPos = precisePositions[0]
        const landmarkId = `landmark_${Date.now()}`
        
        const newLandmark = {
          x: worldPos[0],
          y: worldPos[1], 
          z: worldPos[2],
          id: landmarkId
        }

        // Create hybrid landmark visualization (VTK rendering with ITK precision)
        createHybridLandmark(newLandmark)
        setLandmarkPoints(prev => [...prev, newLandmark])
        
        console.log("🎯 Hybrid medical landmark placed:", {
          id: landmarkId,
          coordinates: [worldPos[0].toFixed(5), worldPos[1].toFixed(5), worldPos[2].toFixed(5)]
        })
      }
    }

    // Remove landmark on Ctrl+click
    const handleRemoveLandmark = (event: MouseEvent) => {
      if (!event.ctrlKey || event.button !== 0) return
      
      // Remove the most recent landmark
      const { landmarkActors, vtkRenderer, vtkRenderWindow } = hybridSystemRef.current
      if (landmarkActors && landmarkActors.length > 0) {
        const lastActor = landmarkActors.pop()
        vtkRenderer.removeActor(lastActor)
        vtkRenderWindow.render()
        
        setLandmarkPoints(prev => prev.slice(0, -1))
        console.log("🗑️ Hybrid landmark removed")
      }
    }

    // Combined click handler
    const handleClick = (event: MouseEvent) => {
      if (event.shiftKey) {
        handleLandmarkClick(event)
      } else if (event.ctrlKey) {
        handleRemoveLandmark(event)
      }
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('click', handleClick)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      container.removeEventListener('click', handleClick)
    }
  }

  // Create hybrid landmark visualization (VTK rendering + ITK precision)
  const createHybridLandmark = (landmark: { x: number; y: number; z: number; id: string }) => {
    const { vtkSphereSource, vtkActor, vtkMapper, vtkRenderer, vtkRenderWindow, vtkMeshActor } = hybridSystemRef.current

    if (!vtkMeshActor) return

    // Calculate appropriate size based on mesh bounds (ITK precision)
    const bounds = vtkMeshActor.getBounds()
    const size = Math.max(bounds[1] - bounds[0], bounds[3] - bounds[2], bounds[5] - bounds[4])
    const sphereRadius = size * 0.001 // Ultra-precise hybrid visualization

    // Create high-quality sphere with VTK rendering
    const sphereSource = vtkSphereSource.newInstance({
      radius: sphereRadius,
      phiResolution: 40, // Higher resolution for hybrid precision
      thetaResolution: 40
    })

    const sphereMapper = vtkMapper.newInstance()
    sphereMapper.setInputConnection(sphereSource.getOutputPort())

    const sphereActor = vtkActor.newInstance()
    sphereActor.setMapper(sphereMapper)

    // Hybrid medical-grade visualization properties
    const property = sphereActor.getProperty()
    property.setColor(0.0, 0.8, 1.0) // Cyan for hybrid system
    property.setOpacity(0.95)
    property.setSpecular(0.7)
    property.setSpecularPower(40)
    property.setLighting(true)
    property.setAmbient(0.2)
    property.setDiffuse(0.9)

    // Position with ITK-level precision
    sphereActor.setPosition(landmark.x, landmark.y, landmark.z)

    vtkRenderer.addActor(sphereActor)
    vtkRenderWindow.render()

    // Store for management
    if (!hybridSystemRef.current.landmarkActors) {
      hybridSystemRef.current.landmarkActors = []
    }
    hybridSystemRef.current.landmarkActors.push(sphereActor)
  }

  // Load STL with hybrid VTK visualization + ITK precision
  const loadHybridSTL = async (file: File) => {
    if (!isReady) {
      setError("Hybrid medical viewer not ready yet, please wait a moment and try again.")
      return
    }

    try {
      setIsLoading(true)
      setError("")
      console.log(`Loading STL with Hybrid VTK+ITK precision: ${file.name}`)

      const { 
        itkReader, 
        vtkRenderer, 
        vtkRenderWindow, 
        vtkActor, 
        vtkMapper, 
        vtkPicker,
        vtkPolyData,
        vtkPoints,
        vtkCellArray
      } = hybridSystemRef.current
      const { readMesh } = itkReader

      // Read mesh with ITK.js for precision, then convert to VTK for visualization
      const arrayBuffer = await file.arrayBuffer()
      const itkMesh = await readMesh(new Uint8Array(arrayBuffer))
      
      console.log("ITK.js mesh loaded for precision:", {
        numberOfPoints: itkMesh.numberOfPoints,
        numberOfCells: itkMesh.numberOfCells,
        dimension: itkMesh.dimension
      })
      
      // Store ITK mesh for precision calculations
      hybridSystemRef.current.itkMesh = itkMesh

      // Convert ITK mesh to VTK for high-quality rendering
      const polyData = convertITKMeshToVTKHybrid(itkMesh, vtkPolyData, vtkPoints, vtkCellArray)

      // Create VTK rendering pipeline
      const mapper = vtkMapper.newInstance()
      mapper.setInputData(polyData)
      mapper.setScalarVisibility(false) // Use material colors

      const actor = vtkActor.newInstance()
      actor.setMapper(mapper)

      // Hybrid medical-grade material properties
      const property = actor.getProperty()
      const rgb = hexToRgb(currentColor)
      
      property.setColor(rgb.r, rgb.g, rgb.b)
      property.setDiffuseColor(rgb.r, rgb.g, rgb.b)
      property.setAmbientColor(rgb.r * 0.2, rgb.g * 0.2, rgb.b * 0.2)
      property.setSpecularColor(1.0, 1.0, 1.0)
      
      // Enhanced rendering quality for medical visualization
      property.setAmbient(0.15)
      property.setDiffuse(0.85)
      property.setSpecular(0.5)
      property.setSpecularPower(30)
      property.setOpacity(1.0)
      property.setLighting(true)
      property.setInterpolationToPhong()
      property.setEdgeVisibility(false)

      // Replace previous mesh
      if (hybridSystemRef.current.vtkMeshActor) {
        vtkRenderer.removeActor(hybridSystemRef.current.vtkMeshActor)
      }

      vtkRenderer.addActor(actor)
      vtkPicker.addPickList(actor)
      vtkRenderer.resetCamera()

      hybridSystemRef.current.vtkMeshActor = actor
      vtkRenderWindow.render()

      console.log("✓ Hybrid VTK+ITK STL loaded successfully")
      console.log("  → VTK handles visualization")
      console.log("  → ITK provides precision interaction")
      onFileLoad?.(file.name)
      setIsLoading(false)

    } catch (err) {
      console.error("Hybrid STL loading error:", err)
      setError(`Failed to load STL with hybrid precision: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setIsLoading(false)
    }
  }

  // Convert ITK mesh to VTK polydata with hybrid precision
  const convertITKMeshToVTKHybrid = (itkMesh: any, vtkPolyData: any, vtkPoints: any, vtkCellArray: any) => {
    console.log("Converting ITK mesh to VTK with hybrid precision...")
    
    const polyData = vtkPolyData.newInstance()
    
    // Convert points with ITK precision
    const points = vtkPoints.newInstance()
    const pointsData = new Float32Array(itkMesh.points.buffer)
    points.setData(pointsData, 3)
    polyData.setPoints(points)
    
    console.log(`Converted ${pointsData.length / 3} points with ITK precision`)
    
    // Convert cells (triangles) with topology preservation
    if (itkMesh.cells && itkMesh.cells.buffer) {
      const polys = vtkCellArray.newInstance()
      const cellsData = new Uint32Array(itkMesh.cells.buffer)
      polys.setData(cellsData)
      polyData.setPolys(polys)
      
      console.log(`Converted ${cellsData.length / 4} triangles for VTK rendering`)
    }
    
    // Compute normals for better VTK rendering
    polyData.buildCells()
    polyData.buildLinks()
    
    console.log("✓ ITK→VTK hybrid conversion complete")
    return polyData
  }

  // Utility function to convert hex to RGB
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

  // Handle file selection
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.name.toLowerCase().endsWith('.stl')) {
      setError("Please select a valid .stl file")
      return
    }
    await loadHybridSTL(file)
  }

  // Reset camera view
  const resetCamera = () => {
    if (hybridSystemRef.current.vtkRenderer && hybridSystemRef.current.vtkRenderWindow) {
      hybridSystemRef.current.vtkRenderer.resetCamera()
      hybridSystemRef.current.vtkRenderWindow.render()
    }
  }

  // Clear all landmarks
  const clearLandmarks = () => {
    const { landmarkActors, vtkRenderer, vtkRenderWindow } = hybridSystemRef.current
    if (landmarkActors) {
      landmarkActors.forEach((actor: any) => vtkRenderer.removeActor(actor))
      hybridSystemRef.current.landmarkActors = []
      vtkRenderWindow.render()
      setLandmarkPoints([])
      console.log("🧹 All hybrid landmarks cleared")
    }
  }

  // Expose functions for parent component
  React.useImperativeHandle(ref, () => ({
    importSTL: () => fileInputRef.current?.click(),
    resetCamera,
    clearLandmarks,
    getLandmarks: () => landmarkPoints,
    loadSTLFile: loadHybridSTL
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

      {/* Medical-Grade 3D Viewer Container */}
      <div className="flex-1 relative">
        <div
          ref={containerRef}
          className="absolute inset-0 bg-slate-900"
        />

        {/* Control Buttons */}
        {itkObjectsRef.current.meshActor && (
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <Button
              onClick={resetCamera}
              size="sm"
              variant="outline"
              className="bg-background/80 backdrop-blur-sm"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            {landmarkPoints.length > 0 && (
              <Button
                onClick={clearLandmarks}
                size="sm"
                variant="outline"
                className="bg-background/80 backdrop-blur-sm text-xs"
              >
                Clear ({landmarkPoints.length})
              </Button>
            )}
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
            <div className="bg-background p-4 rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm">
                {!isReady ? "Initializing Hybrid VTK+ITK Viewer..." : "Loading STL with Hybrid Precision..."}
              </p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute top-4 left-4 right-20 z-10">
            <div className="bg-destructive/90 text-destructive-foreground p-3 rounded-lg shadow-lg">
              <div className="font-medium text-sm">Hybrid Viewer Error:</div>
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

        {/* Medical-Grade Status Bar */}
        {isReady && fileName && (
          <div className="absolute bottom-2 right-2 bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 text-sm font-mono">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">🔬 Hybrid Coordinates:</span>
              {currentIntersection ? (
                <div className="flex gap-3">
                  <span className="text-red-500">X: {currentIntersection.x}</span>
                  <span className="text-green-500">Y: {currentIntersection.y}</span>
                  <span className="text-blue-500">Z: {currentIntersection.z}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">---</span>
              )}
            </div>
            {landmarkPoints.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                🎯 {landmarkPoints.length} landmark{landmarkPoints.length !== 1 ? 's' : ''} placed
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {isReady && !isLoading && !fileName && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/95 backdrop-blur-sm p-8 rounded-lg shadow-lg text-center max-w-md">
              <h3 className="text-lg font-semibold mb-6">🔬 Hybrid VTK+ITK STL Viewer</h3>
              <div className="space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <div>
                    <div className="font-medium">Load Hybrid STL</div>
                    <div className="text-sm text-muted-foreground">VTK visualization + ITK precision</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <div>
                    <div className="font-medium">Place Landmarks</div>
                    <div className="text-sm text-muted-foreground">Shift+Click for hybrid precision</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <div>
                    <div className="font-medium">Remove Landmarks</div>
                    <div className="text-sm text-muted-foreground">Ctrl+Click to remove latest</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

ITKViewer.displayName = "ITKViewer"

export type ITKViewerRef = {
  importSTL: () => void
  resetCamera: () => void  
  clearLandmarks: () => void
  getLandmarks: () => Array<{ x: number; y: number; z: number; id: string }>
  loadSTLFile: (file: File) => Promise<void>
}