"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Monitor, Lightbulb, Palette, Camera } from "lucide-react"

interface ViewSettingsPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplySettings?: (settings: any) => void
}

export function ViewSettingsPopup({ open, onOpenChange, onApplySettings }: ViewSettingsPopupProps) {
  const [displaySettings, setDisplaySettings] = useState({
    wireframe: false,
    showGrid: false,
    showAxes: false,
    transparency: [100], // 100% = fully opaque (VTK default)
  })

  const [lightingSettings, setLightingSettings] = useState({
    intensity: [100], // VTK default intensity
    ambientLight: [10], // VTK default ambient is low
    shadows: false, // VTK default has no shadows
    autoRotate: false,
  })

  const [materialSettings, setMaterialSettings] = useState({
    metallic: [0], // VTK default is non-metallic
    roughness: [50], // VTK default roughness
    reflectance: [4], // VTK default reflectance
    surfaceType: "default", // Generic default material
  })

  const [cameraSettings, setCameraSettings] = useState({
    fieldOfView: [30], // VTK default field of view
    perspective: "perspective",
    autoFit: false, // VTK doesn't auto-fit by default
  })

  // Apply settings function (connect to VTK viewer)
  const applySettings = () => {
    const settings = {
      display: displaySettings,
      lighting: lightingSettings,
      material: materialSettings,
      camera: cameraSettings,
    }
    
    console.log('Applying settings to VTK viewer:', settings)
    
    // Call the parent's settings application function
    onApplySettings?.(settings)
    
    // Close the popup after applying
    onOpenChange(false)
  }

  const resetToDefaults = () => {
    setDisplaySettings({
      wireframe: false,
      showGrid: false,
      showAxes: false,
      transparency: [100], // 100% = fully opaque (VTK default)
    })
    setLightingSettings({
      intensity: [100], // VTK default intensity
      ambientLight: [10], // VTK default ambient is low
      shadows: false, // VTK default has no shadows
      autoRotate: false,
    })
    setMaterialSettings({
      metallic: [0], // VTK default is non-metallic
      roughness: [50], // VTK default roughness
      reflectance: [4], // VTK default reflectance
      surfaceType: "default", // Generic default material
    })
    setCameraSettings({
      fieldOfView: [30], // VTK default field of view
      perspective: "perspective",
      autoFit: false, // VTK doesn't auto-fit by default
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] h-[90vh] flex flex-col p-0 md:max-w-4xl lg:max-w-5xl">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>View Settings</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden">
          <Tabs defaultValue="display" className="flex-1 flex" orientation="vertical">
            {/* Left Sidebar Navigation */}
            <div className="w-60 border-r bg-muted/20 flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-medium text-sm text-muted-foreground">Categories</h3>
              </div>
              <TabsList className="flex-col h-auto bg-transparent p-1 gap-1 m-1">
                <TabsTrigger 
                  value="display" 
                  className="w-full justify-start gap-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Monitor className="h-4 w-4" />
                  <span>Display</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="lighting" 
                  className="w-full justify-start gap-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Lightbulb className="h-4 w-4" />
                  <span>Lighting</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="materials" 
                  className="w-full justify-start gap-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Palette className="h-4 w-4" />
                  <span>Materials</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="camera" 
                  className="w-full justify-start gap-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Camera className="h-4 w-4" />
                  <span>Camera</span>
                </TabsTrigger>
              </TabsList>
            </div>
            
            {/* Right Panel Content */}
            <div className="flex-1 overflow-auto p-6">
                <TabsContent value="display" className="mt-0 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Display Options</h3>
                    <p className="text-sm text-muted-foreground mb-4">Control how your STL models are displayed</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="wireframe" className="text-sm font-medium">Wireframe Mode</Label>
                        <p className="text-xs text-muted-foreground">Show model as wireframe outline</p>
                      </div>
                      <Switch 
                        id="wireframe"
                        checked={displaySettings.wireframe}
                        onCheckedChange={(checked) => 
                          setDisplaySettings(prev => ({ ...prev, wireframe: checked }))
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="showGrid" className="text-sm font-medium">Show Grid</Label>
                        <p className="text-xs text-muted-foreground">Display reference grid</p>
                      </div>
                      <Switch 
                        id="showGrid"
                        checked={displaySettings.showGrid}
                        onCheckedChange={(checked) => 
                          setDisplaySettings(prev => ({ ...prev, showGrid: checked }))
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="showAxes" className="text-sm font-medium">Show Axes</Label>
                        <p className="text-xs text-muted-foreground">Display coordinate axes</p>
                      </div>
                      <Switch 
                        id="showAxes"
                        checked={displaySettings.showAxes}
                        onCheckedChange={(checked) => 
                          setDisplaySettings(prev => ({ ...prev, showAxes: checked }))
                        }
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Transparency</Label>
                        <p className="text-xs text-muted-foreground">Adjust model opacity</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Transparent</span>
                          <span className="font-medium">{displaySettings.transparency[0]}%</span>
                          <span>Opaque</span>
                        </div>
                        <Slider
                          value={displaySettings.transparency}
                          onValueChange={(value) => 
                            setDisplaySettings(prev => ({ ...prev, transparency: value }))
                          }
                          max={100}
                          min={0}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="lighting" className="mt-0 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Lighting Settings</h3>
                    <p className="text-sm text-muted-foreground mb-4">Adjust lighting to enhance model visibility</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Light Intensity</Label>
                        <p className="text-xs text-muted-foreground">Overall brightness of the main light</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Dim</span>
                          <span className="font-medium">{lightingSettings.intensity[0]}%</span>
                          <span>Bright</span>
                        </div>
                        <Slider
                          value={lightingSettings.intensity}
                          onValueChange={(value) => 
                            setLightingSettings(prev => ({ ...prev, intensity: value }))
                          }
                          max={100}
                          min={10}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Ambient Light</Label>
                        <p className="text-xs text-muted-foreground">Background illumination level</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Dark</span>
                          <span className="font-medium">{lightingSettings.ambientLight[0]}%</span>
                          <span>Bright</span>
                        </div>
                        <Slider
                          value={lightingSettings.ambientLight}
                          onValueChange={(value) => 
                            setLightingSettings(prev => ({ ...prev, ambientLight: value }))
                          }
                          max={100}
                          min={0}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="shadows" className="text-sm font-medium">Enable Shadows</Label>
                        <p className="text-xs text-muted-foreground">Cast shadows for depth perception</p>
                      </div>
                      <Switch 
                        id="shadows"
                        checked={lightingSettings.shadows}
                        onCheckedChange={(checked) => 
                          setLightingSettings(prev => ({ ...prev, shadows: checked }))
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="autoRotate" className="text-sm font-medium">Auto Rotate Light</Label>
                        <p className="text-xs text-muted-foreground">Automatically rotate light source</p>
                      </div>
                      <Switch 
                        id="autoRotate"
                        checked={lightingSettings.autoRotate}
                        onCheckedChange={(checked) => 
                          setLightingSettings(prev => ({ ...prev, autoRotate: checked }))
                        }
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="materials" className="mt-0 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Material Properties</h3>
                    <p className="text-sm text-muted-foreground mb-4">Customize surface appearance and material properties</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm font-medium">Surface Type</Label>
                        <p className="text-xs text-muted-foreground">Predefined material presets</p>
                      </div>
                      <Select 
                        value={materialSettings.surfaceType}
                        onValueChange={(value) => 
                          setMaterialSettings(prev => ({ ...prev, surfaceType: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="titanium">Titanium</SelectItem>
                          <SelectItem value="stainless-steel">Stainless Steel</SelectItem>
                          <SelectItem value="ceramic">Ceramic</SelectItem>
                          <SelectItem value="plastic">Medical Plastic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Metallic</Label>
                        <p className="text-xs text-muted-foreground">How metallic the surface appears</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Matte</span>
                          <span className="font-medium">{materialSettings.metallic[0]}%</span>
                          <span>Metallic</span>
                        </div>
                        <Slider
                          value={materialSettings.metallic}
                          onValueChange={(value) => 
                            setMaterialSettings(prev => ({ ...prev, metallic: value }))
                          }
                          max={100}
                          min={0}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Roughness</Label>
                        <p className="text-xs text-muted-foreground">Surface texture and finish</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Smooth</span>
                          <span className="font-medium">{materialSettings.roughness[0]}%</span>
                          <span>Rough</span>
                        </div>
                        <Slider
                          value={materialSettings.roughness}
                          onValueChange={(value) => 
                            setMaterialSettings(prev => ({ ...prev, roughness: value }))
                          }
                          max={100}
                          min={0}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Reflectance</Label>
                        <p className="text-xs text-muted-foreground">Light reflection intensity</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Low</span>
                          <span className="font-medium">{materialSettings.reflectance[0]}%</span>
                          <span>High</span>
                        </div>
                        <Slider
                          value={materialSettings.reflectance}
                          onValueChange={(value) => 
                            setMaterialSettings(prev => ({ ...prev, reflectance: value }))
                          }
                          max={100}
                          min={0}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="camera" className="mt-0 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Camera Settings</h3>
                    <p className="text-sm text-muted-foreground mb-4">Configure camera behavior and perspective</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm font-medium">Projection Type</Label>
                        <p className="text-xs text-muted-foreground">Camera projection method</p>
                      </div>
                      <Select 
                        value={cameraSettings.perspective}
                        onValueChange={(value) => 
                          setCameraSettings(prev => ({ ...prev, perspective: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="perspective">Perspective</SelectItem>
                          <SelectItem value="orthographic">Orthographic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Field of View</Label>
                        <p className="text-xs text-muted-foreground">Camera viewing angle</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Narrow</span>
                          <span className="font-medium">{cameraSettings.fieldOfView[0]}°</span>
                          <span>Wide</span>
                        </div>
                        <Slider
                          value={cameraSettings.fieldOfView}
                          onValueChange={(value) => 
                            setCameraSettings(prev => ({ ...prev, fieldOfView: value }))
                          }
                          max={120}
                          min={10}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="autoFit" className="text-sm font-medium">Auto-fit on Load</Label>
                        <p className="text-xs text-muted-foreground">Automatically fit model in view</p>
                      </div>
                      <Switch 
                        id="autoFit"
                        checked={cameraSettings.autoFit}
                        onCheckedChange={(checked) => 
                          setCameraSettings(prev => ({ ...prev, autoFit: checked }))
                        }
                      />
                    </div>
                  </div>
                </TabsContent>
            </div>
          </Tabs>
        </div>
        
        <DialogFooter className="px-6 py-4 border-t flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={resetToDefaults} className="w-full sm:w-auto">
            Reset to Defaults
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button onClick={applySettings} className="flex-1 sm:flex-none">
              Apply Settings
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}