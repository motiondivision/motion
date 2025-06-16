import { motion } from "framer-motion"
import { useState } from "react";

export const App = () => {
    const [state, setState] = useState(false)
    const size = state ? 100 : 200
    return (
        <motion.div
            id="box"
            data-testid="box"
            key={state ? "a" : "b"}
            layoutId="box"
            style={{
                rotate: 45,
                width: size,
                height: size,
                backgroundColor: "red",
            }}
            onClick={() => setState(!state)}
            transition={{
                duration: 10,
                ease: state ? () => 0.5 : () => 0,
            }}
        />
    )
}
