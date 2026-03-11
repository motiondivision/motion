# Motion Projection System

This document provides a comprehensive overview of Motion's layout animation projection system, including its architecture, data flow, identified performance issues, and potential improvements.

## Overview

The projection system implements **FLIP animations** (First, Last, Invert, Play) to animate elements when their layout changes. It allows elements to smoothly transition between positions without triggering expensive layout recalculations during the animation.

### Core Concept

1. **Snapshot** the element's current position before a layout change
2. **Measure** the element's new position after the layout change
3. **Calculate** the transform delta needed to make the element appear in its old position
4. **Animate** the transform from the old position to the new position (identity transform)

## Architecture

```
projection/
├── node/
│   ├── create-projection-node.ts   # Main implementation (~2360 lines)
│   ├── types.ts                    # IProjectionNode interface
│   ├── HTMLProjectionNode.ts       # HTML element configuration
│   ├── DocumentProjectionNode.ts   # Document root configuration
│   ├── state.ts                    # Global projection state
│   └── group.ts                    # LayoutGroup coordination
│
├── geometry/
│   ├── models.ts                   # createBox(), createDelta(), createAxis()
│   ├── delta-calc.ts               # calcAxisDelta(), calcBoxDelta()
│   ├── delta-apply.ts              # applyAxisDelta(), applyTreeDeltas()
│   ├── delta-remove.ts             # removeBoxTransforms()
│   ├── conversion.ts               # BoundingBox ↔ Box conversions
│   ├── copy.ts                     # copyBoxInto(), copyAxisDeltaInto()
│   ├── utils.ts                    # boxEquals(), isDeltaZero()
│   └── pool.ts                     # Object pooling
│
├── shared/
│   └── stack.ts                    # NodeStack for lead/follow management
│
├── styles/
│   ├── transform.ts                # buildProjectionTransform()
│   ├── scale-correction.ts         # Scale correction for border-radius, etc.
│   └── scale-border-radius.ts      # Border radius scale correction
│
├── animation/
│   └── mix-values.ts               # Crossfade opacity, mix values
│
└── utils/
    ├── measure.ts                  # measureViewportBox(), measurePageBox()
    ├── has-transform.ts            # hasTransform(), hasScale()
    └── each-axis.ts                # Axis iteration helper
```

## Key Data Structures

### Box and Axis

```typescript
interface Axis {
    min: number  // Left/top edge position
    max: number  // Right/bottom edge position
}

interface Box {
    x: Axis  // Horizontal axis
    y: Axis  // Vertical axis
}
```

### Delta and AxisDelta

```typescript
interface AxisDelta {
    translate: number   // Translation in pixels
    scale: number       // Scale factor (1 = no scale)
    origin: number      // Origin point (0-1, default 0.5)
    originPoint: number // Calculated origin in pixels
}

interface Delta {
    x: AxisDelta
    y: AxisDelta
}
```

### IProjectionNode

The central interface for projection nodes:

```typescript
interface IProjectionNode {
    // Identity
    id: number
    depth: number

    // Hierarchy
    parent?: IProjectionNode
    root: IProjectionNode
    children: Set<IProjectionNode>
    path: IProjectionNode[]  // Fast path to root

    // Layout data
    layout?: Measurements        // Current layout
    snapshot?: Measurements      // Layout before animation
    layoutCorrected: Box         // Layout with parent transforms applied

    // Target data
    target?: Box                 // Where we want element to appear
    targetDelta?: Delta          // Delta to apply to reach target
    relativeTarget?: Box         // Target relative to parent

    // Projection data
    projectionDelta?: Delta      // Calculated projection transform
    treeScale: Point             // Cumulative scale from ancestors

    // Dirty flags
    isLayoutDirty: boolean
    isProjectionDirty: boolean
    isSharedProjectionDirty: boolean
    isTransformDirty: boolean
}
```

## Update Cycle

The projection system uses a multi-phase update cycle:

### Phase 1: Snapshot (`willUpdate()`)

Called before a layout change is expected:
- Increments `animationId`
- Marks ancestors for transform reset
- Takes a `snapshot` of current layout
- Notifies `"willUpdate"` listeners

