import { motion } from "framer-motion"
import { Suspense, useEffect, useState } from "react"
import { flushSync } from "react-dom"

const never = new Promise<void>(() => {})
let started = false

const Suspender = ({ suspended }: { suspended: boolean }) => {
    if (suspended) throw never
    return null
}

/**
 * Remounts the box while its accelerated opacity animation is past its
 * duration but hasn't finished, as when a busy main thread holds up the
 * finish event (issue #4027).
 */
export const App = () => {
    const [suspended, setSuspended] = useState(false)
    const [remounted, setRemounted] = useState(false)

    useEffect(() => {
        // Strict Mode runs this effect twice, but only remount once
        if (started) return
        started = true

        /**
         * Remount from a task of its own, a couple of frames into the
         * animation, so Motion's frame time isn't reused for it.
         */
        const remountInNewTask = () => {
            const channel = new MessageChannel()
            channel.port1.onmessage = remount
            channel.port2.postMessage(null)
        }

        const remount = () => {
            const start = performance.now()
            while (performance.now() - start < 300) {}

            flushSync(() => setSuspended(true))
            flushSync(() => setSuspended(false))
            setRemounted(true)
        }

        requestAnimationFrame(() => requestAnimationFrame(remountInNewTask))
    }, [])

    return (
        <>
            {remounted && <div id="remounted" />}
            <Suspense fallback={<div id="fallback" />}>
                <Suspender suspended={suspended} />
                <motion.div
                    id="box"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.1 }}
                    style={{ width: 100, height: 100, background: "blue" }}
                />
            </Suspense>
        </>
    )
}
