# Landmark Creation Debugging Guide

## Current Status: Enhanced Debugging Added

The medical VTK viewer now has comprehensive debugging for landmark creation to identify exactly why landmarks aren't appearing.

## Expected Console Flow

### 1. When you Shift+Click on STL surface:

```
🔬 Medical landmark placement at: {x: 410, y: 244, rect: {width: 800, height: 600}}
🔍 Attempting pick at screen coords: {x: 410, y: 244, z: 0, tolerance: 0.01, pickFromList: false, rendererActorCount: 1}
📋 Pick result: {pickPosition: [12.345, -8.912, 15.678], hasValidPosition: true, isNonZero: true, allActors: 1}
🎯 Medical pick successful: {screenCoords: [410, 244, 0], worldPosition: [12.34500, -8.91200, 15.67800], rawPosition: [12.345, -8.912, 15.678]}
```

### 2. Landmark Creation Process:

```
🏗️ Creating medical landmark: {x: 12.34500, y: -8.91200, z: 15.67800, id: "medical_1234567890"}
🔍 Landmark creation state: {
  hasCurrentActor: true,
  hasRenderer: true, 
  hasRenderWindow: true,
  hasVtkSphereSource: true,
  hasVtkActor: true,
  hasVtkMapper: true
}
🎯 Landmark sphere created: {position: [12.34500, -8.91200, 15.67800], radius: 0.025, bounds: [x1, x2, y1, y2, z1, z2]}
✅ Landmark added to scene: {totalLandmarks: 1, totalActors: 2}
```

## Troubleshooting Based on Output

### If you see "❌ Cannot create landmark: No current actor"
- **Issue**: STL file isn't loaded properly
- **Solution**: Make sure STL is fully loaded before clicking

### If landmark creation completes but no visual landmark appears:
- **Check**: `radius` value in "Landmark sphere created" - might be too small
- **Check**: `totalActors` should increase after landmark creation
- **Possible Issue**: Landmark positioned outside camera view

### If picker fails:
- **Check**: `allActors: 1` confirms STL is loaded
- **Check**: `hasValidPosition: true` and `isNonZero: true` 
- **If false**: Coordinate system or tolerance issue

## Success Indicators

✅ **Pick Success**: `hasValidPosition: true, isNonZero: true`
✅ **Creation Success**: All "has*" properties are `true` in landmark creation state
✅ **Rendering Success**: `totalActors` increases after landmark creation
✅ **Visual Success**: Blue/cyan sphere appears on STL surface

## Test Steps

1. **Load STL file** - Wait for "✅ STL actor added to renderer" message
2. **Shift+Click on STL surface** - Should see full console flow above
3. **Check camera angle** - Landmark might be created but outside view
4. **Try different STL areas** - Some surfaces might pick better than others

The comprehensive debugging will show exactly where in the pipeline the landmark creation is failing!