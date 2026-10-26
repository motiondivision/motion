import { AnimatePresence, motion } from "motion/react"

export const Modal = ({ isOpen }: { isOpen: boolean }) => (
    <AnimatePresence>
        {isOpen && (
            <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
            />
        )}
    </AnimatePresence>
)
