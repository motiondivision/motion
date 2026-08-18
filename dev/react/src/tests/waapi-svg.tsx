import { motion } from "framer-motion"

const transition = { type: "tween", ease: "linear", duration: 10 } as const

export const App = () => {
    return (
        <section style={{ padding: 100 }}>
            <svg width="400" height="200" viewBox="0 0 400 200">
                <motion.circle
                    id="circle"
                    cx={50}
                    cy={100}
                    r={40}
                    fill="#00f"
                    initial={{ opacity: 1, transform: "translateX(0px)" }}
                    animate={{
                        opacity: 0.2,
                        transform: "translateX(100px)",
                    }}
                    transition={transition}
                />
                <motion.rect
                    id="rect"
                    x={200}
                    y={60}
                    width={80}
                    height={80}
                    fill="#0f0"
                    initial={{ opacity: 1, transform: "scale(1)" }}
                    animate={{ opacity: 0.2, transform: "scale(1.5)" }}
                    transition={transition}
                />
            </svg>
            <motion.div
                id="control"
                initial={{ opacity: 1, transform: "translateX(0px)" }}
                animate={{ opacity: 0.2, transform: "translateX(100px)" }}
                transition={transition}
                style={{
                    width: 100,
                    height: 100,
                    backgroundColor: "red",
                }}
            />
        </section>
    )
}
