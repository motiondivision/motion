# animateLayout

Animate layout changes with FLIP animations, enter/exit transitions, and shared element animations — all without React.

> **Note:** This API is currently unstable and exported as `unstable_animateLayout`.

## Installation

```javascript
import { unstable_animateLayout as animateLayout } from "framer-motion/dom"
```

## Basic Usage

### Animate a Layout Change

Wrap your DOM mutation in `animateLayout` to automatically animate elements marked with `data-layout`:

```javascript
const box = document.querySelector("#box")

await animateLayout("#box", () => {
    box.classList.toggle("expanded")
}, { duration: 0.3 })
```

```html
<div id="box" data-layout class="collapsed"></div>
```

### Using Element References

You can pass elements directly instead of selectors:

```javascript
const elements = document.querySelectorAll(".card")

await animateLayout(elements, () => {
    container.classList.toggle("grid")
}, { duration: 0.5 })
```

## Enter & Exit Animations

Use the builder pattern to define animations for elements entering or leaving the DOM:

```javascript
await animateLayout(".cards", () => {
    // Add or remove cards
    container.innerHTML = newContent
}, { duration: 0.3 })
    .enter({ opacity: [0, 1], scale: [0.8, 1] }, { duration: 0.2 })
    .exit({ opacity: 0, scale: 0.8 }, { duration: 0.2 })
```

### Enter Animation

Elements added during the mutation that have `data-layout` or `data-layout-id` attributes will animate in:

```javascript
.enter(keyframes, options)
```

- **keyframes**: Object with CSS properties to animate. Use arrays for from/to values: `{ opacity: [0, 1] }`
- **options**: Optional transition settings like `{ duration: 0.2, ease: "ease-out" }`

### Exit Animation

Elements removed during the mutation will be cloned and animated out:

```javascript
.exit(keyframes, options)
```

The element is preserved at its last position and animated before being removed.

## Playback Controls

`animateLayout` returns a `GroupAnimation` that implements `AnimationPlaybackControls`:

```javascript
const animation = await animateLayout("#box", () => {
    box.style.width = "200px"
}, { duration: 1 })

// Pause the animation
animation.pause()

// Seek to a specific time (in seconds)
animation.time = 0.5

// Resume playback
animation.play()

// Stop and commit current styles
animation.stop()

// Get animation duration
console.log(animation.duration)

// Wait for completion
await animation.finished
```

## Nested Elements

Parent-child relationships are automatically detected. Child elements receive scale correction to maintain their visual size during parent animations:

```html
<div id="parent" data-layout>
    <div id="child" data-layout></div>
</div>
```

```javascript
await animateLayout(["#parent", "#child"], () => {
    parent.style.width = "300px"
}, { duration: 0.5 })
```

## Shared Layout Animations

Use `data-layout-id` to animate elements across different DOM positions:

```html
<!-- Before -->
<div id="list">
    <div data-layout-id="hero" class="thumbnail"></div>
</div>

<!-- After (different container) -->
<div id="detail">
    <div data-layout-id="hero" class="full-size"></div>
</div>
```

```javascript
await animateLayout('[data-layout-id="hero"]', () => {
    showDetailView()
}, { duration: 0.5 })
```

Elements with matching `data-layout-id` values will animate between their positions, even across different containers.

## HTML Attributes

| Attribute | Description |
|-----------|-------------|
| `data-layout` | Mark element for layout animation |
| `data-layout-id` | Enable shared layout animations between elements with the same ID |

## Options

```typescript
interface AnimateLayoutOptions {
    duration?: number        // Animation duration in seconds (default: 0.3)
    ease?: string | number[] // Easing function (default: [0.4, 0, 0.2, 1])
    transition?: {
        duration?: number
        ease?: string | number[]
    }
}
```

## API Reference

### animateLayout

```typescript
function animateLayout(
    elementOrSelector: string | Element | Element[] | NodeList,
    mutationOrOptions?: (() => void) | AnimateLayoutOptions,
    options?: AnimateLayoutOptions
): LayoutAnimationBuilder
```

### LayoutAnimationBuilder

```typescript
interface LayoutAnimationBuilder {
    enter(keyframes: DOMKeyframesDefinition, transition?: Transition): LayoutAnimationBuilder
    exit(keyframes: DOMKeyframesDefinition, transition?: Transition): LayoutAnimationBuilder
    then(onResolve: (animation: GroupAnimation) => void): Promise<void>
}
```

### GroupAnimation

```typescript
interface GroupAnimation {
    // Playback control
    play(): void
    pause(): void
    stop(): void
    cancel(): void
    complete(): void

    // Properties
    time: number           // Current time in seconds (read/write)
    duration: number       // Total duration in seconds (read-only)
    speed: number          // Playback rate (read/write)
    state: AnimationPlayState

    // Promise
    finished: Promise<void>
}
```

## Examples

### Expandable Card

```html
<div id="card" data-layout class="collapsed">
    <h2>Title</h2>
    <p class="content">Content here...</p>
</div>
```

```javascript
card.addEventListener("click", async () => {
    await animateLayout("#card", () => {
        card.classList.toggle("expanded")
    }, { duration: 0.3 })
})
```

### Reorderable List

```html
<ul id="list">
    <li data-layout>Item 1</li>
    <li data-layout>Item 2</li>
    <li data-layout>Item 3</li>
</ul>
```

```javascript
async function reorder(newOrder) {
    const items = list.querySelectorAll("li")

    await animateLayout(items, () => {
        newOrder.forEach(index => {
            list.appendChild(items[index])
        })
    }, { duration: 0.3 })
}
```

### Tab Content with Enter/Exit

```javascript
async function switchTab(newContent) {
    await animateLayout("#tab-content", () => {
        tabContent.innerHTML = newContent
    }, { duration: 0.3 })
        .enter({ opacity: [0, 1], y: [20, 0] }, { duration: 0.2 })
        .exit({ opacity: 0, y: -20 }, { duration: 0.15 })
}
```

### Paused Animation for Scrubbing

```javascript
const animation = await animateLayout("#box", () => {
    box.classList.add("final-state")
}, { duration: 1 })

animation.pause()

// Scrub with a slider
slider.addEventListener("input", (e) => {
    animation.time = e.target.value * animation.duration
})
```

## Browser Support

This API uses the Web Animations API (WAAPI) and requires a modern browser:

- Chrome 84+
- Firefox 75+
- Safari 13.1+
- Edge 84+
