/**
 * Page for tests/react/appear.spec.ts. It has its own entry, as the main
 * one imports every test page and the animation features with them.
 */
import { LazyMotion, motion as lazyMotion } from "framer-motion/appear"
import { motion as asyncMotion } from "framer-motion/appear-async"
import * as React from "react"
import ReactDOMClient from "react-dom/client"

const features = () => import("framer-motion").then((mod) => mod.domAnimation)

const linear = { type: "tween", ease: "linear", duration: 4 } as const
const box = { width: 100, height: 100, background: "#f00" }

/**
 * Either `m` components that get their features from `LazyMotion`, or
 * components that fetch their own animation code.
 */
const isAsync = window.location.search.includes("async")
const motion = isAsync ? asyncMotion : lazyMotion
const Features = isAsync
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : ({ children }: { children: React.ReactNode }) => (
          <LazyMotion features={features}>{children}</LazyMotion>
      )

const App = () => (
    <Features>
        <motion.div
            id="tween"
            initial={{ opacity: 0, x: -400 }}
            animate={{ opacity: 1, x: 0 }}
            transition={linear}
            style={box}
        />
        <motion.div
            id="spring"
            initial={{ x: -400 }}
            animate={{ x: 0 }}
            style={box}
        />
        <motion.div
            id="colour"
            initial={{ backgroundColor: "#ff0000" }}
            animate={{ backgroundColor: "#0000ff" }}
            transition={linear}
            style={box}
        />
        <motion.div
            id="keyframes"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 1] }}
            transition={linear}
            style={box}
        />
    </Features>
)

ReactDOMClient.createRoot(document.getElementById("root")!).render(<App />)