### Phase 2: Layout Measurement (`update()`)

Called after React renders (via microtask):
- Resets transforms on all nodes (`resetTransformStyle`)
- Measures new layouts (`updateLayout`)
- Notifies layout changes (`notifyLayoutUpdate`)
- Triggers animations if layout changed

### Phase 3: Projection Calculation (`updateProjection()`)

Called every frame during animation (via `frame.preRender`):
```typescript
this.nodes.forEach(propagateDirtyNodes)  // Propagate dirty flags
this.nodes.forEach(resolveTargetDelta)   // Calculate targets
this.nodes.forEach(calcProjection)       // Calculate projections
this.nodes.forEach(cleanDirtyNodes)      // Reset flags
```

### Phase 4: Style Application (`applyProjectionStyles()`)

Called during render to apply projection transforms:
- Builds CSS transform string
- Applies scale corrections (border-radius, box-shadow)
- Handles opacity for shared layout animations

## FlatTree Iteration

Nodes are stored in a `FlatTree` which sorts by depth:

```typescript
class FlatTree {
    private children: WithDepth[] = []
    private isDirty: boolean = false

    forEach(callback) {
        this.isDirty && this.children.sort(compareByDepth)
        this.isDirty = false
        this.children.forEach(callback)
    }
}
```

Sorting ensures parents are processed before children, which is critical for:
- Correct `treeScale` propagation
- Parent target resolution before child calculations
- Proper dirty flag inheritance

## Shared Layout Animations

When elements share a `layoutId`, they can animate between different DOM locations:

### NodeStack

```typescript
class NodeStack {
    lead?: IProjectionNode      // Currently visible node
    prevLead?: IProjectionNode  // Previously visible node
    members: IProjectionNode[]  // All nodes with same layoutId
}
```

### Lead/Follow Pattern

1. New element with `layoutId` mounts → becomes the **lead**
2. Previous lead becomes the **follow** (via `resumeFrom`)
3. Animation interpolates between follow's snapshot and lead's target
4. Optional crossfade handles opacity transitions

## Coordinate Systems

The system uses three coordinate systems:

1. **Viewport-relative**: From `getBoundingClientRect()`, relative to visible viewport
2. **Page-relative**: Viewport + scroll offset, relative to document
3. **Parent-relative**: Position relative to projecting parent

### Current Flow (problematic)

```
measureViewportBox()     → viewport-relative
    ↓
+ root scroll offset     → page-relative (inconsistent)
    ↓
removeElementScroll()    → iterates path to remove ancestor scroll
    ↓
removeTransform()        → removes ancestor transforms
```

The transitions between these systems are ad-hoc and involve multiple path iterations.

## Tree Transform Application

The `applyTreeDeltas()` function applies ancestor transforms to a node's layout:

```typescript
function applyTreeDeltas(box, treeScale, treePath, isSharedTransition) {
    treeScale.x = treeScale.y = 1

    for (let i = 0; i < treePath.length; i++) {
        const node = treePath[i]
        const delta = node.projectionDelta

        if (delta) {
            treeScale.x *= delta.x.scale
            treeScale.y *= delta.y.scale
            applyBoxDelta(box, delta)
        }
    }
}
```

This is O(depth) per node, making full tree traversal O(n × avg_depth).

---

# Identified Performance Issues

## 1. Object Allocation Patterns

**Note**: Microbenchmarks show object pooling is ~30-95% *slower* than V8's native allocation. The issue isn't allocation speed—it's GC pauses during animation. The goal is to allocate at animation start, not every frame.

### Per-Frame Allocation (Critical - Causes GC During Animation)

**`resolveTargetDelta()` when `resumingFrom` - Line 1253-1255**
```typescript
if (Boolean(this.resumingFrom)) {
    // TODO: This is creating a new object every frame
    this.target = this.applyTransform(this.layout.layoutBox)
}
```
Calls `applyTransform()` which creates new Box every frame during shared layout animations. **This is the most critical issue.**

