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
import { VTKViewer, type VTKViewerRef } from "@/components/vtk-viewer"
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
  const [fileName, setFileName] = useState<string>("")
  const [currentColor, setCurrentColor] = useState<string>("#4F46E5")
  const [showColorPopup, setShowColorPopup] = useState<boolean>(false)
  const [showLibrary, setShowLibrary] = useState<boolean>(false)
  const [selectedImplant, setSelectedImplant] = useState<any>(null)
  const [showImplantViewer, setShowImplantViewer] = useState<boolean>(false)
  const [showViewSettings, setShowViewSettings] = useState<boolean>(false)

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

  // Handle export STL  
  const handleExportSTL = () => {
    vtkViewerRef.current?.exportSTL()
  }

  // Handle file load callback (keeping for backwards compatibility)
  const handleFileLoad = (newFileName: string) => {
    handleFileLoadWithImplantClose(newFileName)
  }

  // Handle color change callback
  const handleColorChange = (newColor: string) => {
    setCurrentColor(newColor)
    // Save color to localStorage
    localStorage.setItem('stl-viewer-color', newColor)
  }

  // Handle close STL
  const handleCloseSTL = () => {
    // Clear the current STL file
    setFileName("")
    // Clear the VTK viewer
    vtkViewerRef.current?.clearSTL()
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
  const handleViewSettingsApply = (settings: any) => {
    console.log('Dashboard received settings:', settings)
    vtkViewerRef.current?.applySettings(settings)
  }

  // Handle implant selection from library
  const handleImplantSelect = async (implant: any, manufacturer: string) => {
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
    }
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
        onExportSTL={handleExportSTL}
        onLibraryOpen={handleLibraryOpen}
        onViewSettingsOpen={handleViewSettingsOpen}
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
        
        {/* Full-height VTK Viewer */}
        <div className="flex-1 flex flex-col">
          <VTKViewer 
            ref={vtkViewerRef}
            className="flex-1" 
            onFileLoad={handleFileLoad}
            onColorChange={handleColorChange}
            currentColor={currentColor}
            fileName={fileName}
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