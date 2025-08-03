# VTK Picker Debugging Guide

## Current Status: Enhanced Debugging

The medical VTK picker now includes comprehensive debugging to identify why landmarks aren't appearing where clicked.

## Debug Output to Look For

### 1. When Hovering Over STL
```
🔍 Attempting pick at screen coords: {
  x: 355, y: 217, z: 0,
  tolerance: 0.01,
  pickFromList: false,
  rendererActorCount: 1
}
```
**Check**: `rendererActorCount` should be 1 (meaning STL is loaded)

### 2. Pick Result Analysis
```
📋 Pick result: {
  success: false,
  pickPosition: [0, 0, 0],
  pickedActor: false,
  allActors: 1
}
```
**Check**: If `success: false` but `allActors: 1`, the picker isn't hitting the geometry

### 3. Alternative Coordinate Info
```
🔄 Trying alternative coordinate conversion...
📐 Render window size: [800, 600] Pick coords: [355, 217]
🔢 NDC coordinates: {ndcX: -0.1125, ndcY: -0.2767}
```
**Check**: Render window size vs pick coordinates for scaling issues

### 4. STL Loading Confirmation
```
✅ STL actor added to renderer: {
  actorCount: 1,
  bounds: [x1, x2, y1, y2, z1, z2]
}
```
**Check**: `bounds` array shows the STL geometry dimensions

## Troubleshooting Steps

### If `rendererActorCount: 0`
- STL file isn't loaded yet
- Actor wasn't added to renderer

### If `success: false` with `allActors: 1`
- **Most likely**: Coordinate system issue
- **Possible**: Tolerance too small (now increased to 0.01)
- **Possible**: Y-coordinate flipping still wrong

### If `success: true` but no landmarks appear
- Pick position calculation issue
- Landmark creation/rendering problem

## Enhanced Fixes Applied

1. **Increased Tolerance**: `0.0001` → `0.01` for better hit detection
2. **Disabled Pick List**: Now picks from all actors instead of restricted list
3. **Enhanced Logging**: Detailed picker state and coordinate info
4. **Alternative Coordinates**: NDC calculation for troubleshooting
5. **Actor Validation**: Confirms STL is properly loaded to renderer

## Next Steps Based on Console Output

1. **Load STL file** and check console for loading confirmation
2. **Hover over STL** to see coordinate tracking attempts  
3. **Shift+Click on STL** to see landmark placement attempts
4. **Share console output** for specific troubleshooting

The comprehensive debugging will help identify exactly where the picking pipeline is failing.