### Per-Measurement Allocation (Less Critical - Only During Layout Updates)

These are called during `measure()`, not every animation frame:

**`removeElementScroll()` - Line 1016-1018**
```typescript
const boxWithoutScroll = createBox()  // Per measurement
```

**`applyTransform()` - Line 1049-1051**
```typescript
const withTransforms = createBox()  // Per call (also used per-frame above!)
```

**`removeTransform()` - Lines 1078-1091**
```typescript
const boxWithoutTransform = createBox()
for (let i = 0; i < this.path.length; i++) {
    const sourceBox = createBox()  // O(depth) allocations per measurement!
}
```

### Per-Animation-Start Allocation (Acceptable)

These create objects once at animation start, then reuse via closure capture:

**`setAnimationOrigin()` - Lines 1550-1561**
```typescript
const mixedValues = { ...this.latestValues }  // Once per animation
const targetDelta = createDelta()             // Captured, reused every frame
const relativeLayout = createBox()            // Captured, reused every frame
```
This pattern is good—objects are allocated once, then reused throughout the animation.

### Per-Node Allocation (One-Time - Fine)

**Constructor - Line 411**
```typescript
this.path = parent ? [...parent.path, parent] : []  // Once per node creation
```

**`updateLayout()` - Line 899**
```typescript
this.layoutCorrected = createBox()  // Once per layout measurement
```

## 2. O(depth) Path Iterations (Multiple Per Node)

Each node iterates through its full path multiple times per frame:

| Function | Line | Iterations | When Called |
|----------|------|------------|-------------|
| `applyTreeDeltas()` | 1418-1423 | O(depth) | Every dirty node |
| `removeElementScroll()` | 1028-1044 | O(depth) | Every measurement |
| `applyTransform()` | 1052-1073 | 2 × O(depth) | Shared transitions |
| `removeTransform()` | 1082-1099 | O(depth) | Measurements |
| `getClosestProjectingParent()` | 1300-1313 | O(depth) | Target resolution |
| `path.some()` calls | 1002, 1572 | O(depth) | Various checks |

Total: Up to 7 × O(depth) iterations per node per frame.

## 3. Coordinate System Inconsistencies

### `measurePageBox()` - Lines 995-1013
- Measures viewport-relative via `getBoundingClientRect()`
- Adds root scroll to convert to page-relative
- But only if NOT in a scroll root (line 1004)

### `removeElementScroll()` - Lines 1020-1047
- Uses `scroll.wasRoot` to handle scroll root transitions
- Special case at line 1037-1039 for new scroll roots
- Resets accumulated scroll when entering scroll root

### `applyTreeDeltas()` - delta-apply.ts lines 109-119
- Special handling for `isSharedTransition` and scroll
- Different logic for scrolled containers in shared transitions

The lack of a formal coordinate system model leads to:
- Redundant transformations
- Edge cases around scroll roots
- Difficulty reasoning about correctness

## 4. FlatTree Iteration Limitations

The depth-sorted iteration works for standard layout animations but has issues with shared layouts:

### Lead at Different Depth
```typescript
// resolveTargetDelta() - Lines 1160-1163
const lead = this.getLead()
this.isProjectionDirty ||= lead.isProjectionDirty
this.isTransformDirty ||= lead.isTransformDirty
```

If the lead is at a greater depth, it may not have been processed yet in the current iteration pass.

### Solution Attempts
The code uses `forceRelativeParentToResolveTarget()` (line 1133-1148) to force ancestor recalculation, but this can cause redundant work.

## 5. No Cumulative Transform Caching

Each node recalculates accumulated transforms from the root every frame:

```typescript
// calcProjection() calls applyTreeDeltas which walks full path
applyTreeDeltas(
    this.layoutCorrected,
    this.treeScale,
    this.path,
    isShared
)
```

A cumulative approach could store the accumulated transform at each node and only update when dirty, reducing O(depth) to O(1) for unchanged ancestors.

## 6. String Building Every Frame

`buildProjectionTransform()` (styles/transform.ts) builds strings via concatenation:

