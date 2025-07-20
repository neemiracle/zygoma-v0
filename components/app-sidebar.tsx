"use client"

import * as React from "react"
import {
  Upload,
  Download,
  GalleryVerticalEnd,
  Library,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

// STL Viewer specific navigation data
const data = {
  user: {
    name: "STL User",
    email: "user@example.com",
    avatar: "/avatars/user.jpg",
  },
  company: {
    name: "Dental Innovations",
    logo: GalleryVerticalEnd,
    tagline: "Advanced STL Viewer",
  },
  navMain: [
    {
      title: "Import STL",
      url: "#import",
      icon: Upload,
      isActive: true,
      action: "import"
    },
    {
      title: "Library",
      url: "#library",
      icon: Library,
      action: "library"
    },
    {
      title: "Export STL",
      url: "#export",
      icon: Download,
      action: "export"
    },
    // {
    //   title: "View Settings",
    //   url: "#view",
    //   icon: Settings2,
    //   action: "view-settings"
    // },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onImportSTL?: () => void
  onExportSTL?: () => void
  onLibraryOpen?: () => void
  onViewSettingsOpen?: () => void
}

function CompanyLogo({ company }: { company: typeof data.company }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center">
      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <company.logo className="size-4" />
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate font-semibold">{company.name}</span>
        <span className="truncate text-xs text-muted-foreground">{company.tagline}</span>
      </div>
    </div>
  )
}

export function AppSidebar({ onImportSTL, onExportSTL, onLibraryOpen, onViewSettingsOpen, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <CompanyLogo company={data.company} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain 
          items={data.navMain} 
          onImportSTL={onImportSTL}
          onExportSTL={onExportSTL}
          onLibraryOpen={onLibraryOpen}
          onViewSettingsOpen={onViewSettingsOpen}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}