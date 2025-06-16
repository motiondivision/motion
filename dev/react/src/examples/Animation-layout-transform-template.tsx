import { motion } from "framer-motion"
import { useState } from "react"

/**
 * This example replicates the centering technique of Framer which applies a `transformTemplate` prop
 * that adds `transform(-50% -50%)`
 */

export const App = () => {
    const [isOn, setIsOn] = useState(false)

    return (
        <motion.div
            onClick={() => setIsOn(!isOn)}
            transformTemplate={(_, generated) =>
                `translate(-50%, -50%) ${generated}`
            }
            layout
            style={{
                boxSizing: "border-box",
                width: "170px",
                height: "100px",
                borderRadius: "100px",
                padding: "10px",
                backgroundColor: isOn ? "#09f" : "#bbb",
            }}
        >
            <motion.div
                layout
                style={{
                    width: "80px",
                    height: "80px",
                    backgroundColor: "#ffffff",
                    borderRadius: "200px",
                    float: isOn ? "right" : "left",
                }}
            />
        </motion.div>
    )
}
