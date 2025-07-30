
<h1 align="center"> <img width="35" height="35" alt="Motion logo" src="https://github.com/user-attachments/assets/00d6d1c3-72c4-4c2f-a664-69da13182ffc" /><br />Motion for React</h1>
<h3 align="center">
  An open source animation library<br />for React
</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/motion" rel="noopener noreferrer nofollow" ><img src="https://img.shields.io/npm/v/motion?color=0368FF&label=version" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/motion" rel="noopener noreferrer nofollow" ><img src="https://img.shields.io/npm/dm/framer-motion?color=8D30FF&label=npm" alt="npm downloads per month"></a>
  <a target="_blank" rel="noopener noreferrer nofollow" href="https://www.jsdelivr.com/package/npm/motion"><img alt="jsDelivr hits (npm)" src="https://img.shields.io/jsdelivr/npm/hm/framer-motion?logo=jsdeliver&color=FF4FBA"></a>
  <img alt="NPM License" src="https://img.shields.io/npm/l/motion?color=FF2B6E">
</p>


```bash
npm install motion
```

## Table of Contents

1. [Why Motion?](#why-motion)
2. [🍦 Flavours](#-flavours)
3. [🎓 Examples](#-examples)
4. [🎨 Studio](#-studio)
5. [⚡️ Motion+](#-motion)
6. [👩🏻‍⚖️ License](#-license)
7. [💎 Contribute](#-contribute)
8. [✨ Sponsors](#-sponsors)

## Why Motion?

Motion is an animation library for making beautiful animations.

* The **only** library with first‑class APIs for React, JavaScript, **and** Vue.
* Powered by a **hybrid engine** that blends JavaScript flexibility with native browser APIs for **120fps GPU‑accelerated** motion.
* Tiny footprint, tree‑shakable, and fully TypeScript‑typed.

## 🍦 Flavours

Motion is available for [React](https://motion.dev/docs/react), [JavaScript](https://motion.dev/docs/quick-start) and [Vue](https://motion.dev/docs/vue).

<details>
<summary>React ⬇</summary>

```jsx
import { motion } from "motion/react"

function Component() {
    return <motion.div animate={{ x: 100 }} />
}
```

Get started with [Motion for React](https://motion.dev/docs/react).

</details>

<details>
<summary>JavaScript ⬇</summary>

```javascript
import { animate } from "motion"

animate("#box", { x: 100 })
```

Get started with [JavaScript](https://motion.dev/docs/quick-start).

</details>

<details>
<summary>Vue ⬇</summary>

```html
<script>
    import { motion } from "motion-v"
</script>

<template> <motion.div :animate={{ x: 100 }} /> </template>
```

Get started with [Motion for Vue](https://motion.dev/docs/vue).

</details>

## 🎓 Examples

[Motion Examples](https://motion.dev/examples) offers 100s of free and Motion+ examples for beginners and advanced users alike. Easy copy/paste code to kick‑start your next project.

## ⚡️ Motion+

Learn, Design, Build. [Motion+](https://motion.dev/plus) is a one-time fee, lifetime update membership that provides:
- 160+ premium Motion Examples
- Motion UI features like Cursor and Ticker
- Motion Studio animation editing for VS Code `alpha`
- Early access content
- Private Discord

[Get Motion+](https://motion.dev/plus)

## 🎨 Studio

![Video of bezier curve editing](https://framerusercontent.com/images/KO5dnHOUSNGb9S73p1J7nLhoFI.gif)

Motion Studio is a versatile suite of developer tools allowing you to:

-   Visually edit CSS and Motion easing curves in VS Code
-   Generate CSS springs with LLMs
-   Load Motion docs into your LLM

Get started with [Motion Studio](https://motion.dev/docs/tools-quick-start).

## 👩🏻‍⚖️ License

-   Motion is MIT licensed.

## 💎 Contribute

-   Want to contribute to Motion? Our [contributing guide](https://github.com/motiondivision/motion/blob/master/CONTRIBUTING.md) has you covered.

## ✨ Sponsors

Motion is sustainable thanks to the kind support of its sponsors.

### Partners

#### Framer

Motion powers Framer animations, the web builder for creative pros. Design and ship your dream site. Zero code, maximum speed.

<a href="https://www.framer.com?utm_source=motion-readme">
  <img alt="Framer" src="https://github.com/user-attachments/assets/0404c7a1-c29d-4785-89ae-aae315f3c759" width="300px" height="200px">
</a>

### Platinum

<a href="https://tailwindcss.com"><img alt="Tailwind" src="https://github.com/user-attachments/assets/c0496f09-b8ee-4bc4-85ab-83a071bbbdec" width="300px" height="200px"></a> <a href="https://linear.app"><img alt="Linear" src="https://github.com/user-attachments/assets/a93710bb-d8ed-40e3-b0fb-1c5b3e2b16bb" width="300px" height="200px"></a>

### Gold

<a href="https://vercel.com"><img alt="Vercel" src="https://github.com/user-attachments/assets/23cb1e37-fa67-49ad-8f77-7f4b8eaba325" width="225px" height="150px"></a> <a href="https://liveblocks.io"><img alt="Liveblocks" src="https://github.com/user-attachments/assets/31436a47-951e-4eab-9a68-bdd54ccf9444" width="225px" height="150px"></a> <a href="https://lu.ma"><img alt="Luma" src="https://github.com/user-attachments/assets/4fae0c9d-de0f-4042-9cd6-e07885d028a9" width="225px" height="150px"></a> <a href="https://emilkowal.ski"><img alt="Emil Kowalski" src="https://github.com/user-attachments/assets/29f56b1a-37fb-4695-a6a6-151f6c24864f" width="300px" height="200px"></a>

### Silver

<a href="https://www.frontend.fyi/?utm_source=motion"><img alt="Frontend.fyi" src="https://github.com/user-attachments/assets/07d23aa5-69db-44a0-849d-90177e6fc817" width="150px" height="100px"></a> <a href="https://firecrawl.dev"><img alt="Firecrawl" src="https://github.com/user-attachments/assets/cba90e54-1329-4353-8fba-85beef4d2ee9" width="150px" height="100px"></a> <a href="https://puzzmo.com"><img alt="Puzzmo" src="https://github.com/user-attachments/assets/aa2d5586-e5e2-43b9-8446-db456e4b0758" width="150px" height="100px"></a>

### Personal

-   [OlegWock](https://sinja.io)
-   [Lambert Weller](https://github.com/l-mbert)
-   [Jake LeBoeuf](https://jklb.wf)
-   [Han Lee](https://github.com/hahnlee)
