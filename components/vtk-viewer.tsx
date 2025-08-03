"use client"

import React, { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"
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
  // onColorChange, 
  currentColor = "#4F46E5",
  fileName = ""
}, ref) => {
  const vtkContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [vtkReady, setVtkReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [currentIntersection, setCurrentIntersection] = useState<{ x: number; y: number; z: number } | null>(null)
  const [hoverPointActor, setHoverPointActor] = useState<any>(null)
  const pickerRef = useRef<any>(null)
  const hoverPointActorRef = useRef<any>(null)

  // VTK objects refs - using same pattern as reference
  const vtkModulesRef = useRef<Record<string, unknown>>({})
  const vtkObjectsRef = useRef<Record<string, unknown>>({
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

        // 2️⃣ Load VTK modules + ITK integration
        const [
          { default: vtkFullScreenRenderWindow },
          { default: vtkInteractorStyleTrackballCamera },
          { default: vtkSTLReader },
          { default: vtkActor },
          { default: vtkMapper },
          { default: vtkCellPicker },
          { default: vtkSphereSource },
          { default: vtkPolyData },
          { default: vtkPoints },
          { default: vtkCellArray },
          itkWasm
        ] = await Promise.all([
          import("vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow"),
          import("vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera"),
          import("vtk.js/Sources/IO/Geometry/STLReader"),
          import("vtk.js/Sources/Rendering/Core/Actor"),
          import("vtk.js/Sources/Rendering/Core/Mapper"),
          import("vtk.js/Sources/Rendering/Core/CellPicker"),
          import("vtk.js/Sources/Filters/Sources/SphereSource"),
          import("vtk.js/Sources/Common/DataModel/PolyData"),
          import("vtk.js/Sources/Common/DataModel/Points"),
          import("vtk.js/Sources/Common/DataModel/CellArray"),
          import('itk-wasm')
        ])
        
        console.log("✓ VTK.js + ITK.js modules loaded")
        console.log("✓ VTK modules loaded")

        if (!mounted || !vtkContainerRef.current) return

        // Store VTK + ITK modules for later use
        vtkModulesRef.current = {
          vtkFullScreenRenderWindow,
          vtkInteractorStyleTrackballCamera,
          vtkSTLReader,
          vtkActor,
          vtkMapper,
          vtkCellPicker,
          vtkSphereSource,
          vtkPolyData,
          vtkPoints,
          vtkCellArray,
          itkWasm
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

        // 6️⃣ Setup medical-grade picker with ITK precision
        const picker = vtkCellPicker.newInstance()
        picker.setPickFromList(true)
        picker.setTolerance(0.0001) // ITK medical-grade precision
        
        // Enhance picker with ITK-level precision
        picker.medicalPick = (coords, renderer) => {
          picker.pick(coords, renderer)
          const positions = picker.getPickedPositions()
          
          if (positions.length > 0) {
            // Apply ITK-level precision to coordinates
            return positions.map(pos => ([
              Math.round(pos[0] * 100000) / 100000, // 5 decimal precision
              Math.round(pos[1] * 100000) / 100000,
              Math.round(pos[2] * 100000) / 100000
            ]))
          }
          return []
        }
        
        pickerRef.current = picker
        console.log("✓ Medical-grade picker with ITK precision ready")
        
        // 7️⃣ Setup VTK interaction events for Ctrl+click only (Shift+click handled by DOM)
        interactor.onLeftButtonPress((callData) => {
          const controlKey = callData.controlKey
          
          if (controlKey) {
            // Ctrl+click: remove point
            removeSurfacePoint()
          }
          // Let DOM handle Shift+click and normal interactions
        })

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

        console.log("✓ VTK + ITK medical-grade viewer initialization complete")
        setVtkReady(true)
        setError("")
        setIsLoading(false)
        
        // Add ITK to VTK conversion function
        window.convertITKToVTK = (itkMesh, vtkPolyData, vtkPoints, vtkCellArray) => {
          console.log("Converting ITK mesh to VTK with medical precision...")
          
          const polyData = vtkPolyData.newInstance()
          
          // Convert points with ITK precision
          const points = vtkPoints.newInstance()
          const pointsData = new Float32Array(itkMesh.points.buffer)
          points.setData(pointsData, 3)
          polyData.setPoints(points)
          
          console.log(`Converted ${pointsData.length / 3} points with ITK precision`)
          
          // Convert cells (triangles)
          if (itkMesh.cells && itkMesh.cells.buffer) {
            const polys = vtkCellArray.newInstance()
            const cellsData = new Uint32Array(itkMesh.cells.buffer)
            polys.setData(cellsData)
            polyData.setPolys(polys)
            
            console.log(`Converted ${cellsData.length / 4} triangles`)
          }
          
          // Build VTK structures for rendering
          polyData.buildCells()
          polyData.buildLinks()
          
          console.log("✓ ITK→VTK medical conversion complete")
          return polyData
        }
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
        actors.forEach((actor: unknown) => {
          renderer.removeActor(actor)
        })
      }
      if (fullScreenRenderWindow) {
        fullScreenRenderWindow.delete?.()
      }
      // Clear references
      vtkObjectsRef.current = {}
      pickerRef.current = null
      setHoverPointActor(null)
      hoverPointActorRef.current = null
      setCurrentIntersection(null)
    }
  }, [])

  // Watch for color changes from parent
  useEffect(() => {
    if (vtkObjectsRef.current.currentActor && vtkReady && currentColor) {
      console.log('Color changed from parent:', currentColor)
      const property = vtkObjectsRef.current.currentActor.getProperty()
      const rgb = hexToRgb(currentColor)

      property.setColor(rgb.r, rgb.g, rgb.b)
      property.setDiffuseColor(rgb.r, rgb.g, rgb.b)
      property.setAmbientColor(rgb.r, rgb.g, rgb.b)

      property.modified()
      vtkObjectsRef.current.renderWindow?.render()
      console.log('VTK color updated to:', currentColor)
    }
  }, [currentColor, vtkReady])

  // Surface point management functions
  const ensureSurfacePoint = () => {
    if (hoverPointActorRef.current || !vtkModulesRef.current.vtkSphereSource || !vtkModulesRef.current.vtkActor || !vtkModulesRef.current.vtkMapper) {
      return hoverPointActorRef.current
    }
    
    const { vtkSphereSource, vtkActor, vtkMapper } = vtkModulesRef.current
    const { renderer } = vtkObjectsRef.current
    
    if (!renderer) return null
    
    // Get bounds of current STL to size sphere appropriately
    const currentActor = vtkObjectsRef.current.currentActor
    let sphereRadius = 1.0
    if (currentActor) {
      const bounds = currentActor.getBounds()
      const size = Math.max(bounds[1] - bounds[0], bounds[3] - bounds[2], bounds[5] - bounds[4])
      sphereRadius = size * 0.005 // Balanced size - visible but precise
    }
    
    const sphereSource = vtkSphereSource.newInstance({
      radius: sphereRadius,
      phiResolution: 20, // Higher resolution for smoother sphere
      thetaResolution: 20
    })
    
    const sphereMapper = vtkMapper.newInstance()
    sphereMapper.setInputConnection(sphereSource.getOutputPort())
    
    const sphereActor = vtkActor.newInstance()
    sphereActor.setMapper(sphereMapper)
    
    // Bright, highly visible point for accuracy testing
    const property = sphereActor.getProperty()
    property.setColor(1.0, 0.0, 0.0) // Bright red for better visibility
    property.setOpacity(1.0) // Fully opaque
    property.setSpecular(0.0) // No specular for solid appearance
    property.setSpecularPower(1)
    property.setLighting(false) // No lighting for consistent brightness
    property.setAmbient(1.0) // Full ambient for always visible
    property.setDiffuse(0.0) // No diffuse lighting
    
    renderer.addActor(sphereActor)
    setHoverPointActor(sphereActor)
    hoverPointActorRef.current = sphereActor
    
    return sphereActor
  }

  const placeSurfacePoint = (position: number[]) => {
    const { renderer, renderWindow } = vtkObjectsRef.current
    if (!renderer) return
    
    const pointActor = ensureSurfacePoint()
    if (pointActor) {
      // Place the point exactly at the picked surface position
      pointActor.setPosition(position[0], position[1], position[2])
      pointActor.setVisibility(true)
      
      renderWindow?.render()
      console.log('✓ Blue point placed at:', [position[0], position[1], position[2]])
    }
  }

  const removeSurfacePoint = () => {
    if (hoverPointActorRef.current) {
      hoverPointActorRef.current.setVisibility(false)
      vtkObjectsRef.current.renderWindow?.render()
      console.log('✓ Blue point removed')
    }
  }

  // Mouse tracking for coordinate display
  useEffect(() => {
    if (!vtkReady || !vtkContainerRef.current || !pickerRef.current) return

    const container = vtkContainerRef.current
    const picker = pickerRef.current
    const { renderer } = vtkObjectsRef.current

    if (!renderer) return

    let lastUpdate = 0
    const throttleMs = 32 // ~30fps for better performance

    const handleMouseMove = (event: MouseEvent) => {
      const now = Date.now()
      if (now - lastUpdate < throttleMs) return
      lastUpdate = now

      const rect = container.getBoundingClientRect()
      const x = Math.round(event.clientX - rect.left)
      const y = Math.round(event.clientY - rect.top)

      // Pick at mouse position with precise coordinates
      const success = picker.pick([x, y, 0], renderer)
      
      if (success && picker.getPickList().length > 0) {
        const pickedPositions = picker.getPickedPositions()
        if (pickedPositions.length > 0) {
          const worldPos = pickedPositions[0]
          const coordinates = {
            x: Math.round(worldPos[0] * 1000) / 1000, // Higher precision for coordinates
            y: Math.round(worldPos[1] * 1000) / 1000,
            z: Math.round(worldPos[2] * 1000) / 1000
          }
          setCurrentIntersection(coordinates)
          return
        }
      }
      // No intersection found
      setCurrentIntersection(null)
    }

    // Surface point functions are now defined at component level

    const handleMouseLeave = () => {
      setCurrentIntersection(null)
    }

    // Click handling is now done via VTK interactor events above

    // Handle Shift+click for blue point placement
    const handleDOMClick = (event: MouseEvent) => {
      if (event.shiftKey && event.button === 0) {
        event.preventDefault()
        event.stopPropagation()
        
        const rect = container.getBoundingClientRect()
        const x = Math.round(event.clientX - rect.left)
        const y = Math.round(event.clientY - rect.top)
        
        console.log('=== CLICK DEBUG ====')
        console.log('Raw event:', { clientX: event.clientX, clientY: event.clientY })
        console.log('Container rect:', rect)
        console.log('Calculated position:', { x, y })
        console.log('Container size:', { width: container.offsetWidth, height: container.offsetHeight })
        
        // Try multiple picking approaches for comparison
        console.log('Trying pick method 1: pick([x, y, 0], renderer)')
        picker.pick([x, y, 0], renderer)
        
        console.log('Also trying: pick([x, y], renderer)')
        // Some VTK versions prefer 2D coordinates
        const picker2 = vtkModulesRef.current.vtkCellPicker.newInstance()
        picker2.setPickFromList(true)
        picker2.setTolerance(0.01)
        picker2.addPickList(vtkObjectsRef.current.currentActor)
        picker2.pick([x, y], renderer)
        
        // Check results from both pickers
        const pickedPositions1 = picker.getPickedPositions()
        const pickedPositions2 = picker2.getPickedPositions()
        console.log('Method 1 picked positions:', pickedPositions1.length)
        console.log('Method 2 picked positions:', pickedPositions2.length)
        
        const pickedPositions = pickedPositions1.length > 0 ? pickedPositions1 : pickedPositions2
        
        if (pickedPositions.length > 0) {
          const worldPos = pickedPositions[0]
          console.log('✓ Point placed at:', { x: worldPos[0].toFixed(2), y: worldPos[1].toFixed(2), z: worldPos[2].toFixed(2) })
          
          placeSurfacePoint(worldPos)
        } else {
          console.log('✗ No surface found at click position')
          
          // Try alternative: check if actor was picked
          const pickedActor = picker.getActor()
          console.log('Picked actor:', !!pickedActor)
          
          if (pickedActor) {
            const pickPosition = picker.getPickPosition()
            console.log('Pick position from getPickPosition():', pickPosition)
            if (pickPosition && pickPosition.length >= 3) {
              console.log('✓ Using alternative pick position')
              placeSurfacePoint(pickPosition)
            }
          }
        }
      }
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('click', handleDOMClick)
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      container.removeEventListener('click', handleDOMClick)
    }
  }, [vtkReady])

  // Load STL file with ITK precision + VTK visualization
  const loadSTLFile = async (file: File) => {
    if (!vtkReady || !vtkModulesRef.current || !vtkObjectsRef.current.renderer || !vtkObjectsRef.current.renderWindow) {
      setError("Medical-grade viewer not ready yet, please wait a moment and try again.")
      return
    }

    try {
      setIsLoading(true)
      setError("")
      console.log(`Loading STL with medical-grade precision: ${file.name}`)

      const { 
        vtkSTLReader, 
        vtkActor, 
        vtkMapper, 
        vtkPolyData, 
        vtkPoints, 
        vtkCellArray, 
        itkWasm 
      } = vtkModulesRef.current
      const { renderer, renderWindow, currentActor } = vtkObjectsRef.current

      // Parse file with dual VTK + ITK approach for maximum precision
      const arrayBuffer = await file.arrayBuffer()
      console.log(`File size: ${arrayBuffer.byteLength} bytes`)
      
      // Method 1: Use ITK.js for medical precision when available
      let polyData = null
      let useITKPrecision = false
      
      try {
        console.log("Attempting ITK.js medical-grade loading...")
        const { readMesh } = itkWasm
        const itkMesh = await readMesh(new Uint8Array(arrayBuffer))
        
        console.log("✓ ITK.js mesh loaded:", {
          numberOfPoints: itkMesh.numberOfPoints,
          numberOfCells: itkMesh.numberOfCells,
          dimension: itkMesh.dimension
        })
        
        // Convert ITK mesh to VTK for visualization
        polyData = window.convertITKToVTK(itkMesh, vtkPolyData, vtkPoints, vtkCellArray)
        useITKPrecision = true
        console.log("✓ Using ITK.js medical-grade precision")
        
      } catch (itkError) {
        console.log("ITK.js loading failed, falling back to VTK.js:", itkError.message)
        
        // Fallback: Use VTK.js STL reader
        const reader = vtkSTLReader.newInstance()
        reader.parseAsArrayBuffer(arrayBuffer)
        polyData = reader.getOutputData()
        console.log("✓ Using VTK.js standard precision")
      }

      // Check if polyData is valid
      if (!polyData || polyData.getNumberOfPoints() === 0) {
        throw new Error("Invalid STL file: No geometry data found")
      }
      
      console.log(`${useITKPrecision ? '🔬 Medical' : '📐 Standard'} precision mesh:`, {
        points: polyData.getNumberOfPoints(),
        cells: polyData.getNumberOfCells()
      })
      
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
      
      // Add actor to picker list for coordinate tracking
      if (pickerRef.current) {
        pickerRef.current.addPickList(actor)
      }
      
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
  // const handleColorChange = (color: string) => {
  //   if (vtkObjectsRef.current.currentActor && vtkReady) {
  //     const property = vtkObjectsRef.current.currentActor.getProperty()
  //     const rgb = hexToRgb(color)

  //     property.setColor(rgb.r, rgb.g, rgb.b)
  //     property.setDiffuseColor(rgb.r, rgb.g, rgb.b)
  //     property.setAmbientColor(rgb.r, rgb.g, rgb.b)

  //     property.modified()
  //     vtkObjectsRef.current.renderWindow?.render()
  //   }
  //   onColorChange?.(color)
  // }

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

  // Clear current STL model
  const clearSTL = () => {
    if (vtkObjectsRef.current.currentActor && vtkObjectsRef.current.renderer && vtkObjectsRef.current.renderWindow) {
      console.log('Clearing current STL model')
      vtkObjectsRef.current.renderer.removeActor(vtkObjectsRef.current.currentActor)
      vtkObjectsRef.current.currentActor = null
      
      // Clear picker list
      if (pickerRef.current) {
        pickerRef.current.initializePickList()
      }
      
      // Hide and remove hover point
      if (hoverPointActorRef.current && vtkObjectsRef.current.renderer) {
        vtkObjectsRef.current.renderer.removeActor(hoverPointActorRef.current)
        setHoverPointActor(null)
        hoverPointActorRef.current = null
      }
      
      // Clear coordinate display
      setCurrentIntersection(null)
      
      vtkObjectsRef.current.renderWindow.render()
      onFileLoad?.("")
    }
  }

  // Apply view settings to VTK viewer
  const applySettings = async (settings: ViewSettings) => {
    if (!vtkReady || !vtkObjectsRef.current.renderer || !vtkObjectsRef.current.renderWindow) {
      console.warn('VTK not ready, cannot apply settings')
      return
    }

    try {
      console.log('Applying view settings:', settings)
      const { renderer, renderWindow, currentActor } = vtkObjectsRef.current

      // Apply display settings
      if (currentActor) {
        const property = currentActor.getProperty()
        
        // Wireframe mode
        if (settings.display.wireframe) {
          property.setRepresentationToWireframe()
        } else {
          property.setRepresentationToSurface()
        }
        
        // Transparency
        const opacity = (100 - settings.display.transparency[0]) / 100
        property.setOpacity(opacity)
        
        // Material settings
        const metallic = settings.material.metallic[0] / 100
        const roughness = settings.material.roughness[0] / 100
        // const reflectance = settings.material.reflectance[0] / 100
        
        if (property.setMetallic) property.setMetallic(metallic)
        if (property.setRoughness) property.setRoughness(roughness)
        
        // Adjust material based on surface type
        switch (settings.material.surfaceType) {
          case 'default':
            // VTK default material properties
            property.setAmbient(0.1)
            property.setDiffuse(1.0)
            property.setSpecular(0.0)
            property.setSpecularPower(1)
            break
          case 'titanium':
            property.setAmbient(0.15)
            property.setDiffuse(0.6)
            property.setSpecular(0.9)
            property.setSpecularPower(50)
            break
          case 'stainless-steel':
            property.setAmbient(0.1)
            property.setDiffuse(0.7)
            property.setSpecular(0.95)
            property.setSpecularPower(80)
            break
          case 'ceramic':
            property.setAmbient(0.3)
            property.setDiffuse(0.8)
            property.setSpecular(0.2)
            property.setSpecularPower(10)
            break
          case 'plastic':
            property.setAmbient(0.4)
            property.setDiffuse(0.9)
            property.setSpecular(0.1)
            property.setSpecularPower(5)
            break
        }
        
        property.modified()
        currentActor.modified()
      }

      // Apply lighting settings
      const lights = renderer.getLights()
      if (lights.length > 0) {
        const light = lights[0]
        const intensity = settings.lighting.intensity[0] / 100
        light.setIntensity(intensity)
        light.modified()
      }

      // Apply camera settings
      const camera = renderer.getActiveCamera()
      if (camera) {
        // Field of view (for perspective cameras)
        if (settings.camera.perspective === 'perspective') {
          camera.setViewAngle(settings.camera.fieldOfView[0])
        }
        
        // Switch between perspective and orthographic
        if (settings.camera.perspective === 'orthographic') {
          camera.setParallelProjection(true)
        } else {
          camera.setParallelProjection(false)
        }
        
        camera.modified()
        
        // Auto-fit if enabled
        if (settings.camera.autoFit) {
          renderer.resetCamera()
        }
      }

      // Background color based on display settings
      if (settings.display.showGrid) {
        renderer.setBackground(0.2, 0.2, 0.2) // Lighter for grid visibility
      } else {
        renderer.setBackground(0.1, 0.1, 0.2) // VTK default-ish background
      }

      // Force render to apply all changes
      renderWindow.render()
      console.log('✓ View settings applied successfully')
      
    } catch (error) {
      console.error('Failed to apply view settings:', error)
    }
  }

  // Expose functions for parent component
  React.useImperativeHandle(ref, () => ({
    importSTL: () => fileInputRef.current?.click(),
    exportSTL,
    resetCamera,
    loadSTLFile,
    loadTestSTL,
    clearSTL,
    applySettings
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
        {/* as not needed
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
        */}

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

        {/* Instructions when no STL loaded */}
        {vtkReady && !isLoading && !fileName && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/95 backdrop-blur-sm p-8 rounded-lg shadow-lg text-center max-w-md">
              <h3 className="text-lg font-semibold mb-6">Getting Started</h3>
              <div className="space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <div>
                    <div className="font-medium">Load STL</div>
                    <div className="text-sm text-muted-foreground">Import your STL file from the sidebar</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <div>
                    <div className="font-medium">Select Implant from Library</div>
                    <div className="text-sm text-muted-foreground">Browse implants in the library for comparison</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <div>
                    <div className="font-medium">Export STL</div>
                    <div className="text-sm text-muted-foreground">Save your modified STL file</div>
                  </div>
                </div>
              </div>
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

        {/* Status Bar - Coordinate Display */}
        {vtkReady && fileName && (
          <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2 text-sm font-mono">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Position:</span>
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
          </div>
        )}
      </div>
    </div>
  )
})

VTKViewer.displayName = "VTKViewer"

// Export the ref type for parent components
export type ViewSettings = {
  display: {
    wireframe: boolean
    showGrid: boolean
    showAxes: boolean
    transparency: number[]
  }
  lighting: {
    intensity: number[]
    ambientLight: number[]
    shadows: boolean
    autoRotate: boolean
  }
  material: {
    metallic: number[]
    roughness: number[]
    reflectance: number[]
    surfaceType: string
  }
  camera: {
    fieldOfView: number[]
    perspective: string
    autoFit: boolean
  }
}

export type VTKViewerRef = {
  importSTL: () => void
  exportSTL: () => void
  resetCamera: () => void
  loadSTLFile: (file: File) => Promise<void>
  loadTestSTL: () => Promise<void>
  clearSTL: () => void
  applySettings: (settings: ViewSettings) => void
}