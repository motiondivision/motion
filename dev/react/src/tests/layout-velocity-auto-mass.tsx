import { motion } from "framer-motion"
import { useRef, useState } from "react"

/**
 * A small box and a big box move by the same distance on the same spring
 * with mass: "auto". The big box is heavier, so it settles later. Each box
 * writes how long its animation took.
 *
 * ?default uses no transition, which stays the 0.45s tween.
 */
const Box = ({
    id,
    size,
    isDown,
}: {
    id: string
    size: number
    isDown: boolean
}) => {
    const startedAt = useRef(0)
    const [duration, setDuration] = useState<number | null>(null)
    const transition = new URLSearchParams(window.location.search).has(
        "default"
    )
        ? undefined
        : ({
              type: "spring",
              visualDuration: 0.45,
              bounce: 0,
              mass: "auto",
          } as const)

    return (
        <motion.div
            id={id}
            layout
            transition={transition}
            data-duration={duration ?? ""}
            onLayoutAnimationStart={() => {
                startedAt.current = performance.now()
            }}
            onLayoutAnimationComplete={() =>
                setDuration(performance.now() - startedAt.current)
            }
            style={{
                width: size,
                height: size,
                marginTop: isDown ? 200 : 0,
                flex: "none",
                background: "red",
            }}
        />
    )
}

export const App = () => {
    const [isDown, setIsDown] = useState(false)

    return (
        <div
            id="toggle"
            onClick={() => setIsDown(!isDown)}
            style={{ display: "flex", gap: 40, alignItems: "flex-start" }}
        >
            <Box id="small" size={50} isDown={isDown} />
            <Box id="big" size={500} isDown={isDown} />
        </div>
    )
}
