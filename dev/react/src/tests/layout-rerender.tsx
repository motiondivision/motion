import { motion, useMotionValue } from "framer-motion"
import { useEffect, useState } from "react"

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const parent = params.get("parent") || false
    const [state, setState] = useState(0)
    const backgroundColor = useMotionValue("red")
    const renderCount = useMotionValue(0)

    useEffect(() => {
        if (state === 1) {
            setTimeout(() => setState(2), 50)
        }
    }, [state])

    return (
        <>
            <button onClick={() => setState(state + 1)}>Update</button>
            <motion.pre id="render-count">{renderCount}</motion.pre>
            <motion.div
                layout={Boolean(parent)}
                style={{
                    position: "relative",
                    width: 500,
                    height: state ? 500 : 400,
                }}
            >
                <motion.div
                    id="box"
                    data-testid="box"
                    layout
                    style={{ ...(state ? a : b), backgroundColor }}
                    transition={{ duration: 1 }}
                    onLayoutAnimationStart={() =>
                        renderCount.set(renderCount.get() + 1)
                    }
                />
            </motion.div>
        </>
    )
}

const box = {
    position: "absolute",
    top: 100,
    left: 100,
    background: "red",
}

const a = {
    ...box,
    width: 100,
    height: 200,
}

const b = {
    ...box,
    top: 100,
    left: 200,
    width: 300,
    height: 300,
}
