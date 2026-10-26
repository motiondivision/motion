import { motion, useCycle } from "framer-motion"
import { useRef, useState } from "react"

/**
 * The #1827 sandbox, with its Example.tsx verbatim: the drag area and the
 * draggable are siblings, both scaled with `style`. Buttons cycle the
 * draggable's scale (1, 0.75, 0.5) and the drag area's (1, 1.25, 1.5), and
 * Refresh remounts. Styles follow the classic drag constraints example.
 *
 * ?variant=animate scales with `animate` instead of `style`.
 */
const animate =
    new URLSearchParams(window.location.search).get("variant") === "animate"

const scaleProps = (scale: number) =>
    animate
        ? { animate: { scale }, transition: { duration: 0.1 } }
        : { style: { scale } }

const Example = ({ scale, conScale }: { scale: number; conScale: number }) => {
    const constraintsRef = useRef<HTMLDivElement>(null)
    const area = scaleProps(conScale)
    const item = scaleProps(scale)

    return (
        <>
            <motion.div
                id="constraints"
                className="drag-area"
                ref={constraintsRef}
                {...area}
                style={{ ...dragArea, ...area.style }}
            />
            <motion.div
                id="box"
                {...item}
                style={{ ...draggable, ...item.style }}
                drag
                dragConstraints={constraintsRef}
            />
        </>
    )
}

export const App = () => {
    const [count, setCount] = useState(0)
    const [dragSize, cycleDragSize] = useCycle(1, 0.75, 0.5)
    const [conSize, cycleConSize] = useCycle(1, 1.25, 1.5)

    return (
        <>
            <div style={{ position: "fixed", top: 0, left: 0, zIndex: 1 }}>
                <button id="drag-size" onClick={() => cycleDragSize()}>
                    drag {dragSize}
                </button>
                <button id="con-size" onClick={() => cycleConSize()}>
                    container {conSize}
                </button>
                <button id="refresh" onClick={() => setCount(count + 1)}>
                    refresh
                </button>
            </div>
            <div style={exampleContainer}>
                <Example scale={dragSize} conScale={conSize} key={count} />
            </div>
        </>
    )
}

const exampleContainer = {
    position: "relative",
    width: "100vw",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
} as const

const dragArea = {
    width: 300,
    height: 300,
    background: "rgba(0, 0, 255, 0.2)",
    borderRadius: 30,
    position: "absolute",
    top: "calc(50% - 150px)",
    left: "calc(50% - 150px)",
} as const

/**
 * Positioned so it's above the drag area while it has no transform.
 */
const draggable = {
    position: "relative",
    width: 150,
    height: 150,
    borderRadius: 30,
    background: "red",
} as const
