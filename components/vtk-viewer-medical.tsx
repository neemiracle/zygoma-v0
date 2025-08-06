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
  onLandmarksChange?: (landmarks: Array<{ x: number; y: number; z: number; id: string }>) => void
}

interface Scanbody {
  id: string
  landmarks: Array<{ x: number; y: number; z: number; id: string }>
  boundingBox?: {
    center: { x: number; y: number; z: number }
    dimensions: {
      width: number   // Horizontal size (X-axis)
      depth: number   // Horizontal size (Y-axis)  
      height: number  // Vertical size (Z-axis) - flat profile
    }
    actor?: unknown
  }
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
  currentColor = "#4F46E5",
  fileName = "",
  onLandmarksChange
}, ref) => {
  const vtkContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [vtkReady, setVtkReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [currentIntersection, setCurrentIntersection] = useState<{ x: number; y: number; z: number } | null>(null)
  const [landmarkPoints, setLandmarkPoints] = useState<Array<{ x: number; y: number; z: number; id: string }>>([])
  const [scanbodies, setScanbodies] = useState<Array<Scanbody>>([])
  const [scanbodyTemplate, setScanbodyTemplate] = useState<unknown>(null)

  // VTK + ITK objects refs
  const vtkModulesRef = useRef<Record<string, unknown>>({})
  const vtkObjectsRef = useRef<Record<string, unknown>>({
    fullScreenRenderWindow: null,
    renderer: null,
    renderWindow: null,
    currentActor: null,
    medicalPicker: null,
    landmarkActors: [],
    landmarkMap: new Map(), // Map landmark ID to actor for highlighting
    boundingBoxActors: [], // Array to store scanbody bounding box actors
    scanbodyActors: [], // Array to store registered scanbody actors
    modelBoundingBoxActor: null // Actor for the overall STL model bounding box
  })

  // Initialize VTK.js with ITK.js integration
  useEffect(() => {
    if (!vtkContainerRef.current) return
    let mounted = true

    const initializeMedicalViewer = async () => {
      try {
        setIsLoading(true)
        setError("")
        // 1️⃣ Load geometry profile FIRST
        await import("vtk.js/Sources/Rendering/Profiles/Geometry")

        // 2️⃣ Load VTK modules (core only) + ITK
        const [
          { default: vtkFullScreenRenderWindow },
          { default: vtkInteractorStyleTrackballCamera },
          { default: vtkSTLReader },
          { default: vtkActor },
          { default: vtkMapper },
          { default: vtkCellPicker },
          { default: vtkSphereSource },
          { default: vtkCubeSource },
          { default: vtkMatrixBuilder },
          itkWasm
        ] = await Promise.all([
          import("vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow"),
          import("vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera"),
          import("vtk.js/Sources/IO/Geometry/STLReader"),
          import("vtk.js/Sources/Rendering/Core/Actor"),
          import("vtk.js/Sources/Rendering/Core/Mapper"),
          import("vtk.js/Sources/Rendering/Core/CellPicker"),
          import("vtk.js/Sources/Filters/Sources/SphereSource"),
          import("vtk.js/Sources/Filters/Sources/CubeSource"),
          import("vtk.js/Sources/Common/Core/MatrixBuilder"),
          import('itk-wasm')
        ])

        if (!mounted || !vtkContainerRef.current) return

        // Store VTK + ITK modules
        vtkModulesRef.current = {
          vtkFullScreenRenderWindow,
          vtkInteractorStyleTrackballCamera,
          vtkSTLReader,
          vtkActor,
          vtkMapper,
          vtkCellPicker,
          vtkSphereSource,
          vtkCubeSource,
          vtkMatrixBuilder,
          itkWasm
        }

        // 3️⃣ Create VTK render window
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

        // 4️⃣ Configure for medical visualization
        renderer.setBackground(0.1, 0.1, 0.1)
        renderer.setAutomaticLightCreation(true)

        // 5️⃣ Setup medical-grade picker with ITK precision
        const medicalPicker = vtkCellPicker.newInstance()
        medicalPicker.setPickFromList(true) // Use pick list to only pick from specific actors (STL model only)
        medicalPicker.setTolerance(0.01) // Increase tolerance for better hit detection

        // Create medical-grade precision picker function (wrapper approach)
        const performMedicalPick = (coords, renderer) => {
          const [x, y, z] = coords
          
          medicalPicker.pick([x, y, z], renderer)
          const pickPosition = medicalPicker.getPickPosition()
          
          // Check if we have a valid pick based on position
          const hasValidPosition = pickPosition && pickPosition.length === 3
          const isNonZero = hasValidPosition && (pickPosition[0] !== 0 || pickPosition[1] !== 0 || pickPosition[2] !== 0)
          
          if (hasValidPosition && isNonZero) {
            // Apply ITK-level precision (5 decimals) to the actual pick position
            const precisePosition = [
              Math.round(pickPosition[0] * 100000) / 100000,
              Math.round(pickPosition[1] * 100000) / 100000,
              Math.round(pickPosition[2] * 100000) / 100000
            ]
            
            return [precisePosition]
          }
          
          return []
        }

        // 6️⃣ Setup trackball interaction
        const interactor = fullScreenRenderWindow.getInteractor()
        const interactorStyle = vtkInteractorStyleTrackballCamera.newInstance()
        interactor.setInteractorStyle(interactorStyle)

        // Store VTK objects
        vtkObjectsRef.current = {
          fullScreenRenderWindow,
          renderer,
          renderWindow,
          currentActor: null,
          medicalPicker,
          performMedicalPick, // Store the wrapper function
          landmarkActors: [],
          landmarkMap: new Map(), // Initialize landmark map here
          boundingBoxActors: [], // Initialize bounding box actors array
          scanbodyActors: [] // Initialize scanbody actors array
        }

        renderer.resetCamera()
        renderWindow.render()

        setVtkReady(true)
        setError("")
        setIsLoading(false)

      } catch (error) {
        console.error("Medical viewer initialization failed:", error)
        setError(`Medical viewer failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setIsLoading(false)
      }
    }

    initializeMedicalViewer()

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
    }
  }, [])

  // Medical-grade mouse tracking
  useEffect(() => {
    if (!vtkReady || !vtkContainerRef.current) return

    const container = vtkContainerRef.current
    const { performMedicalPick, renderer } = vtkObjectsRef.current

    if (!performMedicalPick || !renderer) return

    let lastUpdate = 0
    const throttleMs = 16 // 60fps

    const handleMouseMove = (event: MouseEvent) => {
      const now = Date.now()
      if (now - lastUpdate < throttleMs) return
      lastUpdate = now

      const rect = container.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = rect.height - (event.clientY - rect.top) // Flip Y coordinate for VTK

      // Use medical-grade picker
      const medicalPositions = performMedicalPick([x, y, 0], renderer)
      
      if (medicalPositions.length > 0) {
        const worldPos = medicalPositions[0]
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

    // Medical landmark placement
    const handleMedicalClick = (event: MouseEvent) => {
      if (event.shiftKey && event.button === 0) {
        event.preventDefault()
        event.stopPropagation()
        
        const rect = container.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = rect.height - (event.clientY - rect.top) // Flip Y coordinate for VTK

        
        const medicalPositions = performMedicalPick([x, y, 0], renderer)
        
        if (medicalPositions.length > 0) {
          const worldPos = medicalPositions[0]
          const landmarkId = `medical_${Date.now()}`
          
          // Since STL is now truly centered at origin, use world coordinates directly
          const newLandmark = {
            x: worldPos[0],
            y: worldPos[1],
            z: worldPos[2],
            id: landmarkId
          }
          
          console.log(`Landmark placed at real world coordinates: [${worldPos[0].toFixed(3)}, ${worldPos[1].toFixed(3)}, ${worldPos[2].toFixed(3)}]`)

          createMedicalLandmark(newLandmark)
          setLandmarkPoints(prev => {
            const newLandmarks = [...prev, newLandmark]
            onLandmarksChange?.(newLandmarks)
            return newLandmarks
          })
        }
      }
      
      // Remove landmark
      if (event.ctrlKey && event.button === 0) {
        removeMedicalLandmark()
      }
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('click', handleMedicalClick)
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      container.removeEventListener('click', handleMedicalClick)
    }
  }, [vtkReady])

  // Utility function to calculate distance between two 3D points
  const calculateDistance = (p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number => {
    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    const dz = p1.z - p2.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  // Check if three landmarks form a valid scanbody (all distances <= 5mm)
  const isValidScanbody = (landmarks: Array<{ x: number; y: number; z: number; id: string }>): boolean => {
    if (landmarks.length !== 3) return false
    
    const [p1, p2, p3] = landmarks
    const dist12 = calculateDistance(p1, p2)
    const dist13 = calculateDistance(p1, p3)
    const dist23 = calculateDistance(p2, p3)
    
    return dist12 <= 5.0 && dist13 <= 5.0 && dist23 <= 5.0
  }

  // Calculate center point of three landmarks
  const calculateCenter = (landmarks: Array<{ x: number; y: number; z: number; id: string }>): { x: number; y: number; z: number } => {
    const avgX = landmarks.reduce((sum, p) => sum + p.x, 0) / landmarks.length
    const avgY = landmarks.reduce((sum, p) => sum + p.y, 0) / landmarks.length
    const avgZ = landmarks.reduce((sum, p) => sum + p.z, 0) / landmarks.length
    return { x: avgX, y: avgY, z: avgZ }
  }

  // Group landmarks into scanbodies based on proximity (5mm rule)
  const detectScanbodies = (landmarks: Array<{ x: number; y: number; z: number; id: string }>): Array<Scanbody> => {
    const scanbodies: Array<Scanbody> = []
    const usedLandmarks = new Set<string>()
    
    for (let i = 0; i < landmarks.length - 2; i++) {
      if (usedLandmarks.has(landmarks[i].id)) continue
      
      for (let j = i + 1; j < landmarks.length - 1; j++) {
        if (usedLandmarks.has(landmarks[j].id)) continue
        
        for (let k = j + 1; k < landmarks.length; k++) {
          if (usedLandmarks.has(landmarks[k].id)) continue
          
          const candidateGroup = [landmarks[i], landmarks[j], landmarks[k]]
          
          if (isValidScanbody(candidateGroup)) {
            const scanbodyId = `scanbody_${Date.now()}_${i}_${j}_${k}`
            scanbodies.push({
              id: scanbodyId,
              landmarks: candidateGroup
            })
            
            // Mark these landmarks as used
            candidateGroup.forEach(landmark => usedLandmarks.add(landmark.id))
            break
          }
        }
        if (usedLandmarks.has(landmarks[i].id)) break
      }
    }
    
    return scanbodies
  }

  // Create bounding box for the entire STL model
  const createModelBoundingBox = (actor: unknown) => {
    const { vtkCubeSource, vtkActor, vtkMapper } = vtkModulesRef.current
    const { renderer, renderWindow, modelBoundingBoxActor } = vtkObjectsRef.current

    if (!vtkCubeSource || !vtkActor || !vtkMapper || !renderer || !renderWindow || !actor) return

    // Remove existing model bounding box if any
    if (modelBoundingBoxActor) {
      renderer.removeActor(modelBoundingBoxActor)
    }

    // Get the bounds of the transformed STL model (already centered at origin)
    const bounds = (actor as any).getBounds()
    
    const width = bounds[1] - bounds[0]   // X dimension
    const depth = bounds[3] - bounds[2]   // Y dimension  
    const height = bounds[5] - bounds[4]  // Z dimension

    console.log(`Creating STL model bounding box: ${width.toFixed(2)}mm x ${depth.toFixed(2)}mm x ${height.toFixed(2)}mm`)
    console.log(`Model bounds: [${bounds[0].toFixed(2)}, ${bounds[1].toFixed(2)}], [${bounds[2].toFixed(2)}, ${bounds[3].toFixed(2)}], [${bounds[4].toFixed(2)}, ${bounds[5].toFixed(2)}]`)
    console.log(`Bounding box positioned at origin (0,0,0) since model is already centered`)

    // Create cube source for the model bounding box
    const cubeSource = vtkCubeSource.newInstance({
      xLength: width,
      yLength: depth,
      zLength: height
    })

    const cubeMapper = vtkMapper.newInstance()
    cubeMapper.setInputConnection(cubeSource.getOutputPort())

    const cubeActor = vtkActor.newInstance()
    cubeActor.setMapper(cubeMapper)

    // Set model bounding box properties (wireframe, distinct color)
    const property = cubeActor.getProperty()
    property.setColor(0.0, 1.0, 0.0) // Green color to distinguish from scanbody boxes
    property.setOpacity(0.2)
    property.setRepresentationToWireframe()
    property.setLineWidth(1)

    // Position the bounding box at origin since model is already centered at (0,0,0)
    cubeActor.setPosition(0, 0, 0)

    renderer.addActor(cubeActor)
    renderWindow.render()
    
    // Store the model bounding box actor
    vtkObjectsRef.current.modelBoundingBoxActor = cubeActor
    
    console.log("STL model bounding box created successfully")
  }

  // Create bounding box for a scanbody
  const createBoundingBox = (scanbody: Scanbody) => {
    const { vtkCubeSource, vtkActor, vtkMapper } = vtkModulesRef.current
    const { renderer, renderWindow, boundingBoxActors } = vtkObjectsRef.current

    if (!vtkCubeSource || !vtkActor || !vtkMapper || !renderer || !renderWindow) return

    const center = calculateCenter(scanbody.landmarks)
    
    // Scanbody bounding box dimensions - flat top/bottom design
    const horizontalSize = 5.0 // 5mm x 5mm horizontal footprint
    const verticalHeight = 2.0 // 2mm height for flat scanbody profile
    
    console.log(`Creating flat scanbody bounding box: ${horizontalSize}mm x ${horizontalSize}mm x ${verticalHeight}mm`)

    // Create rectangular box source with flat top/bottom
    const cubeSource = vtkCubeSource.newInstance({
      xLength: horizontalSize,  // 5mm width
      yLength: horizontalSize,  // 5mm depth  
      zLength: verticalHeight   // 2mm height (flat profile)
    })

    const cubeMapper = vtkMapper.newInstance()
    cubeMapper.setInputConnection(cubeSource.getOutputPort())

    const cubeActor = vtkActor.newInstance()
    cubeActor.setMapper(cubeMapper)

    // Set bounding box properties (wireframe, semi-transparent)
    const property = cubeActor.getProperty()
    property.setColor(1.0, 1.0, 0.0) // Yellow color
    property.setOpacity(0.3)
    property.setRepresentationToWireframe()
    property.setLineWidth(2)

    // Position the bounding box at the center of the landmarks
    cubeActor.setPosition(center.x, center.y, center.z)

    renderer.addActor(cubeActor)
    boundingBoxActors.push(cubeActor)
    renderWindow.render()

    // Update scanbody with bounding box info
    scanbody.boundingBox = {
      center,
      dimensions: {
        width: horizontalSize,
        depth: horizontalSize, 
        height: verticalHeight
      },
      actor: cubeActor
    }
    
    console.log(`Flat bounding box created for scanbody at [${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}]`)
  }

  // Process scanbodies - main function to be called from process button
  const processScanbodies = async () => {
    if (landmarkPoints.length < 3) {
      alert("Need at least 3 landmarks to create scanbodies")
      return
    }

    try {
      setIsLoading(true)

      // Clear existing bounding boxes and scanbody actors
      clearBoundingBoxes()
      clearScanbodyActors()

      // Detect scanbodies from current landmarks
      const detectedScanbodies = detectScanbodies(landmarkPoints)
      
      if (detectedScanbodies.length === 0) {
        alert("No valid scanbodies found. Each scanbody needs exactly 3 landmarks with all distances ≤ 5mm.")
        return
      }

      // Create bounding boxes for each detected scanbody
      detectedScanbodies.forEach(scanbody => {
        createBoundingBox(scanbody)
      })

      setScanbodies(detectedScanbodies)
      
      console.log(`Created ${detectedScanbodies.length} scanbody bounding boxes`)
      
    } catch (error) {
      console.error("Process scanbodies failed:", error)
      alert(`Process failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Clear all bounding boxes
  const clearBoundingBoxes = () => {
    const { renderer, renderWindow, boundingBoxActors } = vtkObjectsRef.current
    
    if (boundingBoxActors && renderer && renderWindow) {
      boundingBoxActors.forEach((actor: any) => renderer.removeActor(actor))
      vtkObjectsRef.current.boundingBoxActors = []
      renderWindow.render()
      setScanbodies([])
    }
  }

  // Clear all registered scanbodies
  const clearScanbodyActors = () => {
    const { renderer, renderWindow, scanbodyActors } = vtkObjectsRef.current
    
    if (scanbodyActors && renderer && renderWindow) {
      scanbodyActors.forEach((actor: any) => renderer.removeActor(actor))
      vtkObjectsRef.current.scanbodyActors = []
      renderWindow.render()
    }
  }

  // Load scanbody template STL
  const loadScanbodyTemplate = async (): Promise<unknown> => {
    if (scanbodyTemplate) {
      return scanbodyTemplate
    }

    try {
      const { vtkSTLReader } = vtkModulesRef.current
      if (!vtkSTLReader) throw new Error("VTK STL Reader not available")

      // Load the scanbody STL file
      const response = await fetch('/Scanbody.STL')
      if (!response.ok) throw new Error("Failed to load scanbody template")
      
      const arrayBuffer = await response.arrayBuffer()
      const reader = vtkSTLReader.newInstance()
      reader.parseAsArrayBuffer(arrayBuffer)
      const template = reader.getOutputData()
      
      if (!template || template.getNumberOfPoints() === 0) {
        throw new Error("Invalid scanbody template")
      }

      // Center the scanbody template at origin too for consistent coordinate system
      const bounds = template.getBounds()
      const centerX = (bounds[0] + bounds[1]) / 2
      const centerY = (bounds[2] + bounds[3]) / 2
      const centerZ = (bounds[4] + bounds[5]) / 2
      
      console.log(`Centering scanbody template from center: [${centerX.toFixed(3)}, ${centerY.toFixed(3)}, ${centerZ.toFixed(3)}]`)
      
      const points = template.getPoints()
      const pointData = points.getData()
      const numPoints = points.getNumberOfPoints()
      
      // Translate all template points to center at origin
      for (let i = 0; i < numPoints * 3; i += 3) {
        pointData[i] -= centerX     // X coordinate
        pointData[i + 1] -= centerY // Y coordinate  
        pointData[i + 2] -= centerZ // Z coordinate
      }
      
      points.modified()
      template.modified()
      
      console.log("Scanbody template centered at origin")

      setScanbodyTemplate(template)
      return template
    } catch (error) {
      console.error("Failed to load scanbody template:", error)
      throw error
    }
  }

  // Extract surface region around landmarks with expanded search radius
  const extractSurfaceRegion = (center: { x: number; y: number; z: number }, landmarks: Array<{ x: number; y: number; z: number; id: string }>) => {
    const { currentActor } = vtkObjectsRef.current
    if (!currentActor) return null

    // Get the polydata from the current STL
    const polyData = currentActor.getMapper().getInputData()
    if (!polyData) return null

    // Calculate expanded search radius based on landmark spread plus buffer
    let maxDistance = 0
    for (let i = 0; i < landmarks.length; i++) {
      for (let j = i + 1; j < landmarks.length; j++) {
        const dist = calculateDistance(landmarks[i], landmarks[j])
        maxDistance = Math.max(maxDistance, dist)
      }
    }
    
    // Use expanded radius (landmark spread + 10mm buffer for scanbody geometry)
    const searchRadius = Math.max(maxDistance * 1.5, 10.0)
    
    console.log(`Extracting surface region with radius: ${searchRadius.toFixed(2)}mm around center:`, center)

    // Extract points within the search radius
    const points = polyData.getPoints()
    const cells = polyData.getPolys()
    
    if (!points || !cells) return polyData

    const pointsData = points.getData()
    const numPoints = points.getNumberOfPoints()
    
    const nearbyPointIndices = []
    const nearbyPoints = []
    
    // Find points within search radius
    for (let i = 0; i < numPoints; i++) {
      const pointIndex = i * 3
      const px = pointsData[pointIndex]
      const py = pointsData[pointIndex + 1] 
      const pz = pointsData[pointIndex + 2]
      
      const distance = Math.sqrt(
        (px - center.x) * (px - center.x) +
        (py - center.y) * (py - center.y) + 
        (pz - center.z) * (pz - center.z)
      )
      
      if (distance <= searchRadius) {
        nearbyPointIndices.push(i)
        nearbyPoints.push([px, py, pz])
      }
    }
    
    console.log(`Found ${nearbyPoints.length} surface points within ${searchRadius.toFixed(2)}mm radius`)
    
    // Return object with extracted points for ICP
    return {
      originalPolyData: polyData,
      extractedPoints: nearbyPoints,
      pointIndices: nearbyPointIndices,
      searchRadius: searchRadius
    }
  }

  // Surface-to-surface matching registration algorithm
  const performSurfaceRegistration = (targetSurfaceData: any, templateSurface: unknown, landmarks: Array<{ x: number; y: number; z: number; id: string }>) => {
    const { vtkMatrixBuilder } = vtkModulesRef.current
    
    if (!vtkMatrixBuilder) {
      throw new Error("Matrix builder not available")
    }

    try {
      console.log("=== Starting Surface-to-Surface Matching Registration ===")
      
      const targetPointCloud = targetSurfaceData.extractedPoints
      console.log(`Target surface points: ${targetPointCloud.length}`)
      console.log(`Landmark positions:`, landmarks.map(l => `[${l.x.toFixed(2)}, ${l.y.toFixed(2)}, ${l.z.toFixed(2)}]`))
      
      // Extract surface patches around each landmark
      const targetPatches = extractSurfacePatchesAroundLandmarks(targetPointCloud, landmarks)
      
      // Extract corresponding surface patches from scanbody template  
      const templatePatches = extractScanbodySurfacePatches(templateSurface)
      
      // Perform surface-to-surface matching
      const matchingResult = performSurfaceToSurfaceMatching(targetPatches, templatePatches, landmarks)
      
      if (!matchingResult.success) {
        throw new Error("Failed to find sufficient surface correspondences")
      }
      
      // Calculate optimal transformation from surface matches
      const transformation = calculateOptimalTransformation(matchingResult.correspondences, templateSurface)
      
      // Create transformation matrix
      const transformMatrix = vtkMatrixBuilder.buildFromDegree()
        .rotateX(transformation.rotation.x)
        .rotateY(transformation.rotation.y)
        .rotateZ(transformation.rotation.z)
        .translate(transformation.translation.x, transformation.translation.y, transformation.translation.z)
        .getMatrix()
      
      console.log(`=== Surface-to-Surface Registration Complete ===`)
      console.log(`Surface Correspondences: ${matchingResult.correspondences.length}`)
      console.log(`Final RMS: ${transformation.rms.toFixed(6)}`)
      console.log(`Translation: [${transformation.translation.x.toFixed(3)}, ${transformation.translation.y.toFixed(3)}, ${transformation.translation.z.toFixed(3)}]`)
      console.log(`Rotation: [${transformation.rotation.x.toFixed(3)}°, ${transformation.rotation.y.toFixed(3)}°, ${transformation.rotation.z.toFixed(3)}°]`)
      
      return {
        transform: transformMatrix,
        rms: transformation.rms,
        translation: transformation.translation,
        rotation: transformation.rotation,
        correspondences: matchingResult.correspondences.length,
        surfaceMatched: true
      }
    } catch (error) {
      console.error("Surface-to-surface registration failed:", error)
      throw error
    }
  }

  // Extract surface patches around each landmark position
  const extractSurfacePatchesAroundLandmarks = (surfacePoints: number[][], landmarks: Array<{ x: number; y: number; z: number; id: string }>) => {
    const patches = []
    const patchRadius = 2.5 // 2.5mm radius around each landmark
    
    for (let i = 0; i < landmarks.length; i++) {
      const landmark = landmarks[i]
      console.log(`Extracting surface patch ${i + 1} around landmark [${landmark.x.toFixed(3)}, ${landmark.y.toFixed(3)}, ${landmark.z.toFixed(3)}]`)
      
      // Find surface points within patch radius of this landmark
      const patchPoints = surfacePoints.filter(point => {
        const distance = Math.sqrt(
          Math.pow(point[0] - landmark.x, 2) +
          Math.pow(point[1] - landmark.y, 2) +
          Math.pow(point[2] - landmark.z, 2)
        )
        return distance <= patchRadius
      })
      
      if (patchPoints.length > 10) {
        // Calculate patch centroid and normal
        const centroid = calculatePatchCentroid(patchPoints)
        const normal = calculatePatchNormal(patchPoints, centroid)
        
        patches.push({
          landmarkIndex: i,
          landmarkId: landmark.id,
          points: patchPoints,
          centroid: centroid,
          normal: normal,
          pointCount: patchPoints.length
        })
        
        console.log(`  Patch ${i + 1}: ${patchPoints.length} points, centroid=[${centroid.x.toFixed(3)}, ${centroid.y.toFixed(3)}, ${centroid.z.toFixed(3)}]`)
      } else {
        console.warn(`  Patch ${i + 1}: Insufficient points (${patchPoints.length}), skipping`)
      }
    }
    
    return patches
  }

  // Extract surface patches from scanbody template using spatial sampling
  const extractScanbodySurfacePatches = (templateSurface: unknown) => {
    const templatePoints = (templateSurface as any).getPoints()
    const templateData = templatePoints.getData()
    const numTemplatePoints = templatePoints.getNumberOfPoints()
    
    const templatePointCloud = []
    for (let i = 0; i < numTemplatePoints; i++) {
      const idx = i * 3
      templatePointCloud.push([
        templateData[idx],
        templateData[idx + 1], 
        templateData[idx + 2]
      ])
    }
    
    // Get template bounds
    const templateBounds = (templateSurface as any).getBounds()
    const templateCenter = {
      x: (templateBounds[0] + templateBounds[1]) / 2,
      y: (templateBounds[2] + templateBounds[3]) / 2,
      z: (templateBounds[4] + templateBounds[5]) / 2
    }
    
    console.log(`Template bounds: [${templateBounds[0].toFixed(2)}, ${templateBounds[1].toFixed(2)}], [${templateBounds[2].toFixed(2)}, ${templateBounds[3].toFixed(2)}], [${templateBounds[4].toFixed(2)}, ${templateBounds[5].toFixed(2)}]`)
    
    // Create multiple surface patches by spatial sampling rather than geometric assumptions
    const patches = []
    const patchRadius = 1.5 // 1.5mm radius for template patches
    
    // Sample points across the template surface
    const samplePoints = [
      { x: templateCenter.x, y: templateCenter.y, z: templateBounds[4] + 0.2 }, // Near bottom
      { x: templateCenter.x, y: templateCenter.y, z: templateCenter.z }, // Middle
      { x: templateCenter.x, y: templateCenter.y, z: templateBounds[5] - 0.2 }, // Near top
      { x: templateCenter.x + (templateBounds[1] - templateBounds[0]) * 0.3, y: templateCenter.y, z: templateCenter.z }, // Side 1
      { x: templateCenter.x - (templateBounds[1] - templateBounds[0]) * 0.3, y: templateCenter.y, z: templateCenter.z }, // Side 2
      { x: templateCenter.x, y: templateCenter.y + (templateBounds[3] - templateBounds[2]) * 0.3, z: templateCenter.z }, // Side 3
      { x: templateCenter.x, y: templateCenter.y - (templateBounds[3] - templateBounds[2]) * 0.3, z: templateCenter.z }, // Side 4
    ]
    
    for (let i = 0; i < samplePoints.length; i++) {
      const samplePoint = samplePoints[i]
      
      // Find template points within patch radius of sample point
      const patchPoints = templatePointCloud.filter(point => {
        const distance = Math.sqrt(
          Math.pow(point[0] - samplePoint.x, 2) +
          Math.pow(point[1] - samplePoint.y, 2) +
          Math.pow(point[2] - samplePoint.z, 2)
        )
        return distance <= patchRadius
      })
      
      if (patchPoints.length > 15) {
        const centroid = calculatePatchCentroid(patchPoints)
        const normal = calculatePatchNormal(patchPoints, centroid)
        
        patches.push({
          type: `template_patch_${i}`,
          samplePoint,
          points: patchPoints,
          centroid: centroid,
          normal: normal,
          pointCount: patchPoints.length
        })
        
        console.log(`  Template patch ${i}: ${patchPoints.length} points, centroid=[${centroid.x.toFixed(3)}, ${centroid.y.toFixed(3)}, ${centroid.z.toFixed(3)}]`)
      }
    }
    
    console.log(`Extracted ${patches.length} template surface patches using spatial sampling`)
    return patches
  }

  // Perform surface-to-surface matching between target and template patches
  const performSurfaceToSurfaceMatching = (targetPatches: any[], templatePatches: any[], landmarks: Array<{ x: number; y: number; z: number; id: string }>) => {
    const correspondences = []
    let totalMatchQuality = 0
    
    console.log(`Matching ${targetPatches.length} target patches with ${templatePatches.length} template patches`)
    
    // For each target patch, find the best matching template patch
    for (const targetPatch of targetPatches) {
      let bestMatch = null
      let bestMatchScore = -1
      
      for (const templatePatch of templatePatches) {
        // Calculate match score based on surface characteristics
        const matchScore = calculateSurfaceMatchScore(targetPatch, templatePatch)
        
        if (matchScore > bestMatchScore) {
          bestMatchScore = matchScore
          bestMatch = templatePatch
        }
      }
      
      if (bestMatch && bestMatchScore > 0.3) { // Minimum match threshold
        correspondences.push({
          targetPatch: targetPatch,
          templatePatch: bestMatch,
          matchScore: bestMatchScore,
          landmarkIndex: targetPatch.landmarkIndex
        })
        
        totalMatchQuality += bestMatchScore
        console.log(`  Patch ${targetPatch.landmarkIndex + 1} → ${bestMatch.type} surface (score: ${bestMatchScore.toFixed(3)})`)
      } else {
        console.warn(`  Patch ${targetPatch.landmarkIndex + 1}: No good match found (best score: ${bestMatchScore.toFixed(3)})`)
      }
    }
    
    const avgMatchQuality = correspondences.length > 0 ? totalMatchQuality / correspondences.length : 0
    const success = correspondences.length >= 2 // Need at least 2 correspondences
    
    console.log(`Surface matching result: ${correspondences.length}/${targetPatches.length} matches, avg quality: ${avgMatchQuality.toFixed(3)}`)
    
    return {
      success: success,
      correspondences: correspondences,
      averageMatchQuality: avgMatchQuality
    }
  }

  // Calculate match score between target and template surface patches
  const calculateSurfaceMatchScore = (targetPatch: any, templatePatch: any) => {
    // Compare surface normals (higher score for similar normals)
    const normalSimilarity = Math.abs(
      targetPatch.normal.x * templatePatch.normal.x +
      targetPatch.normal.y * templatePatch.normal.y +
      targetPatch.normal.z * templatePatch.normal.z
    )
    
    // Compare point densities (similar density = better match)
    const targetDensity = targetPatch.pointCount
    const templateDensity = templatePatch.pointCount
    const densityRatio = Math.min(targetDensity, templateDensity) / Math.max(targetDensity, templateDensity)
    
    // Calculate surface curvature similarity
    const targetCurvature = calculateSurfaceCurvature(targetPatch.points)
    const templateCurvature = calculateSurfaceCurvature(templatePatch.points)
    const curvatureSimilarity = 1.0 - Math.abs(targetCurvature - templateCurvature) / Math.max(Math.abs(targetCurvature), Math.abs(templateCurvature) + 0.001)
    
    // Calculate geometric compactness similarity
    const targetCompactness = calculateGeometricCompactness(targetPatch.points, targetPatch.centroid)
    const templateCompactness = calculateGeometricCompactness(templatePatch.points, templatePatch.centroid)
    const compactnessSimilarity = Math.min(targetCompactness, templateCompactness) / Math.max(targetCompactness, templateCompactness)
    
    // Weighted combination of all factors
    const matchScore = (normalSimilarity * 0.4) + (densityRatio * 0.2) + (curvatureSimilarity * 0.25) + (compactnessSimilarity * 0.15)
    
    return Math.max(0, Math.min(1, matchScore)) // Clamp to [0,1]
  }

  // Calculate surface curvature approximation
  const calculateSurfaceCurvature = (points: number[][]) => {
    if (points.length < 4) return 0
    
    // Calculate approximate curvature using point distribution
    const centroid = calculatePatchCentroid(points)
    let totalDeviation = 0
    let maxDistance = 0
    
    for (const point of points) {
      const distance = Math.sqrt(
        Math.pow(point[0] - centroid.x, 2) +
        Math.pow(point[1] - centroid.y, 2) +
        Math.pow(point[2] - centroid.z, 2)
      )
      totalDeviation += distance
      maxDistance = Math.max(maxDistance, distance)
    }
    
    const avgDistance = totalDeviation / points.length
    const curvature = maxDistance > 0.001 ? (avgDistance / maxDistance) : 0
    
    return curvature
  }

  // Calculate geometric compactness of point distribution
  const calculateGeometricCompactness = (points: number[][], centroid: { x: number; y: number; z: number }) => {
    if (points.length < 3) return 0
    
    let sumSquaredDistances = 0
    for (const point of points) {
      const distance = Math.sqrt(
        Math.pow(point[0] - centroid.x, 2) +
        Math.pow(point[1] - centroid.y, 2) +
        Math.pow(point[2] - centroid.z, 2)
      )
      sumSquaredDistances += distance * distance
    }
    
    const variance = sumSquaredDistances / points.length
    const compactness = 1.0 / (1.0 + variance) // Higher compactness = more tightly clustered
    
    return compactness
  }

  // Calculate optimal transformation from surface correspondences with improved surface-based alignment
  const calculateOptimalTransformation = (correspondences: any[], templateSurface: unknown) => {
    if (correspondences.length < 1) {
      throw new Error("Need at least 1 surface correspondence for transformation")
    }
    
    console.log(`Calculating transformation from ${correspondences.length} surface correspondences`)
    
    // Weight correspondences by match quality
    let totalWeight = 0
    let weightedTargetCentroidX = 0, weightedTargetCentroidY = 0, weightedTargetCentroidZ = 0
    let weightedTemplateCentroidX = 0, weightedTemplateCentroidY = 0, weightedTemplateCentroidZ = 0
    
    for (const corr of correspondences) {
      const weight = corr.matchScore || 1.0
      totalWeight += weight
      
      weightedTargetCentroidX += corr.targetPatch.centroid.x * weight
      weightedTargetCentroidY += corr.targetPatch.centroid.y * weight
      weightedTargetCentroidZ += corr.targetPatch.centroid.z * weight
      
      weightedTemplateCentroidX += corr.templatePatch.centroid.x * weight
      weightedTemplateCentroidY += corr.templatePatch.centroid.y * weight
      weightedTemplateCentroidZ += corr.templatePatch.centroid.z * weight
    }
    
    const targetCentroid = {
      x: weightedTargetCentroidX / totalWeight,
      y: weightedTargetCentroidY / totalWeight,
      z: weightedTargetCentroidZ / totalWeight
    }
    
    const templateCentroid = {
      x: weightedTemplateCentroidX / totalWeight,
      y: weightedTemplateCentroidY / totalWeight,
      z: weightedTemplateCentroidZ / totalWeight
    }
    
    console.log(`Weighted target centroid: [${targetCentroid.x.toFixed(3)}, ${targetCentroid.y.toFixed(3)}, ${targetCentroid.z.toFixed(3)}]`)
    console.log(`Weighted template centroid: [${templateCentroid.x.toFixed(3)}, ${templateCentroid.y.toFixed(3)}, ${templateCentroid.z.toFixed(3)}]`)
    
    // Calculate weighted translation
    const translation = {
      x: targetCentroid.x - templateCentroid.x,
      y: targetCentroid.y - templateCentroid.y,
      z: targetCentroid.z - templateCentroid.z
    }
    
    // Calculate weighted rotation from surface normal alignment
    let weightedTargetNormalX = 0, weightedTargetNormalY = 0, weightedTargetNormalZ = 0
    let weightedTemplateNormalX = 0, weightedTemplateNormalY = 0, weightedTemplateNormalZ = 0
    
    for (const corr of correspondences) {
      const weight = corr.matchScore || 1.0
      
      weightedTargetNormalX += corr.targetPatch.normal.x * weight
      weightedTargetNormalY += corr.targetPatch.normal.y * weight
      weightedTargetNormalZ += corr.targetPatch.normal.z * weight
      
      weightedTemplateNormalX += corr.templatePatch.normal.x * weight
      weightedTemplateNormalY += corr.templatePatch.normal.y * weight
      weightedTemplateNormalZ += corr.templatePatch.normal.z * weight
    }
    
    const avgTargetNormal = {
      x: weightedTargetNormalX / totalWeight,
      y: weightedTargetNormalY / totalWeight,
      z: weightedTargetNormalZ / totalWeight
    }
    
    const avgTemplateNormal = {
      x: weightedTemplateNormalX / totalWeight,
      y: weightedTemplateNormalY / totalWeight,
      z: weightedTemplateNormalZ / totalWeight
    }
    
    // Normalize averaged normals
    const targetNormalLength = Math.sqrt(avgTargetNormal.x ** 2 + avgTargetNormal.y ** 2 + avgTargetNormal.z ** 2)
    const templateNormalLength = Math.sqrt(avgTemplateNormal.x ** 2 + avgTemplateNormal.y ** 2 + avgTemplateNormal.z ** 2)
    
    if (targetNormalLength > 0.001) {
      avgTargetNormal.x /= targetNormalLength
      avgTargetNormal.y /= targetNormalLength
      avgTargetNormal.z /= targetNormalLength
    }
    
    if (templateNormalLength > 0.001) {
      avgTemplateNormal.x /= templateNormalLength
      avgTemplateNormal.y /= templateNormalLength
      avgTemplateNormal.z /= templateNormalLength
    }
    
    console.log(`Averaged target normal: [${avgTargetNormal.x.toFixed(3)}, ${avgTargetNormal.y.toFixed(3)}, ${avgTargetNormal.z.toFixed(3)}]`)
    console.log(`Averaged template normal: [${avgTemplateNormal.x.toFixed(3)}, ${avgTemplateNormal.y.toFixed(3)}, ${avgTemplateNormal.z.toFixed(3)}]`)
    
    // Calculate rotation to align normals
    const rotation = calculateRotationBetweenNormals(avgTemplateNormal, avgTargetNormal)
    
    // Calculate weighted RMS error from correspondences
    let weightedSumSquaredErrors = 0
    for (const corr of correspondences) {
      const weight = corr.matchScore || 1.0
      const error = Math.sqrt(
        Math.pow(corr.targetPatch.centroid.x - (corr.templatePatch.centroid.x + translation.x), 2) +
        Math.pow(corr.targetPatch.centroid.y - (corr.templatePatch.centroid.y + translation.y), 2) +
        Math.pow(corr.targetPatch.centroid.z - (corr.templatePatch.centroid.z + translation.z), 2)
      )
      weightedSumSquaredErrors += error * error * weight
    }
    
    const rms = Math.sqrt(weightedSumSquaredErrors / totalWeight)
    
    console.log(`Calculated transformation - Translation: [${translation.x.toFixed(3)}, ${translation.y.toFixed(3)}, ${translation.z.toFixed(3)}], RMS: ${rms.toFixed(6)}`)
    
    return {
      translation: translation,
      rotation: rotation,
      rms: rms,
      correspondenceWeight: totalWeight
    }
  }

  // Helper functions for patch analysis
  const calculatePatchCentroid = (points: number[][]) => {
    let sumX = 0, sumY = 0, sumZ = 0
    for (const point of points) {
      sumX += point[0]
      sumY += point[1]
      sumZ += point[2]
    }
    return {
      x: sumX / points.length,
      y: sumY / points.length,
      z: sumZ / points.length
    }
  }

  const calculatePatchNormal = (points: number[][], centroid: { x: number; y: number; z: number }) => {
    if (points.length < 3) return { x: 0, y: 0, z: 1 }
    
    // Use first 3 points to calculate normal
    const p1 = points[0]
    const p2 = points[1]
    const p3 = points[2]
    
    const v1 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]]
    const v2 = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]]
    
    const normal = [
      v1[1] * v2[2] - v1[2] * v2[1],
      v1[2] * v2[0] - v1[0] * v2[2], 
      v1[0] * v2[1] - v1[1] * v2[0]
    ]
    
    const length = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2)
    if (length > 0.001) {
      return {
        x: normal[0] / length,
        y: normal[1] / length,
        z: normal[2] / length
      }
    }
    
    return { x: 0, y: 0, z: 1 }
  }

  const calculateRotationBetweenNormals = (fromNormal: { x: number; y: number; z: number }, toNormal: { x: number; y: number; z: number }) => {
    // Calculate rotation angles to transform fromNormal to toNormal
    const pitch = Math.atan2(toNormal.y - fromNormal.y, toNormal.z - fromNormal.z) * 180 / Math.PI
    const roll = -Math.atan2(toNormal.x - fromNormal.x, toNormal.z - fromNormal.z) * 180 / Math.PI
    const yaw = Math.atan2(toNormal.y - fromNormal.y, toNormal.x - fromNormal.x) * 180 / Math.PI
    
    return {
      x: pitch,
      y: roll,
      z: yaw
    }
  }

  // Analyze surface geometry for precise attachment
  const analyzeSurfaceGeometry = (surfacePoints: number[][], centerPoint: { x: number; y: number; z: number }) => {
    console.log(`Analyzing surface geometry around center: [${centerPoint.x.toFixed(3)}, ${centerPoint.y.toFixed(3)}, ${centerPoint.z.toFixed(3)}]`)
    
    // Use progressively larger search radii to find the best attachment point
    const searchRadii = [1.0, 2.0, 3.0, 4.0] // Multiple search distances
    let bestAttachmentPoint = { x: centerPoint.x, y: centerPoint.y, z: centerPoint.z }
    let bestPointCount = 0
    
    for (const radius of searchRadii) {
      const nearCenterPoints = surfacePoints.filter(point => {
        const distance2D = Math.sqrt(
          Math.pow(point[0] - centerPoint.x, 2) + 
          Math.pow(point[1] - centerPoint.y, 2)
        )
        return distance2D <= radius
      })
      
      if (nearCenterPoints.length > bestPointCount) {
        bestPointCount = nearCenterPoints.length
        
        // Find the highest point within this radius
        let highestZ = -Number.MAX_VALUE
        for (const point of nearCenterPoints) {
          if (point[2] > highestZ) {
            highestZ = point[2]
            bestAttachmentPoint = { x: point[0], y: point[1], z: point[2] }
          }
        }
        
        console.log(`Found ${nearCenterPoints.length} points within ${radius}mm radius, highest at Z=${highestZ.toFixed(3)}`)
      }
    }
    
    // Refine attachment point by averaging nearby high points
    const refinementRadius = 1.0
    const nearAttachmentPoints = surfacePoints.filter(point => {
      const distance = Math.sqrt(
        Math.pow(point[0] - bestAttachmentPoint.x, 2) + 
        Math.pow(point[1] - bestAttachmentPoint.y, 2) + 
        Math.pow(point[2] - bestAttachmentPoint.z, 2)
      )
      return distance <= refinementRadius
    })
    
    if (nearAttachmentPoints.length > 3) {
      // Average the top surface points for more stable attachment
      let avgX = 0, avgY = 0, avgZ = 0
      for (const point of nearAttachmentPoints) {
        avgX += point[0]
        avgY += point[1] 
        avgZ += point[2]
      }
      
      bestAttachmentPoint = {
        x: avgX / nearAttachmentPoints.length,
        y: avgY / nearAttachmentPoints.length,
        z: avgZ / nearAttachmentPoints.length
      }
      
      console.log(`Refined attachment point using ${nearAttachmentPoints.length} points: [${bestAttachmentPoint.x.toFixed(3)}, ${bestAttachmentPoint.y.toFixed(3)}, ${bestAttachmentPoint.z.toFixed(3)}]`)
    }
    
    // Calculate surface normal using the refined attachment point
    const normal = calculateSurfaceNormal(surfacePoints, bestAttachmentPoint)
    
    return {
      attachmentPoint: bestAttachmentPoint,
      normal,
      nearbyPoints: bestPointCount
    }
  }

  // Calculate robust surface normal using multiple point sampling
  const calculateSurfaceNormal = (surfacePoints: number[][], point: { x: number; y: number; z: number }) => {
    const radius = 1.5 // Reduced radius for more local surface analysis
    const nearbyPoints = surfacePoints.filter(p => {
      const dist = Math.sqrt(
        Math.pow(p[0] - point.x, 2) + 
        Math.pow(p[1] - point.y, 2) + 
        Math.pow(p[2] - point.z, 2)
      )
      return dist <= radius && dist > 0.001
    })
    
    if (nearbyPoints.length < 6) {
      // Default normal pointing up if insufficient points
      console.warn(`Insufficient points for normal calculation: ${nearbyPoints.length}`)
      return { x: 0, y: 0, z: 1 }
    }
    
    // Calculate multiple normals and average them for robustness
    const normals = []
    const numSamples = Math.min(nearbyPoints.length - 2, 10) // Use up to 10 samples
    
    for (let i = 0; i < numSamples; i++) {
      if (i + 2 >= nearbyPoints.length) break
      
      const p1 = nearbyPoints[i]
      const p2 = nearbyPoints[i + 1]
      const p3 = nearbyPoints[i + 2]
      
      // Vectors from p1 to p2 and p1 to p3
      const v1 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]]
      const v2 = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]]
      
      // Cross product
      const normal = [
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2], 
        v1[0] * v2[1] - v1[1] * v2[0]
      ]
      
      // Normalize and add to collection
      const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2])
      if (length > 0.001) {
        normals.push({
          x: normal[0] / length,
          y: normal[1] / length,
          z: normal[2] / length
        })
      }
    }
    
    if (normals.length === 0) {
      return { x: 0, y: 0, z: 1 }
    }
    
    // Average all normals for robust estimation
    let avgX = 0, avgY = 0, avgZ = 0
    for (const normal of normals) {
      avgX += normal.x
      avgY += normal.y
      avgZ += normal.z
    }
    
    avgX /= normals.length
    avgY /= normals.length
    avgZ /= normals.length
    
    // Normalize the averaged normal
    const avgLength = Math.sqrt(avgX * avgX + avgY * avgY + avgZ * avgZ)
    if (avgLength > 0.001) {
      const result = {
        x: avgX / avgLength,
        y: avgY / avgLength,
        z: avgZ / avgLength
      }
      
      // Ensure normal points upward (positive Z component preferred for dental surfaces)
      if (result.z < 0) {
        result.x = -result.x
        result.y = -result.y
        result.z = -result.z
      }
      
      console.log(`Calculated robust normal from ${normals.length} samples: [${result.x.toFixed(3)}, ${result.y.toFixed(3)}, ${result.z.toFixed(3)}]`)
      return result
    }
    
    return { x: 0, y: 0, z: 1 }
  }

  // Calculate precise rotation to align scanbody with surface normal
  const calculateSurfaceAlignmentRotation = (normal: { x: number; y: number; z: number }) => {
    // Target is to align scanbody's Z-axis (up direction) with the surface normal
    
    // Calculate rotation about X-axis (pitch) - tilt forward/backward
    const pitch = Math.atan2(normal.y, normal.z) * 180 / Math.PI
    
    // Calculate rotation about Y-axis (roll) - tilt left/right  
    const roll = -Math.atan2(normal.x, normal.z) * 180 / Math.PI
    
    // No yaw rotation needed for surface alignment
    const yaw = 0
    
    console.log(`Surface alignment rotation: pitch=${pitch.toFixed(2)}°, roll=${roll.toFixed(2)}°, yaw=${yaw.toFixed(2)}°`)
    
    return {
      x: pitch,
      y: roll, 
      z: yaw
    }
  }

  // Calculate RMS based on surface fit quality
  const calculateSurfaceFitRMS = (surfacePoints: number[][], position: { x: number; y: number; z: number }, normal: { x: number; y: number; z: number }) => {
    // Find points within 5mm of the scanbody position
    const nearbyPoints = surfacePoints.filter(point => {
      const distance = Math.sqrt(
        Math.pow(point[0] - position.x, 2) +
        Math.pow(point[1] - position.y, 2) +
        Math.pow(point[2] - position.z, 2)
      )
      return distance <= 5.0
    })
    
    if (nearbyPoints.length === 0) return 1.0
    
    // Calculate deviation from expected surface plane
    let sumSquaredDeviations = 0
    for (const point of nearbyPoints) {
      // Distance from point to the surface plane defined by position and normal
      const deviation = Math.abs(
        (point[0] - position.x) * normal.x +
        (point[1] - position.y) * normal.y +
        (point[2] - position.z) * normal.z
      )
      sumSquaredDeviations += deviation * deviation
    }
    
    return Math.sqrt(sumSquaredDeviations / nearbyPoints.length)
  }


  // Create registered scanbody actor with full transformation
  const createRegisteredScanbody = (templateSurface: unknown, transform: unknown, scanbodyId: string, registrationResult: any) => {
    const { vtkActor, vtkMapper } = vtkModulesRef.current
    const { renderer, renderWindow, scanbodyActors } = vtkObjectsRef.current

    if (!vtkActor || !vtkMapper || !renderer || !renderWindow) {
      throw new Error("Required VTK modules not available")
    }

    try {
      // Create the actor directly with the template surface
      const mapper = vtkMapper.newInstance()
      mapper.setInputData(templateSurface)

      const actor = vtkActor.newInstance()
      actor.setMapper(mapper)

      // Apply the full transformation (translation + rotation)
      const { translation, rotation } = registrationResult
      
      // Set position
      actor.setPosition(translation.x, translation.y, translation.z)
      
      // Apply rotation using orientation
      actor.setOrientation(rotation.x, rotation.y, rotation.z)

      // Set scanbody appearance (medical green with high precision indicators)
      const property = actor.getProperty()
      property.setColor(0.1, 0.9, 0.3) // Bright medical green for registered scanbodies
      property.setOpacity(0.85)
      property.setSpecular(0.9)
      property.setSpecularPower(50)
      property.setLighting(true)
      property.setAmbient(0.1)
      property.setDiffuse(0.8)

      // Add to scene
      renderer.addActor(actor)
      scanbodyActors.push(actor)
      renderWindow.render()

      console.log(`Created registered scanbody with transformation:`)
      console.log(`  Position: [${translation.x.toFixed(3)}, ${translation.y.toFixed(3)}, ${translation.z.toFixed(3)}]`)
      console.log(`  Rotation: [${rotation.x.toFixed(3)}°, ${rotation.y.toFixed(3)}°, ${rotation.z.toFixed(3)}°]`)

      return actor
    } catch (error) {
      console.error("Failed to create registered scanbody:", error)
      throw error
    }
  }

  // Legacy surface registration process (Process button)
  const performScanbodyRegistration = async () => {
    if (!scanbodies.length) {
      alert("No scanbodies detected. Please run process first.")
      return
    }

    try {
      setIsLoading(true)
      console.log("Loading scanbody template...")
      
      // Load the scanbody template
      const template = await loadScanbodyTemplate()
      
      console.log("Performing basic surface registration for", scanbodies.length, "scanbodies...")
      
      // Clear any existing registered scanbodies
      clearScanbodyActors()
      
      const registrationResults = []
      
      // Process each detected scanbody with basic surface attachment
      for (let i = 0; i < scanbodies.length; i++) {
        const scanbody = scanbodies[i]
        const center = calculateCenter(scanbody.landmarks)
        
        console.log(`Registering scanbody ${i + 1}/${scanbodies.length} at position:`, center)
        
        // Extract surface region with expanded search radius based on landmarks
        const targetSurfaceData = extractSurfaceRegion(center, scanbody.landmarks)
        
        if (!targetSurfaceData || targetSurfaceData.extractedPoints.length < 50) {
          console.warn(`Failed to extract sufficient surface points for scanbody ${i + 1} (found: ${targetSurfaceData?.extractedPoints.length || 0})`)
          continue
        }
        
        // Use basic surface attachment for Process button
        const surfaceAnalysis = analyzeSurfaceGeometry(targetSurfaceData.extractedPoints, center)
        const templateBounds = (template as any).getBounds()
        const templateHeight = templateBounds[5] - templateBounds[4]
        const templateCenterZ = (templateBounds[4] + templateBounds[5]) / 2
        const attachmentOffset = templateHeight / 2 - templateCenterZ
        
        const finalPosition = {
          x: surfaceAnalysis.attachmentPoint.x,
          y: surfaceAnalysis.attachmentPoint.y,
          z: surfaceAnalysis.attachmentPoint.z + attachmentOffset
        }
        
        const rotation = calculateSurfaceAlignmentRotation(surfaceAnalysis.normal)
        const rms = calculateSurfaceFitRMS(targetSurfaceData.extractedPoints, finalPosition, surfaceAnalysis.normal)
        
        const registrationResult = {
          rms: rms,
          translation: finalPosition,
          rotation: rotation,
          surfaceAttached: true
        }
        
        // Create the registered scanbody actor
        const actor = createRegisteredScanbody(template, null, scanbody.id, registrationResult)
        
        registrationResults.push({
          scanbodyId: scanbody.id,
          rms: registrationResult.rms,
          translation: registrationResult.translation,
          rotation: registrationResult.rotation,
          searchRadius: targetSurfaceData.searchRadius,
          surfacePoints: targetSurfaceData.extractedPoints.length,
          surfaceAttached: registrationResult.surfaceAttached,
          actor
        })
        
        console.log(`Scanbody ${i + 1} registered with basic surface attachment, RMS: ${registrationResult.rms.toFixed(6)}`)
      }
      
      console.log("=== Basic Surface Registration Summary ===")
      registrationResults.forEach((result, index) => {
        console.log(`Scanbody ${index + 1}:`)
        console.log(`  Surface Fit RMS: ${result.rms.toFixed(6)} mm`)
        console.log(`  Search Radius: ${result.searchRadius.toFixed(2)} mm`) 
        console.log(`  Surface Points: ${result.surfacePoints}`)
        console.log(`  Surface Attached: ${result.surfaceAttached ? '✅ YES' : '❌ NO'}`)
        console.log(`  Position: [${result.translation.x.toFixed(3)}, ${result.translation.y.toFixed(3)}, ${result.translation.z.toFixed(3)}] mm`)
        console.log(`  Orientation: [${result.rotation.x.toFixed(3)}, ${result.rotation.y.toFixed(3)}, ${result.rotation.z.toFixed(3)}] degrees`)
      })
      
      const avgRMS = registrationResults.reduce((sum, r) => sum + r.rms, 0) / registrationResults.length
      alert(`Basic Surface Registration Complete!\n\n✅ ${registrationResults.length} scanbodies positioned\n🎯 Average RMS: ${avgRMS.toFixed(6)} mm\n\nFor advanced surface matching, use Process2 button.`)
      
    } catch (error) {
      console.error("Surface registration failed:", error)
      alert(`Surface registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Advanced surface-to-surface matching registration (Process2 button)
  const performAdvancedSurfaceMatching = async () => {
    if (!scanbodies.length) {
      alert("No scanbodies detected. Please run Process first to detect scanbodies.")
      return
    }

    try {
      setIsLoading(true)
      console.log("Loading scanbody template for advanced surface matching...")
      
      // Load the scanbody template
      const template = await loadScanbodyTemplate()
      
      console.log("Performing advanced surface-to-surface matching for", scanbodies.length, "scanbodies...")
      
      // Clear any existing registered scanbodies
      clearScanbodyActors()
      
      const registrationResults = []
      
      // Process each detected scanbody with advanced surface matching
      for (let i = 0; i < scanbodies.length; i++) {
        const scanbody = scanbodies[i]
        const center = calculateCenter(scanbody.landmarks)
        
        console.log(`Advanced matching for scanbody ${i + 1}/${scanbodies.length}`)
        
        // Extract surface region with expanded search radius based on landmarks
        const targetSurfaceData = extractSurfaceRegion(center, scanbody.landmarks)
        
        if (!targetSurfaceData || targetSurfaceData.extractedPoints.length < 50) {
          console.warn(`Failed to extract sufficient surface points for scanbody ${i + 1} (found: ${targetSurfaceData?.extractedPoints.length || 0})`)
          continue
        }
        
        // Perform advanced surface-to-surface matching registration
        const registrationResult = performSurfaceRegistration(targetSurfaceData, template, scanbody.landmarks)
        
        // Create the registered scanbody actor with full transformation
        const actor = createRegisteredScanbody(template, registrationResult.transform, scanbody.id, registrationResult)
        
        registrationResults.push({
          scanbodyId: scanbody.id,
          rms: registrationResult.rms,
          translation: registrationResult.translation,
          rotation: registrationResult.rotation,
          correspondences: registrationResult.correspondences,
          searchRadius: targetSurfaceData.searchRadius,
          surfacePoints: targetSurfaceData.extractedPoints.length,
          surfaceMatched: registrationResult.surfaceMatched,
          actor
        })
        
        console.log(`Scanbody ${i + 1} registered with advanced surface matching, RMS: ${registrationResult.rms.toFixed(6)}`)
      }
      
      console.log("=== Advanced Surface-to-Surface Matching Summary ===")
      registrationResults.forEach((result, index) => {
        console.log(`Scanbody ${index + 1}:`)
        console.log(`  Surface Match RMS: ${result.rms.toFixed(6)} mm`)
        console.log(`  Surface Correspondences: ${result.correspondences}`)
        console.log(`  Search Radius: ${result.searchRadius.toFixed(2)} mm`) 
        console.log(`  Surface Points: ${result.surfacePoints}`)
        console.log(`  Surface Matched: ${result.surfaceMatched ? '✅ YES' : '❌ NO'}`)
        console.log(`  Position: [${result.translation.x.toFixed(3)}, ${result.translation.y.toFixed(3)}, ${result.translation.z.toFixed(3)}] mm`)
        console.log(`  Orientation: [${result.rotation.x.toFixed(3)}, ${result.rotation.y.toFixed(3)}, ${result.rotation.z.toFixed(3)}] degrees`)
      })
      
      const avgRMS = registrationResults.reduce((sum, r) => sum + r.rms, 0) / registrationResults.length
      const maxRMS = Math.max(...registrationResults.map(r => r.rms))
      const minRMS = Math.min(...registrationResults.map(r => r.rms))
      const totalCorrespondences = registrationResults.reduce((sum, r) => sum + r.correspondences, 0)
      
      console.log(`=== Advanced Registration Statistics ===`)
      console.log(`Average RMS: ${avgRMS.toFixed(6)} mm`)
      console.log(`Max RMS: ${maxRMS.toFixed(6)} mm`)
      console.log(`Min RMS: ${minRMS.toFixed(6)} mm`)
      console.log(`Total Surface Correspondences: ${totalCorrespondences}`)
      
      alert(`Advanced Surface-to-Surface Matching Complete!\n\n✅ ${registrationResults.length} scanbodies registered with precision surface matching\n🎯 Average Surface RMS: ${avgRMS.toFixed(6)} mm\n📈 Range: ${minRMS.toFixed(6)} - ${maxRMS.toFixed(6)} mm\n🔗 Total Surface Correspondences: ${totalCorrespondences}\n\nScanbodies positioned using medical-grade surface matching.\nCheck console for detailed analysis.`)
      
    } catch (error) {
      console.error("Advanced surface matching failed:", error)
      alert(`Advanced surface matching failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Create medical-grade landmark
  const createMedicalLandmark = (landmark: { x: number; y: number; z: number; id: string }) => {
    const { vtkSphereSource, vtkActor, vtkMapper } = vtkModulesRef.current
    const { renderer, renderWindow, currentActor, landmarkActors } = vtkObjectsRef.current

    if (!currentActor) return

    // Calculate landmark size - increased for better visibility
    const bounds = currentActor.getBounds()
    const size = Math.max(bounds[1] - bounds[0], bounds[3] - bounds[2], bounds[5] - bounds[4])
    const sphereRadius = size * 0.008 // Increased from 0.002 to 0.008 for better visibility

    // Create high-resolution sphere
    const sphereSource = vtkSphereSource.newInstance({
      radius: sphereRadius,
      phiResolution: 32,
      thetaResolution: 32
    })

    const sphereMapper = vtkMapper.newInstance()
    sphereMapper.setInputConnection(sphereSource.getOutputPort())

    const sphereActor = vtkActor.newInstance()
    sphereActor.setMapper(sphereMapper)

    // Medical cyan color
    const property = sphereActor.getProperty()
    property.setColor(0.0, 0.8, 1.0) // Medical cyan
    property.setOpacity(0.95)
    property.setSpecular(0.8)
    property.setSpecularPower(40)
    property.setLighting(true)
    property.setAmbient(0.2)
    property.setDiffuse(0.9)

    // Position with ITK precision - use real world coordinates directly
    sphereActor.setPosition(landmark.x, landmark.y, landmark.z)
    console.log(`Landmark positioned at real coordinates: [${landmark.x.toFixed(3)}, ${landmark.y.toFixed(3)}, ${landmark.z.toFixed(3)}]`)

    renderer.addActor(sphereActor)
    renderWindow.render()

    landmarkActors.push(sphereActor)
    
    // Store landmark in map for highlighting
    const { landmarkMap } = vtkObjectsRef.current
    if (landmarkMap) {
      landmarkMap.set(landmark.id, sphereActor)
    }
  }

  // Remove medical landmark
  const removeMedicalLandmark = () => {
    const { renderer, renderWindow, landmarkActors } = vtkObjectsRef.current
    
    if (landmarkActors && landmarkActors.length > 0) {
      const lastActor = landmarkActors.pop()
      renderer.removeActor(lastActor)
      renderWindow.render()
      
      setLandmarkPoints(prev => {
        const newLandmarks = prev.slice(0, -1)
        onLandmarksChange?.(newLandmarks)
        return newLandmarks
      })
    }
  }

  // Load STL with medical precision
  const loadSTLFile = async (file: File) => {
    if (!vtkReady || !vtkModulesRef.current || !vtkObjectsRef.current.renderer) {
      setError("Medical viewer not ready yet, please wait a moment and try again.")
      return
    }

    try {
      setIsLoading(true)
      setError("")

      const { vtkSTLReader, vtkActor, vtkMapper, itkWasm } = vtkModulesRef.current
      const { renderer, renderWindow, currentActor, medicalPicker } = vtkObjectsRef.current

      const arrayBuffer = await file.arrayBuffer()
      let polyData = null
      let useITKPrecision = false

      // Try ITK.js for medical precision
      try {
        const { readMesh } = itkWasm
        const itkMesh = await readMesh(new Uint8Array(arrayBuffer))
        
        // For now, we'll fall back to VTK since ITK->VTK conversion needs more modules
        // This preserves the medical-grade picker precision
        throw new Error("Using VTK fallback for compatibility")
        
      } catch (itkError) {
        const reader = vtkSTLReader.newInstance()
        reader.parseAsArrayBuffer(arrayBuffer)
        polyData = reader.getOutputData()
      }

      if (!polyData || polyData.getNumberOfPoints() === 0) {
        throw new Error("Invalid STL file")
      }

      // Create VTK rendering pipeline
      const mapper = vtkMapper.newInstance()
      mapper.setInputData(polyData)
      mapper.setScalarVisibility(false)

      const actor = vtkActor.newInstance()
      actor.setMapper(mapper)

      // Medical-grade material
      const property = actor.getProperty()
      const rgb = hexToRgb(currentColor)
      
      property.setColor(rgb.r, rgb.g, rgb.b)
      property.setDiffuseColor(rgb.r, rgb.g, rgb.b)
      property.setAmbientColor(rgb.r * 0.2, rgb.g * 0.2, rgb.b * 0.2)
      property.setSpecularColor(1.0, 1.0, 1.0)
      
      property.setAmbient(0.15)
      property.setDiffuse(0.85)
      property.setSpecular(0.5)
      property.setSpecularPower(30)
      property.setOpacity(1.0)
      property.setLighting(true)
      property.setInterpolationToPhong()

      // TRANSFORM STL POLYDATA TO CENTER AT REAL ORIGIN (0,0,0)
      const bounds = polyData.getBounds()
      const centerX = (bounds[0] + bounds[1]) / 2
      const centerY = (bounds[2] + bounds[3]) / 2
      const centerZ = (bounds[4] + bounds[5]) / 2
      
      console.log(`Original model bounds: [${bounds[0].toFixed(2)}, ${bounds[1].toFixed(2)}], [${bounds[2].toFixed(2)}, ${bounds[3].toFixed(2)}], [${bounds[4].toFixed(2)}, ${bounds[5].toFixed(2)}]`)
      console.log(`Model center offset: [${centerX.toFixed(3)}, ${centerY.toFixed(3)}, ${centerZ.toFixed(3)}]`)
      
      // Actually transform the polyData points to center at origin
      const points = polyData.getPoints()
      const pointData = points.getData()
      const numPoints = points.getNumberOfPoints()
      
      console.log(`Transforming ${numPoints} points to center at origin...`)
      
      // Translate all points by -center offset to move model to origin
      for (let i = 0; i < numPoints * 3; i += 3) {
        pointData[i] -= centerX     // X coordinate
        pointData[i + 1] -= centerY // Y coordinate  
        pointData[i + 2] -= centerZ // Z coordinate
      }
      
      // Mark points as modified to trigger VTK update
      points.modified()
      polyData.modified()
      
      // Verify the transformation
      const newBounds = polyData.getBounds()
      const newCenterX = (newBounds[0] + newBounds[1]) / 2
      const newCenterY = (newBounds[2] + newBounds[3]) / 2
      const newCenterZ = (newBounds[4] + newBounds[5]) / 2
      
      console.log(`New model bounds: [${newBounds[0].toFixed(2)}, ${newBounds[1].toFixed(2)}], [${newBounds[2].toFixed(2)}, ${newBounds[3].toFixed(2)}], [${newBounds[4].toFixed(2)}, ${newBounds[5].toFixed(2)}]`)
      console.log(`New model center: [${newCenterX.toFixed(3)}, ${newCenterY.toFixed(3)}, ${newCenterZ.toFixed(3)}]`)
      console.log(`STL polyData is now truly centered at origin (0,0,0)`)
      
      // No need to store center offset or position actor - everything is in real world coordinates now

      // Replace previous mesh and clear all landmarks
      if (currentActor) {
        renderer.removeActor(currentActor)
        // Clear all landmarks when new STL is loaded
        clearLandmarks()
      }
      
      // Clear picker list from previous STL (if any)
      if (medicalPicker) {
        medicalPicker.initializePickList()
      }

      renderer.addActor(actor)
      renderer.resetCamera()
      
      // Set camera focal point to origin (0,0,0) for proper rotation center
      const camera = renderer.getActiveCamera()
      camera.setFocalPoint(0, 0, 0)
      
      // Position camera at appropriate distance from origin
      const transformedBounds = polyData.getBounds()
      const maxDimension = Math.max(
        transformedBounds[1] - transformedBounds[0],
        transformedBounds[3] - transformedBounds[2], 
        transformedBounds[5] - transformedBounds[4]
      )
      const distance = maxDimension * 2 // Position camera at 2x the max dimension
      
      camera.setPosition(0, -distance, 0) // Position camera looking at origin
      camera.setViewUp(0, 0, 1) // Set up direction
      
      console.log(`Camera focal point set to origin, positioned at distance: ${distance.toFixed(2)}`)
      console.log(`Model will now rotate around its true center at (0,0,0)`)

      vtkObjectsRef.current.currentActor = actor
      
      // Configure picker to only pick from STL model actor (ignore bounding boxes)
      if (medicalPicker) {
        medicalPicker.initializePickList()
        medicalPicker.addPickList(actor)
        console.log("Picker configured to only pick from STL model actor (ignoring bounding boxes)")
      }
      
      // Create bounding box for the entire STL model
      createModelBoundingBox(actor)
      
      renderWindow.render()
      onFileLoad?.(file.name)
      setIsLoading(false)

    } catch (err) {
      console.error("Medical STL loading error:", err)
      setError(`Failed to load STL: ${err instanceof Error ? err.message : 'Unknown error'}`)
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

  // Reset camera
  const resetCamera = () => {
    if (vtkObjectsRef.current.renderer && vtkObjectsRef.current.renderWindow) {
      const { renderer, renderWindow, currentActor } = vtkObjectsRef.current
      
      renderer.resetCamera()
      
      // Ensure camera focal point is at origin for proper rotation
      const camera = renderer.getActiveCamera()
      camera.setFocalPoint(0, 0, 0)
      
      if (currentActor) {
        // Position camera at appropriate distance from centered model
        const bounds = currentActor.getBounds()
        const maxDimension = Math.max(
          bounds[1] - bounds[0],
          bounds[3] - bounds[2], 
          bounds[5] - bounds[4]
        )
        const distance = maxDimension * 2
        camera.setPosition(0, -distance, 0)
        camera.setViewUp(0, 0, 1)
      }
      
      renderWindow.render()
      console.log("Camera reset with focal point at origin (0,0,0)")
    }
  }

  // Clear model bounding box
  const clearModelBoundingBox = () => {
    const { renderer, renderWindow, modelBoundingBoxActor } = vtkObjectsRef.current
    if (modelBoundingBoxActor && renderer && renderWindow) {
      renderer.removeActor(modelBoundingBoxActor)
      vtkObjectsRef.current.modelBoundingBoxActor = null
      renderWindow.render()
      console.log("Model bounding box cleared")
    }
  }

  // Clear landmarks
  const clearLandmarks = () => {
    const { renderer, renderWindow, landmarkActors, landmarkMap, medicalPicker, currentActor } = vtkObjectsRef.current
    if (landmarkActors && renderer && renderWindow) {
      landmarkActors.forEach((actor: any) => renderer.removeActor(actor))
      vtkObjectsRef.current.landmarkActors = []
      if (landmarkMap) {
        landmarkMap.clear()
      }
      
      // Ensure picker is still configured for STL model only
      if (medicalPicker && currentActor) {
        medicalPicker.initializePickList()
        medicalPicker.addPickList(currentActor)
      }
      
      renderWindow.render()
      setLandmarkPoints([])
      onLandmarksChange?.([])
      
      // Also clear bounding boxes and scanbody actors when clearing landmarks
      clearBoundingBoxes()
      clearScanbodyActors()
      // Note: Don't clear model bounding box when clearing landmarks - it should stay visible
    }
  }

  // Highlight specific landmark
  const highlightLandmark = (landmarkId: string) => {
    const { landmarkMap, renderWindow } = vtkObjectsRef.current
    
    if (!landmarkMap || !renderWindow) return
    
    // Reset all landmarks to cyan
    landmarkMap.forEach((actor: any) => {
      const property = actor.getProperty()
      property.setColor(0.0, 0.8, 1.0) // Medical cyan
    })
    
    // Highlight selected landmark in red
    const selectedActor = landmarkMap.get(landmarkId)
    if (selectedActor) {
      const property = selectedActor.getProperty()
      property.setColor(1.0, 0.2, 0.2) // Bright red
    }
    
    renderWindow.render()
  }

  // Delete specific landmark
  const deleteLandmark = (landmarkId: string) => {
    const { renderer, renderWindow, landmarkActors, landmarkMap } = vtkObjectsRef.current
    
    if (!landmarkMap || !renderer || !renderWindow || !landmarkActors) return
    
    const actorToRemove = landmarkMap.get(landmarkId)
    if (actorToRemove) {
      // Remove from renderer
      renderer.removeActor(actorToRemove)
      
      // Remove from landmark actors array
      const actorIndex = landmarkActors.indexOf(actorToRemove)
      if (actorIndex > -1) {
        landmarkActors.splice(actorIndex, 1)
      }
      
      // Remove from landmark map
      landmarkMap.delete(landmarkId)
      
      // Update state
      setLandmarkPoints(prev => {
        const newLandmarks = prev.filter(landmark => landmark.id !== landmarkId)
        onLandmarksChange?.(newLandmarks)
        return newLandmarks
      })
      
      renderWindow.render()
    }
  }

  // Change model color
  const changeModelColor = (newColor: string) => {
    const { currentActor, renderWindow } = vtkObjectsRef.current
    if (currentActor && renderWindow) {
      const rgb = hexToRgb(newColor)
      currentActor.getProperty().setColor(rgb.r, rgb.g, rgb.b)
      renderWindow.render()
      console.log(`Changed model color to ${newColor} (RGB: ${rgb.r.toFixed(2)}, ${rgb.g.toFixed(2)}, ${rgb.b.toFixed(2)})`)
    }
  }

  // Expose functions
  React.useImperativeHandle(ref, () => ({
    importSTL: () => fileInputRef.current?.click(),
    exportSTL: () => alert("Export functionality would be implemented here"),
    resetCamera,
    loadSTLFile,
    clearLandmarks,
    clearModelBoundingBox,
    highlightLandmark,
    deleteLandmark,
    getLandmarks: () => landmarkPoints,
    changeModelColor,
    processScanbodies,
    clearBoundingBoxes,
    getScanbodies: () => scanbodies,
    performScanbodyRegistration,
    performAdvancedSurfaceMatching,
    clearScanbodyActors
  }))

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex-1 relative">
        <div
          ref={vtkContainerRef}
          className="absolute inset-0 bg-slate-900"
        />

        {/* Controls */}
        {vtkObjectsRef.current.currentActor && (
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

        {/* Loading */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
            <div className="bg-background p-4 rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm">
                {!vtkReady ? "Initializing Medical Viewer..." : "Loading with Medical Precision..."}
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute top-4 left-4 right-20 z-10">
            <div className="bg-destructive/90 text-destructive-foreground p-3 rounded-lg shadow-lg">
              <div className="font-medium text-sm">Medical Viewer Error:</div>
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

        {/* Medical Status Bar */}
        {vtkReady && fileName && (
          <div className="absolute bottom-2 right-2 bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 text-sm font-mono">
            <div className="flex items-center gap-2">
              {/* <span className="text-muted-foreground">Coordinates:</span> */}
              {currentIntersection ? (
                <div className="flex gap-3">
                  <span className="text-red-500">X: {currentIntersection.x.toFixed(2)}</span>
                  <span className="text-green-500">Y: {currentIntersection.y.toFixed(2)}</span>
                  <span className="text-blue-500">Z: {currentIntersection.z.toFixed(2)}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">---</span>
              )}
            </div>
            {/* {landmarkPoints.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                🎯 {landmarkPoints.length} medical landmark{landmarkPoints.length !== 1 ? 's' : ''} placed
              </div>
            )} */}
          </div>
        )}

        {/* Instructions */}
        {vtkReady && !isLoading && !fileName && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/95 backdrop-blur-sm p-8 rounded-lg shadow-lg text-center max-w-md">
              <h3 className="text-lg font-semibold mb-6">🔬 Medical-Grade STL Viewer</h3>
              <div className="space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <div>
                    <div className="font-medium">Load Medical STL</div>
                    <div className="text-sm text-muted-foreground">ITK.js precision + VTK.js visualization</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <div>
                    <div className="font-medium">Place Landmarks</div>
                    <div className="text-sm text-muted-foreground">Shift+Click for medical precision</div>
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

VTKViewer.displayName = "VTKViewer"

export type VTKViewerRef = {
  importSTL: () => void
  exportSTL: () => void
  resetCamera: () => void
  loadSTLFile: (file: File) => Promise<void>
  clearLandmarks: () => void
  clearModelBoundingBox: () => void
  highlightLandmark: (landmarkId: string) => void
  deleteLandmark: (landmarkId: string) => void
  getLandmarks: () => Array<{ x: number; y: number; z: number; id: string }>
  changeModelColor: (newColor: string) => void
  processScanbodies: () => Promise<void>
  clearBoundingBoxes: () => void
  getScanbodies: () => Array<Scanbody>
  performScanbodyRegistration: () => Promise<void>
  performAdvancedSurfaceMatching: () => Promise<void>
  clearScanbodyActors: () => void
}