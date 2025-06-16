import { motion } from "framer-motion"
import { useEffect, useState } from "react"

export const App = () => {
    const [step, setStep] = useState(0)

    useEffect(() => {
        if (step < 2) {
            const timeout = setTimeout(() => setStep(step + 1), 100)

            return () => clearTimeout(timeout)
        }
    }, [step])

    return (
        <motion.div
            id="box"
            // Small box for step 0, large box for step 1 and 2
            key={step === 0 ? "0" : "1"}
            layoutId="box"
            // Animate up to scale: 2 for step 1, then back to default
            // scale for step 2. If the box ends animating to scale: 0.5,
            // it means we erroneously read the initial transform from the
            // layout animation.
            animate={step === 1 ? { scale: 2 } : {}}
            transition={{ duration: 0.05 }}
            style={{
                background: "red",
                width: step === 0 ? 100 : 200,
                height: step === 0 ? 100 : 200,
            }}
        />
    )
}