```typescript
let transform = ""
if (xTranslate || yTranslate || zTranslate) {
    transform = `translate3d(${xTranslate}px, ${yTranslate}px, ${zTranslate}px) `
}
if (treeScale.x !== 1 || treeScale.y !== 1) {
    transform += `scale(${1 / treeScale.x}, ${1 / treeScale.y}) `
}
// ... more concatenation
```

## 7. Redundant Renders

`resetSkewAndRotation()` (lines 1846-1916) triggers two renders:
```typescript
visualElement.render()         // Immediate render
// ...
visualElement.scheduleRender() // Scheduled render
```

---

# Potential Improvements

## 1. Retain Objects on Active Nodes (Not Pooling)

**Important**: Microbenchmarks show object pooling is actually ~30-95% *slower* than V8's native allocation due to pool overhead. The real goal is to **avoid allocating during animation frames** - not to pool objects.

The system already does this correctly in some places:
- `createProjectionDeltas()` (line 1529-1533) creates deltas once at animation start
- `setAnimationOrigin()` (line 1544) captures `targetDelta` and `relativeLayout` in a closure, reusing them every frame

### Problem Areas (Per-Frame Allocation)

**1. `resolveTargetDelta()` when `resumingFrom` - Line 1253-1255**
```typescript
if (Boolean(this.resumingFrom)) {
    // TODO: This is creating a new object every frame
    this.target = this.applyTransform(this.layout.layoutBox)
}
```
This calls `applyTransform()` which creates a new Box every frame during shared layout animations.

**Fix**: Store a reusable box on the node:
```typescript
// At animation start
if (!this._transformedLayoutBox) {
    this._transformedLayoutBox = createBox()
}
// During animation
applyTransformInto(this._transformedLayoutBox, this.layout.layoutBox)
this.target = this._transformedLayoutBox
```

**2. `applyTransform()` - Line 1049-1075**
Creates a new Box every call. Used in both measurement (OK) and per-frame code (BAD).

**Fix**: Add `applyTransformInto(targetBox, sourceBox)` variant that mutates instead of allocating:
```typescript
applyTransformInto(target: Box, source: Box): void {
    copyBoxInto(target, source)
    // ... apply transforms to target in-place
}
```

**3. `removeTransform()` - Lines 1078-1106**
Creates O(depth) sourceBoxes when iterating path. Called during measurement, not every frame, but still wasteful.

**Fix**: Pre-allocate a single `_measureSourceBox` on the node and reuse it:
```typescript
removeTransform(box: Box): Box {
    if (!this._measureSourceBox) this._measureSourceBox = createBox()
    // ... reuse this._measureSourceBox in loop
}
```

**4. `setAnimationOrigin()` spread - Line 1550**
```typescript
const mixedValues = { ...this.latestValues }
```
Creates a new object at animation start. This is acceptable since it's once per animation, but for very frequent layout changes it could be retained:
```typescript
if (!this._mixedValues) this._mixedValues = {}
Object.assign(this._mixedValues, this.latestValues)
```

### Safe Allocation Patterns (Keep As-Is)

These allocate once at appropriate lifecycle points:
- `updateLayout()` line 899: `layoutCorrected = createBox()` - once per layout update
- `createRelativeTarget()` lines 1334-1335: creates boxes once when relative target established
- `resolveTargetDelta()` lines 1228-1229: creates `target`/`targetWithTransforms` once if undefined
- `createProjectionDeltas()`: creates deltas once at animation start

**Expected impact**: Eliminates per-frame allocations during shared layout animations, reducing GC pressure and frame drops.

## 2. Cumulative Transform System

Store accumulated transforms at each node:

```typescript
interface IProjectionNode {
    // New fields
    cumulativeScale: Point
    cumulativeTranslate: Point
    cumulativeVersion: number
}

calcProjection() {
    if (this.parent.cumulativeVersion === frameVersion) {
        // Derive from parent's cumulative (O(1))
        this.cumulativeScale.x = this.parent.cumulativeScale.x * this.projectionDelta.x.scale
        // ...
    }
}
```

