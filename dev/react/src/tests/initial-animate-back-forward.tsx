import { motion } from "framer-motion"

/**
 * Reproduces #3676: in development mode, changing the URL in the browser bar
 * then pressing back/forward leaves a motion element stuck at opacity:0.
 *
 * Pure motion.div with initial → animate. The Cypress test triggers a
 * hard navigation away (cy.visit to a different page) and then back via
 * cy.go('back') to simulate the reporter's reproduction.
 */
export const App = () => {
    return (
        <motion.div
            id="box"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{ width: 100, height: 100, background: "red" }}
        >
            element
        </motion.div>
    )
}
