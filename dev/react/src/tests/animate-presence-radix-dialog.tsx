import * as DialogPrimitive from "@radix-ui/react-dialog"
import { AnimatePresence, motion } from "framer-motion"
import { useId, useState } from "react"

/**
 * Test for AnimatePresence with Radix UI Dialog
 * This reproduces issue #3455 where exit animations break
 * when using asChild with motion components inside AnimatePresence.
 *
 * The issue occurs because Radix UI's asChild prop creates new callback refs
 * on each render, and when externalRef is in the useMotionRef dependency array,
 * this causes the callback to be recreated, triggering remounts that break
 * exit animations.
 */
export const App = () => {
    const id = useId()
    const [isOpen, setIsOpen] = useState(false)
    const [exitComplete, setExitComplete] = useState(false)
    const [exitStarted, setExitStarted] = useState(false)

    return (
        <div className="App" style={{ padding: 20 }}>
            <style>{`
                .overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                }
                .dialog {
                    position: fixed;
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    width: 300px;
                }
            `}</style>

            <DialogPrimitive.Root onOpenChange={setIsOpen} open={isOpen}>
                <DialogPrimitive.Trigger id="trigger">
                    {isOpen ? "Close" : "Open"}
                </DialogPrimitive.Trigger>
                <AnimatePresence
                    onExitComplete={() => setExitComplete(true)}
                >
                    {isOpen ? (
                        <DialogPrimitive.Portal key={id} forceMount>
                            <DialogPrimitive.Overlay asChild>
                                <motion.div
                                    id="overlay"
                                    className="overlay"
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    initial={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    onAnimationStart={(definition) => {
                                        if (
                                            definition === "exit" ||
                                            (typeof definition === "object" &&
                                                "opacity" in definition &&
                                                definition.opacity === 0)
                                        ) {
                                            setExitStarted(true)
                                        }
                                    }}
                                />
                            </DialogPrimitive.Overlay>

                            <DialogPrimitive.Content asChild>
                                <motion.div
                                    id="dialog"
                                    className="dialog"
                                    animate={{
                                        left: "50%",
                                        bottom: "50%",
                                        y: "50%",
                                        x: "-50%",
                                    }}
                                    exit={{
                                        left: "50%",
                                        bottom: 0,
                                        y: "100%",
                                        x: "-50%",
                                    }}
                                    initial={{
                                        left: "50%",
                                        bottom: 0,
                                        y: "100%",
                                        x: "-50%",
                                    }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <DialogPrimitive.Title>
                                        Dialog Title
                                    </DialogPrimitive.Title>

                                    <DialogPrimitive.Description>
                                        Dialog content here
                                    </DialogPrimitive.Description>

                                    <DialogPrimitive.Close id="close">
                                        Close
                                    </DialogPrimitive.Close>
                                </motion.div>
                            </DialogPrimitive.Content>
                        </DialogPrimitive.Portal>
                    ) : null}
                </AnimatePresence>
            </DialogPrimitive.Root>

            <div id="status" style={{ marginTop: 20 }}>
                <div id="exit-started" data-value={exitStarted.toString()}>
                    Exit started: {exitStarted.toString()}
                </div>
                <div id="exit-complete" data-value={exitComplete.toString()}>
                    Exit complete: {exitComplete.toString()}
                </div>
            </div>
        </div>
    )
}