**Expected impact**: Reduces O(n × depth) to O(n) for tree transform calculation.

## 3. Explicit Coordinate System Model

### Current Problem: Implicit Coordinates

A `Box` is just numbers with no indication of its coordinate system. The same scroll offsets are added in some places and subtracted in others:

| Function | Operation | Purpose |
|----------|-----------|---------|
| `measurePageBox()` | +root scroll | viewport → page |
| `removeElementScroll()` | +element scroll | adjust for scroll containers |
| `applyTransform()` | -element scroll | apply transforms in scroll context |
| `applyTreeDeltas()` | -element scroll | shared transition scroll compensation |

This leads to:
- Confusion about what coordinate system a box is in
- Redundant path iterations to accumulate the same scroll offsets
- Subtle bugs when coordinate systems don't match in shared transitions

### Proposed: Labeled Boxes with Scroll Deltas

```typescript
type CoordSystem = 'viewport' | 'page'

interface LabeledBox {
    box: Box
    coords: CoordSystem
}

interface ScrollDelta {
    offset: Point           // Current scroll position
    animationId: number     // For cache invalidation
}

interface IProjectionNode {
    // New fields
    scrollDelta: ScrollDelta          // This node's scroll contribution
    cumulativeScrollDelta: Point      // Sum of all ancestor scroll offsets

    // Boxes are always stored in page coords (stable during scroll)
    layout: { layoutBox: LabeledBox }  // coords: 'page'
    target: LabeledBox                  // coords: 'page'
}
```

### Coordinate Transformations as Composable Deltas

```typescript
// Scroll offset as a Delta that can be applied/unapplied
function createScrollDelta(offset: Point): Delta {
    return {
        x: { translate: offset.x, scale: 1, origin: 0, originPoint: 0 },
        y: { translate: offset.y, scale: 1, origin: 0, originPoint: 0 }
    }
}

// Convert between coordinate systems
function toViewportCoords(box: LabeledBox, scrollDelta: Point): LabeledBox {
    if (box.coords === 'viewport') return box
    const result = createBox()
    copyBoxInto(result, box.box)
    translateAxis(result.x, -scrollDelta.x)
    translateAxis(result.y, -scrollDelta.y)
    return { box: result, coords: 'viewport' }
}

function toPageCoords(box: LabeledBox, scrollDelta: Point): LabeledBox {
    if (box.coords === 'page') return box
    const result = createBox()
    copyBoxInto(result, box.box)
    translateAxis(result.x, scrollDelta.x)
    translateAxis(result.y, scrollDelta.y)
    return { box: result, coords: 'page' }
}
```

### Viewport-Relative Updates During Scroll

Currently, scroll requires re-measurement or path iteration. With scroll deltas:

```typescript
// Root maintains current scroll delta
root.scrollDelta = {
    offset: measureScroll(document),
    animationId: currentAnimationId
}

// Each node stores cumulative scroll from ancestors
node.cumulativeScrollDelta = {
    x: parent.cumulativeScrollDelta.x + (node.scrollDelta?.offset.x ?? 0),
    y: parent.cumulativeScrollDelta.y + (node.scrollDelta?.offset.y ?? 0)
}

// When scroll changes, just update the delta - no re-measurement needed
onScroll(() => {
    root.scrollDelta.offset = measureScroll(document)
    // All viewport-relative projections automatically use new delta
})

// Rendering: convert page-relative target to viewport for display
function projectToViewport(node: IProjectionNode): Box {
    // Target is stored in page coords (stable)
    const pageTarget = node.target

    // Apply current scroll delta to get viewport coords
    return toViewportCoords(pageTarget, root.scrollDelta.offset).box
}
```

### Shared Element Animations Across Coordinate Systems

When animating between a `position: fixed` element (viewport-relative) and a normal element (page-relative):

```typescript
function resolveSharedTarget(lead: IProjectionNode, follow: IProjectionNode): Box {
    const leadBox = lead.target  // May be viewport or page relative
    const followBox = follow.target

    // Normalize both to page coords for comparison
    const leadInPage = toPageCoords(leadBox, lead.cumulativeScrollDelta)
    const followInPage = toPageCoords(followBox, follow.cumulativeScrollDelta)

    // Calculate delta in consistent coordinate system
    const delta = calcDelta(leadInPage.box, followInPage.box)

    return delta
}
```

