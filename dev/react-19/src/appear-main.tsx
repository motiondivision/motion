/**
 * Page for tests/react/appear.spec.ts. It has its own entry, as the main
 * one imports every test page and the animation features with them.
 */
import { LazyMotion, motion } from "framer-motion/appear"
import ReactDOMClient from "react-dom/client"

const features = () => import("framer-motion").then((mod) => mod.domAnimation)

const linear = { type: "tween", ease: "linear", duration: 4 } as const
const box = { width: 100, height: 100, background: "#f00" }

const App = () => (
    <LazyMotion features={features}>
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
    </LazyMotion>
)

ReactDOMClient.createRoot(document.getElementById("root")!).render(<App />)
