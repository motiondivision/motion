import { motion } from "framer-motion"

export const App = () => {
    return (
        <svg
            width="1000"
            height="1000"
            viewBox="0 0 1000 1000"
            xmlns="http://www.w3.org/2000/svg"
        >
            <motion.rect
                id="none-transform"
                x={0}
                y={300}
                width={100}
                height={100}
                animate={{ x: "none" }}
            />

            <motion.rect
                id="only-transform"
                x={150}
                y={300}
                width={100}
                height={100}
                style={{ rotate: 45 }}
            />
            <motion.rect
                id="only-transformOrigin"
                x={300}
                y={300}
                width={100}
                height={100}
                style={{ originX: 1 }}
            />
            <motion.rect
                id="transform-and-transformOrigin"
                x={450}
                y={300}
                width={100}
                height={100}
                style={{ rotate: 45, originX: 1 }}
            />

            <motion.circle
                id="no-set-originY"
                cx={100}
                cy={100}
                r={50}
                style={{ skew: 45 }}
                initial={{ originX: 0, rotate: 0 }}
                animate={{ originX: 1, rotate: 180 }}
                transition={{ duration: 0.2 }}
            />
            <motion.circle
                id="set-originY"
                cx={100}
                cy={100}
                r={50}
                style={{ skew: 45 }}
                initial={{ originX: 0, originY: 0, rotate: 0 }}
                animate={{ originX: 1, originY: 1, rotate: 180 }}
                transition={{ duration: 0.2 }}
                fill="red"
            />
        </svg>
    )
}
