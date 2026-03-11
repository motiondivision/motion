import { motion } from "framer-motion"
import { Fragment, useState } from "react"

const box: React.CSSProperties = {
    position: "absolute",
    left: 0,
    background: "red",
}

const a: React.CSSProperties = {
    ...box,
    top: 100,
    width: 100,
    height: 100,
}

const b: React.CSSProperties = {
    ...box,
    top: 300,
    width: 100,
    height: 100,
}

function A({ onClick }: { onClick: () => void }) {
    return (
        <Fragment>
            <motion.div
                id="box"
                data-testid="box"
                layoutId="box"
                style={a}
                onClick={onClick}
                transition={{ duration: 1, ease: () => 0.5 }}
            />
        </Fragment>
    )
}

function B({ onClick }: { onClick: () => void }) {
    return (
        <Fragment>
            <motion.div
                id="box"
                data-testid="box"
                layoutId="box"
                style={b}
                onClick={onClick}
                transition={{ duration: 1, ease: () => 0.5 }}
            />
        </Fragment>
    )
}

export const App = () => {
    const [state, setState] = useState(true)

    return state ? (
        <A onClick={() => setState(false)} />
    ) : (
        <B onClick={() => setState(true)} />
    )
}