### Handling `position: relative` → `position: absolute` Transitions

When an element's positioning context changes:

```typescript
// Before: element in normal flow (page-relative to its parent)
// After: element is position: absolute (page-relative to offset parent)

function handlePositionChange(node: IProjectionNode, newPosition: 'relative' | 'absolute') {
    if (newPosition === 'absolute') {
        // Recalculate relative to new offset parent
        const offsetParent = findOffsetParent(node)
        node.relativeParent = offsetParent

        // Target stays in page coords - just changes which parent it's relative to
        recalcRelativeTarget(node, offsetParent)
    }
}
```

**Benefits**:
- Explicit coordinate system prevents bugs in shared transitions
- Scroll deltas compose naturally - no path iteration needed
- Scroll changes only update delta, not re-measure boxes
- Clear semantics for viewport↔page conversions
- Easier to handle fixed/absolute/relative positioning changes

## 4. Two-Pass Shared Layout Resolution

For shared layouts, use two passes:

**Pass 1**: Process all nodes, marking shared nodes that need lead data
**Pass 2**: Process only nodes that couldn't resolve in pass 1

Or: Sort shared nodes to process after their leads.

## 5. Path Array Optimization

Instead of creating new arrays:

```typescript
// Current: O(depth) allocation per node
this.path = parent ? [...parent.path, parent] : []

// Proposed: Share parent's path, store index
this.pathEndIndex = parent ? parent.pathEndIndex + 1 : 0
// Access: this.root.sharedPathArray[0..this.pathEndIndex]
```

## 6. Lazy Calculation with Caching

Cache computed values with version tracking:

```typescript
getClosestProjectingParent() {
    if (this._closestProjectingParentVersion === frameVersion) {
        return this._closestProjectingParent
    }
    // ... calculate
    this._closestProjectingParentVersion = frameVersion
    return this._closestProjectingParent
}
```

## 7. Template Literal Transform Building

Use template literals or pre-computed segments:

```typescript
// Instead of repeated concatenation
const parts = []
if (xTranslate || yTranslate) {
    parts.push(`translate3d(${xTranslate}px, ${yTranslate}px, 0)`)
}
return parts.join(' ') || 'none'
```

Or cache transform strings when values haven't changed.

## 8. Batch Dirty Flag Propagation

Instead of checking parent flags during iteration:

```typescript
// Current: Each node checks parent
node.isProjectionDirty ||= node.parent?.isProjectionDirty

// Proposed: Single propagation pass
propagateDirtyFlags(root) {
    const queue = [root]
    while (queue.length) {
        const node = queue.shift()
        for (const child of node.children) {
            child.isProjectionDirty ||= node.isProjectionDirty
            queue.push(child)
        }
    }
}
```

## 9. Consider Web Workers for Large Trees

For very large trees (1000+ nodes), consider:
- Moving projection calculations to a worker
- Using `SharedArrayBuffer` for box data
- Only synchronizing dirty nodes back to main thread

---

# Summary

The projection system is sophisticated and handles complex layout animations well. The main performance opportunities are:

1. **Eliminate per-frame allocations**: Don't pool objects (V8 allocation is fast)—instead, allocate at animation start and retain on nodes. The critical issue is `resolveTargetDelta()` calling `applyTransform()` every frame during shared layout animations.
2. **Cache tree transforms**: Store cumulative scroll/transforms at each node (O(1) lookup) instead of iterating path (O(depth)). Microbenchmarks show 50-73% improvement.
3. **Formalize coordinate systems**: Label boxes as viewport-relative or page-relative. Store scroll offsets as composable Deltas. This eliminates redundant add/subtract operations, enables scroll updates without re-measurement, and prevents bugs in shared transitions between different positioning contexts.
4. **Optimize path iterations**: Reduce from ~7× O(depth) to 1-2× O(depth) per node
