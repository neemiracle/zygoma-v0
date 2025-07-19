"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  onImportSTL,
  onExportSTL,
  onLibraryOpen,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    action?: string
    items?: {
      title: string
      url: string
    }[]
  }[]
  onImportSTL?: () => void
  onExportSTL?: () => void
  onLibraryOpen?: () => void
}) {
  const handleItemClick = (item: typeof items[0]) => {
    if (item.action === "import") {
      onImportSTL?.()
    } else if (item.action === "export") {
      onExportSTL?.()
    } else if (item.action === "library") {
      onLibraryOpen?.()
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>STL Tools</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          // If item has action but no items, render as a button
          if (item.action && !item.items) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  tooltip={item.title}
                  onClick={() => handleItemClick(item)}
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          // If item has items, render as collapsible
          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild>
                          <a href={subItem.url}>
                            <span>{subItem.title}</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}