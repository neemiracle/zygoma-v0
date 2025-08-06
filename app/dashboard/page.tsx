"use client"

import { useUser } from "@auth0/nextjs-auth0"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { VTKViewer, type VTKViewerRef } from "@/components/vtk-viewer-medical"
// ITK viewer is now integrated into VTK viewer
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { ColorPopup } from "@/components/color-popup"
import { ImplantLibrary } from "@/components/implant-library"
import { ImplantViewer } from "@/components/implant-viewer"
import { ViewSettingsPopup } from "@/components/view-settings-popup"

function DashboardContent() {
  const { user, isLoading } = useUser()
  const router = useRouter()
  const { state } = useSidebar()
  const vtkViewerRef = useRef<VTKViewerRef>(null)
  // Medical viewer is now integrated into VTK viewer
  const [fileName, setFileName] = useState<string>("")
  const [currentColor, setCurrentColor] = useState<string>("#4F46E5")
  const [showColorPopup, setShowColorPopup] = useState<boolean>(false)
  const [showLibrary, setShowLibrary] = useState<boolean>(false)
  const [selectedImplant, setSelectedImplant] = useState<{
    id: string;
    name: string;
    file: string;
    [key: string]: unknown;
  } | null>(null)
  const [showImplantViewer, setShowImplantViewer] = useState<boolean>(false)
  const [showViewSettings, setShowViewSettings] = useState<boolean>(false)
  const [landmarks, setLandmarks] = useState<Array<{ x: number; y: number; z: number; id: string }>>([])
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<string | undefined>(undefined)

  const sidebarCollapsed = state === "collapsed"

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, isLoading, router])

  // Load saved color from localStorage on component mount
  useEffect(() => {
    const savedColor = localStorage.getItem('stl-viewer-color')
    if (savedColor) {
      setCurrentColor(savedColor)
    }
  }, [])

  // Handle import STL
  const handleImportSTL = () => {
    vtkViewerRef.current?.importSTL()
  }

  // Handle process
  const handleProcess = async () => {
    console.log("Process button clicked")
    if (!fileName) {
      alert("Please load an STL file first")
      return
    }
    if (landmarks.length < 3) {
      alert("Please place at least 3 landmarks first")
      return
    }
    // Process scanbodies - create bounding boxes and perform basic surface registration
    try {
      await vtkViewerRef.current?.processScanbodies()
    } catch (error) {
      console.error("Process failed:", error)
    }
  }

  // Handle Process2 - Advanced Surface Matching
  const handleProcess2 = async () => {
    console.log("Process2 button clicked - Advanced Surface Matching")
    if (!fileName) {
      alert("Please load an STL file first")
      return
    }
    if (landmarks.length < 3) {
      alert("Please place at least 3 landmarks first")
      return
    }
    // Advanced surface-to-surface matching registration
    try {
      await vtkViewerRef.current?.performAdvancedSurfaceMatching()
    } catch (error) {
      console.error("Advanced surface matching failed:", error)
    }
  }

  // Handle export STL  
  const handleExportSTL = () => {
    vtkViewerRef.current?.exportSTL()
  }

  // Handle file load callback (keeping for backwards compatibility)
  const handleFileLoad = (newFileName: string) => {
    handleFileLoadWithImplantClose(newFileName)
    // Apply current color to newly loaded model
    setTimeout(() => {
      vtkViewerRef.current?.changeModelColor(currentColor)
    }, 100) // Small delay to ensure model is loaded
  }

  // Handle color change callback
  const handleColorChange = (newColor: string) => {
    setCurrentColor(newColor)
    // Update the 3D model color
    vtkViewerRef.current?.changeModelColor(newColor)
    // Save color to localStorage
    localStorage.setItem('stl-viewer-color', newColor)
  }

  // Handle close STL
  const handleCloseSTL = () => {
    // Clear the current STL file
    setFileName("")
    // Clear all landmarks and reset selection
    vtkViewerRef.current?.clearLandmarks()
    setLandmarks([])
    setSelectedLandmarkId(undefined)
    // Close implant viewer when main STL closes
    setShowImplantViewer(false)
    setSelectedImplant(null)
  }

  // Handle library open
  const handleLibraryOpen = () => {
    setShowLibrary(true)
  }

  // Handle view settings open
  const handleViewSettingsOpen = () => {
    setShowViewSettings(true)
  }

  // Handle view settings apply
  const handleViewSettingsApply = (settings: Record<string, unknown>) => {
    console.log('Dashboard received settings:', settings)
    // Medical viewer doesn't have applySettings method yet
    console.log('Settings would be applied to medical viewer:', settings)
  }

  // Handle implant selection from library
  const handleImplantSelect = async (implant: { id: string; name: string; file: string; [key: string]: unknown }, manufacturer: string) => {
    try {
      console.log("Loading implant:", implant.name, "from", manufacturer)
      
      // Set selected implant and show implant viewer
      setSelectedImplant(implant)
      setShowImplantViewer(true)
      
      // Close implant viewer when new STL is loaded to main viewer
      // The implant viewer will automatically show the selected implant
    } catch (error) {
      console.error("Failed to load implant:", error)
    }
  }

  // Handle implant viewer close
  const handleImplantViewerClose = () => {
    setShowImplantViewer(false)
    setSelectedImplant(null)
  }

  // Handle file load (also close implant viewer when new main STL is loaded)
  const handleFileLoadWithImplantClose = (newFileName: string) => {
    setFileName(newFileName)
    if (newFileName) {
      // Close implant viewer when new main STL is loaded
      setShowImplantViewer(false)
      setSelectedImplant(null)
      // Clear all landmarks and reset selection when new STL is loaded
      setLandmarks([])
      setSelectedLandmarkId(undefined)
      // The VTK viewer will also clear its internal landmarks via clearLandmarks()
    }
  }

  // Handle landmark click from sidebar
  const handleLandmarkClick = (landmark: { x: number; y: number; z: number; id: string }) => {
    setSelectedLandmarkId(landmark.id)
    vtkViewerRef.current?.highlightLandmark(landmark.id)
  }

  // Handle landmark delete from sidebar
  const handleLandmarkDelete = (landmarkId: string) => {
    vtkViewerRef.current?.deleteLandmark(landmarkId)
    // Update local state - the VTK viewer already updates its internal state
    setLandmarks(prev => prev.filter(landmark => landmark.id !== landmarkId))
    // Clear selection if deleted landmark was selected
    if (selectedLandmarkId === landmarkId) {
      setSelectedLandmarkId(undefined)
    }
  }

  // Handle landmarks change from VTK viewer
  const handleLandmarksChange = (newLandmarks: Array<{ x: number; y: number; z: number; id: string }>) => {
    setLandmarks(newLandmarks)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect via useEffect
  }

  return (
    <>
      <AppSidebar 
        onImportSTL={handleImportSTL}
        onProcess={handleProcess}
        onProcess2={handleProcess2}
        onExportSTL={handleExportSTL}
        onLibraryOpen={handleLibraryOpen}
        onViewSettingsOpen={handleViewSettingsOpen}
        landmarks={landmarks}
        onLandmarkClick={handleLandmarkClick}
        onLandmarkDelete={handleLandmarkDelete}
        selectedLandmarkId={selectedLandmarkId}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            
            {/* File controls when STL is loaded */}
            {fileName && (
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleCloseSTL}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className="text-sm text-muted-foreground">
                  {fileName}
                </div>
                <Button
                  onClick={() => setShowColorPopup(true)}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                >
                  <div 
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: currentColor }}
                  />
                </Button>
              </div>
            )}
          </div>
          <div className="ml-auto px-4">
            <ThemeToggle />
          </div>
        </header>
        
        {/* Medical-Grade VTK+ITK Viewer */}
        {/* <div className="border-b px-4 py-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">🔬 Medical-Grade Viewer</h2>
          <div className="text-xs text-muted-foreground">
            VTK Visualization + ITK Precision
          </div>
        </div> */}

        {/* Full-height Medical Viewer */}
        <div className="flex-1 flex flex-col">
          <VTKViewer 
            ref={vtkViewerRef}
            className="flex-1" 
            onFileLoad={handleFileLoad}
            onColorChange={handleColorChange}
            currentColor={currentColor}
            fileName={fileName}
            onLandmarksChange={handleLandmarksChange}
          />
        </div>
        
        {/* Color Popup */}
        <ColorPopup 
          open={showColorPopup}
          onOpenChange={setShowColorPopup}
          currentColor={currentColor}
          onColorChange={handleColorChange}
        />
        
        {/* Implant Library Popup */}
        <ImplantLibrary
          open={showLibrary}
          onOpenChange={setShowLibrary}
          onImplantSelect={handleImplantSelect}
        />
        
        {/* Implant Viewer - Bottom Left Corner */}
        <ImplantViewer
          implant={selectedImplant}
          isVisible={showImplantViewer}
          onClose={handleImplantViewerClose}
          sidebarCollapsed={sidebarCollapsed}
        />
        
        {/* View Settings Popup */}
        <ViewSettingsPopup
          open={showViewSettings}
          onOpenChange={setShowViewSettings}
          onApplySettings={handleViewSettingsApply}
        />
      </SidebarInset>
    </>
  )
}

export default function Dashboard() {
  return (
    <SidebarProvider>
      <DashboardContent />
    </SidebarProvider>
  )
}