import { motion, useMotionValue, useTransform } from "framer-motion"
import { useEffect, useLayoutEffect } from "react"

/**
 * #3769: under Strict Mode, setting a source MotionValue inside an effect
 * leaves a useTransform-derived value stuck at its stale value. The dev
 * app renders in StrictMode.
 */
function Probe({ id, layout }: { id: string; layout: boolean }) {
    const x = useMotionValue(0)
    const doubled = useTransform(() => x.get() * 2)

    const useEffectHook = layout ? useLayoutEffect : useEffect
    useEffectHook(() => {
        x.set(10)
        ;(window as any)[id] = { x, doubled }
    }, [])

    return <motion.div id={id}>{doubled}</motion.div>
}

export const App = () => (
    <>
        <Probe id="effect" layout={false} />
        <Probe id="layout-effect" layout={true} />
    </>
)
