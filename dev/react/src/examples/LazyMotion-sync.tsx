import { memo } from "react";
import { m, LazyMotion, domAnimation } from "framer-motion"

/**
 * An example of dynamically loading features from a different entry point.
 */

const style = {
    width: 100,
    height: 100,
    background: "white",
    x: 0,
    borderRadius: 20,
}

const Component = memo(() => {
    return (
        <m.div
            animate={{
                width: [null, 50, 200, 100],
            }}
            transition={{
                duration: 2,
                easings: ["circOut", "circOut", "circOut"],
                times: [0, 0.1, 0.9, 1],
            }}
            style={style}
        />
    )
})

export const App = () => {
    return (
        <LazyMotion features={domAnimation}>
            <Component />
        </LazyMotion>
    )
}
