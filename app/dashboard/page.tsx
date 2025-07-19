"use client"

import { useUser } from "@auth0/nextjs-auth0"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { VTKViewer, type VTKViewerRef } from "@/components/vtk-viewer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Palette } from "lucide-react"

export default function Dashboard() {
  const { user, isLoading } = useUser()
  const router = useRouter()
  const vtkViewerRef = useRef<VTKViewerRef>(null)
  const [fileName, setFileName] = useState<string>("")
  const [currentColor, setCurrentColor] = useState<string>("#4F46E5")

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, isLoading, router])

  // Handle import STL
  const handleImportSTL = () => {
    vtkViewerRef.current?.importSTL()
  }

  // Handle export STL  
  const handleExportSTL = () => {
    vtkViewerRef.current?.exportSTL()
  }

  // Handle file load callback
  const handleFileLoad = (newFileName: string) => {
    setFileName(newFileName)
  }

  // Handle color change callback
  const handleColorChange = (newColor: string) => {
    setCurrentColor(newColor)
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
    <SidebarProvider>
      <AppSidebar 
        onImportSTL={handleImportSTL}
        onExportSTL={handleExportSTL}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">
                    STL Viewer
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>3D Viewer</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            
            {/* File name and color selector next to breadcrumbs */}
            {fileName && (
              <>
                <Separator orientation="vertical" className="mx-2 h-4" />
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground">
                    {fileName}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="color-picker" className="sr-only">
                      Model Color
                    </Label>
                    <div className="flex items-center gap-1">
                      <Palette className="w-4 h-4 text-muted-foreground" />
                      <Input
                        id="color-picker"
                        type="color"
                        value={currentColor}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="w-8 h-8 p-1 border rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </>
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
      </SidebarInset>
    </SidebarProvider>
  )
}