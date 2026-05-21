"use client"
import { arc, motion, useAnimate } from "motion/react"
import { useEffect } from "react"

export default function Page() {
    return (
        <div style={{ padding: 40, display: "grid", gap: 60 }}>
            <Keyframe />
            <UseAnimateExample />
        </div>
    )
}

function Keyframe() {
    return (
        <motion.div
            animate={{ x: 200, y: 100 }}
            transition={{
                duration: 1.5,
                path: arc({ amp: 1, rotate: true }),
                repeat: Infinity,
                repeatType: "reverse",
            }}
            style={{ width: 60, height: 60, background: "tomato" }}
        />
    )
}

function UseAnimateExample() {
    const [scope, animate] = useAnimate()

    useEffect(() => {
        animate(
            scope.current,
            { x: 200, y: 100 },
            { duration: 1.5, path: arc({ amp: 1 }) }
        )
    }, [animate, scope])

    return (
        <div
            ref={scope}
            style={{ width: 60, height: 60, background: "steelblue" }}
        />
    )
}
