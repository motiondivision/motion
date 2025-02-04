import {
    frame,
    motion,
    useMotionValue,
    useSpring,
    useTransform,
} from "framer-motion"
import { useRef, useState } from "react"

const spring = {
    stiffness: 300,
    damping: 28,
    restDelta: 0.00001,
    restSpeed: 0.00001,
}

function DragExample() {
    const dragX = useMotionValue(0)
    const dragY = useMotionValue(0)
    const dragXPX = useTransform(dragX, (v) => `${v}%`)
    const dragYPX = useTransform(dragY, (v) => `${v}%`)
    const x = useSpring(dragXPX, spring)
    const y = useSpring(dragYPX, spring)

    return (
        <motion.div
            drag
            dragMomentum={false}
            _dragX={dragX}
            _dragY={dragY}
            style={{ width: 100, height: 100, background: "red", x, y }}
        >
            Drag
        </motion.div>
    )
}

function RerenderExample() {
    const [{ x, y }, setMousePosition] = useState({ x: 0, y: 0 })

    const updateMousePosition = useRef((e) => {
        frame.postRender(() => setMousePosition({ x: e.clientX, y: e.clientY }))
    })

    const size = 40
    const ref = useRef<HTMLDivElement>(null)

    return (
        <motion.div
            ref={ref}
            animate={{ x, y }}
            transition={spring}
            style={{
                width: 100,
                height: 100,
                background: "green",
                position: "absolute",
                inset: 0,
            }}
            onTapStart={() => {
                window.addEventListener(
                    "mousemove",
                    updateMousePosition.current
                )
            }}
            onTap={() => {
                window.removeEventListener(
                    "mousemove",
                    updateMousePosition.current
                )
            }}
            onTapCancel={() => {
                window.removeEventListener(
                    "mousemove",
                    updateMousePosition.current
                )
            }}
        >
            Rerender
        </motion.div>
    )
}

function MouseEventExample() {
    const xPoint = useMotionValue(0)
    const yPoint = useMotionValue(0)
    const x = useSpring(0, spring)
    const y = useSpring(0, spring)
    const ref = useRef<HTMLDivElement>(null)
    const onMove = useRef<(event: MouseEvent) => void>(
        ({ clientX, clientY }: MouseEvent) => {
            const element = ref.current!

            x.set(clientX - element.offsetLeft - element.offsetWidth / 2)
            y.set(clientY - element.offsetTop - element.offsetHeight / 2)
        }
    )

    function startPointer() {
        window.addEventListener("pointermove", onMove.current)
    }

    function cancelPointer() {
        window.removeEventListener("pointermove", onMove.current)
    }

    return (
        <motion.div
            ref={ref}
            style={{ width: 100, height: 100, background: "yellow", x, y }}
            onTapStart={startPointer}
            onTapCancel={cancelPointer}
            onTap={cancelPointer}
        >
            Mouse Event
        </motion.div>
    )
}

function AnimationExample() {
    const x = useMotionValue(0)
    const xSpring = useSpring(x)

    return (
        <div style={{ width: 100, height: 100, position: "relative" }}>
            <motion.div
                animate={{
                    x: [-200, 200],
                    transition: {
                        duration: 1,
                        repeat: Infinity,
                        repeatType: "reverse",
                    },
                }}
                style={{ width: 100, height: 100, background: "lightblue", x }}
            />
            <motion.div
                style={{
                    width: 100,
                    height: 100,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    background: "lightblue",
                    opacity: 0.5,
                    x: xSpring,
                }}
            />
        </div>
    )
}

export function App() {
    return (
        <div style={{ display: "flex", gap: 100 }}>
            <DragExample />
            <MouseEventExample />
            <RerenderExample />
            {/* <AnimationExample /> */}
        </div>
    )
}
