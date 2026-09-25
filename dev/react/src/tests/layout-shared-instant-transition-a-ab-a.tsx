import {
    motion,
    useInstantLayoutTransition,
    AnimatePresence,
} from "framer-motion"
import { useState } from "react";

const transition = {
    default: { duration: 10, ease: () => 0.5 },
    opacity: { duration: 10, ease: () => 0.1 },
}

export const App = () => {
    const startTransition = useInstantLayoutTransition()
    const params = new URLSearchParams(window.location.search)
    const type = params.get("type") || true
    const [bgColor, setBgColor] = useState("#f00")
    const [state, setState] = useState(false)

    const instantTransit = () => {
        startTransition(() => {
            setBgColor("#00f")
        })
        setState(!state)
    }

    // a -> instant -> b
    // b -> animate -> a
    return (
        <AnimatePresence>
            <motion.div
                id="a"
                data-testid="box"
                layoutId="box"
                layout={type}
                style={{ ...a, background: bgColor }}
                onClick={instantTransit}
                transition={transition}
            />
            {state && (
                <motion.div
                    id="b"
                    layoutId="box"
                    style={{ ...b, background: bgColor }}
                    onClick={() => setState(!state)}
                />
            )}
        </AnimatePresence>
    )
}

const box = {
    position: "absolute",
    top: 0,
    left: 0,
}

const a = {
    ...box,
    width: 100,
    height: 200,
    borderRadius: 0,
}

const b = {
    ...box,
    top: 100,
    left: 200,
    width: 300,
    height: 300,
    borderRadius: 20,
}
