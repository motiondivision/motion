import type { Handle } from "remix/component"
import { motionValue } from "motion"
import { motion, MotionConfig } from "motion/remix"

const linear = { duration: 1, ease: "linear" } as const
const w = window as any

function Enter() {
    return () => (
        <motion.div
            id="enter"
            class="box"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={linear}
        />
    )
}

function Target(handle: Handle) {
    let right = false
    w.toggleTarget = () => {
        right = !right
        handle.update()
    }
    return () => (
        <motion.div
            id="target"
            class="box"
            animate={{ x: right ? 200 : 0 }}
            transition={linear}
        />
    )
}

function Rerender(handle: Handle) {
    let n = 0
    w.rerender = () => {
        n++
        handle.update()
    }
    return () => (
        <motion.div
            id="rerender"
            class="box"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            style={{ color: n % 2 ? "red" : "blue" }}
        />
    )
}

function Values() {
    const x = motionValue(0)
    w.setX = (v: number) => x.set(v)
    return () => <motion.div id="values" class="box" style={{ x }} />
}

function Hover() {
    return () => (
        <motion.div
            id="hover"
            class="box"
            whileHover={{ scale: 1.5 }}
            whileTap={{ scale: 0.5 }}
            transition={{ duration: 0.05 }}
        />
    )
}

function Focus() {
    return () => (
        <MotionConfig transition={linear}>
            <motion.button id="focus" whileFocus={{ scale: 2 }}>
                focus
            </motion.button>
        </MotionConfig>
    )
}

function Mixin() {
    return () => (
        <div
            id="mixin"
            class="box"
            mix={motion({ initial: { opacity: 0 }, animate: { opacity: 1 } })}
        />
    )
}

export function App() {
    return () => (
        <main>
            <Enter />
            <Target />
            <Rerender />
            <Values />
            <Hover />
            <Focus />
            <Mixin />
        </main>
    )
}
