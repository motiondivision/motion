# Investigation: Drag Constraints Not Updating on Element Resize (Issue #2458)

## Summary

When a draggable element's dimensions change (e.g., through CSS resize), the drag constraints do not update, causing the resized element to overflow/underflow its constraint boundaries.

**Issue:** https://github.com/motiondivision/motion/issues/2458

## Root Cause Analysis

### How Drag Constraints Work

When using ref-based constraints (`dragConstraints={containerRef}`), constraints are calculated by comparing the draggable element's layout box to the container's layout box:

```typescript
// packages/framer-motion/src/gestures/drag/utils/constraints.ts:93-110
function calcViewportAxisConstraints(layoutAxis: Axis, constraintsAxis: Axis) {
    let min = constraintsAxis.min - layoutAxis.min
    let max = constraintsAxis.max - layoutAxis.max
    // If constraints axis is smaller than layout axis, flip constraints
    if (constraintsAxis.max - constraintsAxis.min < layoutAxis.max - layoutAxis.min) {
        [min, max] = [max, min]
    }
    return { min, max }
}
```

For example:
- Container: 500px wide
- Draggable element: 100px wide
- Constraints: `{ min: 0, max: 400 }` (can move 400px right before hitting edge)

### The Bug

**Constraints are only recalculated in three scenarios:**

1. **Drag start** (`VisualElementDragControls.ts:144`) - Fresh constraints on each new drag
2. **Projection "measure" event** (`VisualElementDragControls.ts:681-684`) - Only fires when the draggable element's projection updates
3. **Window resize** (`VisualElementDragControls.ts:697-699`) - Calls `scalePositionWithinConstraints()`

**The problem:** When the draggable element resizes via CSS (e.g., `resize: both`), none of these triggers fire:

- The user is not starting a new drag
- The projection system doesn't automatically detect CSS-driven size changes
- The window hasn't resized

The constraints remain cached at their original values (`VisualElementDragControls.ts:76`):
```typescript
private constraints: ResolvedConstraints | false = false
```

### Example Scenario

1. Initial state:
   - Container: 500px x 500px
   - Draggable: 100px x 100px
   - Cached constraints: `{ x: { min: 0, max: 400 }, y: { min: 0, max: 400 } }`

2. User resizes draggable to 200px x 200px using CSS resize handle

3. User starts dragging:
   - **Expected constraints:** `{ x: { min: 0, max: 300 }, y: { min: 0, max: 300 } }`
   - **Actual constraints:** Still `{ x: { min: 0, max: 400 }, y: { min: 0, max: 400 } }` (stale!)

4. Result: Element can overflow container by 100px in each direction

## Key Code Locations

| File | Lines | Description |
|------|-------|-------------|
| `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts` | 76 | Cached constraints instance variable |
| `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts` | 346-370 | `resolveConstraints()` - calculates constraints |
| `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts` | 398-444 | `resolveRefConstraints()` - measures container and calculates viewport constraints |
| `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts` | 672-677 | `measureDragConstraints()` - only listener for constraint updates |
| `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts` | 681-684 | Projection "measure" event listener |
| `packages/framer-motion/src/gestures/drag/utils/constraints.ts` | 93-110 | `calcViewportAxisConstraints()` - actual constraint math |

## Potential Fix

The drag controls should observe size changes on **both** the draggable element and the constraint container using `ResizeObserver`. The codebase already has a `resizeElement()` utility that wraps `ResizeObserver`:

```typescript
// packages/motion-dom/src/resize/handle-element.ts
export function resizeElement(
    target: ElementOrSelector,
    handler: ResizeHandler<Element>
): VoidFunction
```

### Proposed Solution

In `VisualElementDragControls.addListeners()`, add a `ResizeObserver` on the draggable element to trigger constraint recalculation:

```typescript
// In addListeners() method
const { dragConstraints } = this.getProps()

// Observe the draggable element for size changes
const stopElementResizeListener = resizeElement(element, () => {
    // Recalculate constraints when the draggable element resizes
    if (isRefObject(dragConstraints) && dragConstraints.current) {
        // Need to update layout first
        const { projection } = this.visualElement
        if (projection) {
            projection.updateLayout()
        }
        this.constraints = this.resolveRefConstraints()
    }
})

// Optionally, also observe the constraint container
if (isRefObject(dragConstraints) && dragConstraints.current) {
    const stopContainerResizeListener = resizeElement(
        dragConstraints.current,
        () => {
            this.constraints = this.resolveRefConstraints()
        }
    )
}
```

### Implementation Considerations

1. **Performance:** Only attach observers when using ref-based constraints
2. **Cleanup:** Return cleanup functions from `addListeners()`
3. **Layout sync:** May need to call `projection.updateLayout()` before recalculating constraints
4. **During drag:** Consider whether to update constraints mid-drag or only between drags

## Related Issues

- Issue #2903 (cross-referenced)

## Reproduction

CodeSandbox: https://codesandbox.io/p/sandbox/framer-motion-drag-constraints-issue-r233cy

Steps:
1. Drag the modal to verify constraints work initially
2. Resize the modal using the bottom-right resize handle
3. Attempt to drag the resized modal toward screen edges
4. Observe: Element overflows constraint boundaries
