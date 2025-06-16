import { motion } from "framer-motion"
import { StrictMode } from "react"
export const App = () => {
    return (
        <StrictMode>
            <motion.div drag />
        </StrictMode>
    )
}
