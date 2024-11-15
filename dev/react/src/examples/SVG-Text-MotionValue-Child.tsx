import { animate, motion, useMotionValue, useTransform } from "framer-motion"
import { useEffect } from "react"

/**
 * An example of providing a MotionValue to a component directly. Testing both
 *  a SVG text and HTML h1 element.
 */
export const App = () => {
    const count = useMotionValue(0);
    const rounded = useTransform(count, Math.round);
    useEffect(() => {
        const animation = animate(count, 100, { duration: 10 });
        return animation.stop;
    }, [])

    return (<>
        <p>SVG</p>
        <svg
            width="250"
            height="250"
            viewBox="0 0 250 250"
            xmlns="http://www.w3.org/2000/svg"
            style={{ border: '1px solid white' }}
        >
            <motion.text
                x={125}
                y={125}
                fontSize={40}
                dominantBaseline="middle"
                textAnchor="middle"
                fill="currentColor"
            >
                {rounded}
            </motion.text>
        </svg>
        <p>HTML</p>
        <motion.h1>{rounded}</motion.h1>
        <motion.p>{rounded}</motion.p>
    </>)
}
