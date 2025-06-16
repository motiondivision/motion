import { motion, useCycle } from "framer-motion"
import "./shared-layout-reparenting.css"

/**
 * This example demonstrates using shared layout
 * to animate between two sets of two components with a different
 * hierarchy
 */

const Child = () => {
    return (
        <motion.div className="big" layoutId="big">
            <motion.div className="small" layoutId="small" />
        </motion.div>
    )
}

const Sibling = () => {
    return (
        <>
            <motion.div className="big purple" layoutId="big" />
            <motion.div className="small purple" layoutId="small" />
        </>
    )
}

export const App = () => {
    const [isOn, toggleOn] = useCycle(false, true)

    return (
        <div className="container" onClick={() => toggleOn()}>
            {isOn ? <Child /> : <Sibling />}
        </div>
    )
}
