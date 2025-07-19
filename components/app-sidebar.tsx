"use client"

import * as React from "react"
import {
  AudioWaveform,
  Upload,
  Download,
  Command,
  FolderOpen,
  GalleryVerticalEnd,
  Library,
  FileText,
  Settings2,
  Palette,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
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
  teams: [
    {
      name: "STL Viewer",
      logo: GalleryVerticalEnd,
      plan: "Pro",
    },
    {
      name: "3D Workshop",
      logo: AudioWaveform,
      plan: "Team",
    },
    {
      name: "Design Studio",
      logo: Command,
      plan: "Enterprise",
    },
  ],
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
      items: [
        {
          title: "All Models",
          url: "#all-models",
        },
        {
          title: "Favorites",
          url: "#favorites",
        },
        {
          title: "Collections",
          url: "#collections",
        },
        {
          title: "Search",
          url: "#search",
        },
      ],
    },
    {
      title: "Export STL",
      url: "#export",
      icon: Download,
      action: "export"
    },
    {
      title: "View Settings",
      url: "#view",
      icon: Settings2,
      items: [
        {
          title: "Display Options",
          url: "#display",
        },
        {
          title: "Lighting",
          url: "#lighting",
        },
        {
          title: "Materials",
          url: "#materials",
        },
        {
          title: "Camera",
          url: "#camera",
        },
      ],
    },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onImportSTL?: () => void
  onExportSTL?: () => void
}

export function AppSidebar({ onImportSTL, onExportSTL, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain 
          items={data.navMain} 
          onImportSTL={onImportSTL}
          onExportSTL={onExportSTL}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}