---
name: Bug report
about: Let us know about some broken functionality
title: "[BUG]"
labels: bug
assignees: ""
---

> [!NOTE]
> **Motion for Vue issues:** Please open in the [Motion for Vue repo](https://github.com/motiondivision/motion-vue).

**1. Read the [FAQs](#faqs) 👇**

**2. Describe the bug**

Give a clear and concise description of what the bug is.

**3. IMPORTANT: Provide a CodeSandbox reproduction of the bug**

A CodeSandbox minimal reproduction will allow us to quickly follow the reproduction steps. **Without one, this bug report won't be accepted.**

**4. Steps to reproduce**

Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**5. Expected behavior**

A clear and concise description of what you expected to happen.

**6. Video or screenshots**

If applicable, add a video or screenshots to help explain the bug.

**7. Environment details**

If applicable, let us know which OS, browser, browser version etc you're using.

## FAQs

### React Server Components `"use client"` error

If you're importing `motion` or `m` into a React Server Component environment, ensure you're importing from `motion/react-client` instead of `motion/react`.

```javascript
import * as motion from "motion/react-client"
import * as m from "framer-motion/react-m"
```

### Motion for React won't install

Different versions of Motion for React are compatible with different versions of React.

React 19: `framer-motion@12.0.0-alpha.0` or higher
React 18: `framer-motion@7.0.0` to `framer-motion@11.x`, or `motion`
React 17: `framer-motion@6.x` or lower

### `height: "auto"` is jumping

Animating to/from `auto` requires measuring the DOM. There's no perfect way to do this and if you have also applied padding to the same element, these measurements might be wrong.

The recommended solution is to move padding to a child element. See [this issue](https://github.com/motiondivision/motion/issues/368) for the full discussion.

### Preact isn't working

Motion for React isn't compatible with Preact.

### `AnimatePresence` isn't working

Have all of its immediate children got a unique `key` prop that **remains the same for that component every render**?

```jsx
// Bad: The index could be given to a different component if the order of items changes
<AnimatePresence>
    {items.map((item, index) => (
        <Component key={index} />
    ))}
</AnimatePresence>
```

```jsx
// Good: The item ID is unique to each component
<AnimatePresence>
    {items.map((item, index) => (
        <Component key={item.id} />
    ))}
</AnimatePresence>
```

Is the `AnimatePresence` correctly outside of the controlling conditional? `AnimatePresence` must be rendered whenever you expect an `exit` animation to run - it can't do so if it's unmounted!

```jsx
// Bad: AnimatePresence is unmounted - exit animations won't run
{
    isVisible && (
        <AnimatePresence>
            <Component />
        </AnimatePresence>
    )
}
```

```jsx
// Good: Only the children are unmounted - exit animations will run
<AnimatePresence>{isVisible && <Component />}</AnimatePresence>
```
