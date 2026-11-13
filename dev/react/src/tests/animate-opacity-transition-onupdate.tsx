import { motion } from "framer-motion"

/**
 * opacity is accelerated, but a transition onUpdate needs the value every
 * frame, which WAAPI can't provide.
 */
export const App = () => {
    const updates: number[] = ((window as any).updates = [])

    return (
        <>
            <motion.div
                id="with-onupdate"
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{
                    duration: 10,
                    ease: "linear",
                    onUpdate: (v: number) => updates.push(v),
                }}
                style={{ width: 100, height: 100, background: "red" }}
            />
            <motion.div
                id="without-onupdate"
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 10, ease: "linear" }}
                style={{ width: 100, height: 100, background: "red" }}
            />
        </>
    )
}
