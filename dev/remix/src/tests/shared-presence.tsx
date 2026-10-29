import type { Handle } from "remix/component"
import {
    AnimatePresence,
    getPresenceData,
    holdPresence,
    isPresent,
    motion,
} from "motion/remix"

const linear = { duration: 1, ease: "linear" } as const
const w = window as any

/**
 * A present child reads AnimatePresence's `custom`, as with React's
 * usePresenceData.
 */
function PresenceLabel(handle: Handle) {
    return () => <span id="presence-data">{String(getPresenceData(handle))}</span>
}

function PresenceData() {
    return () => (
        <AnimatePresence custom={7}>
            <motion.div key="data" exit={{ opacity: 0 }}>
                <PresenceLabel />
            </motion.div>
        </AnimatePresence>
    )
}

/**
 * Both layoutId elements are AnimatePresence children with no `exit`: the
 * old one stays and crossfades out.
 */
function Swap(handle: Handle) {
    let open = false
    w.openSwap = () => {
        open = true
        handle.update()
    }
    return () => (
        <div style={{ height: "220px" }}>
            <AnimatePresence>
                {!open ? (
                    <motion.div
                        key="small"
                        id="swap-small"
                        layoutId="swap"
                        transition={linear}
                        style={{ width: "50px", height: "50px", background: "red" }}
                    />
                ) : (
                    <motion.div
                        key="big"
                        id="swap-big"
                        layoutId="swap"
                        transition={linear}
                        style={{ width: "200px", height: "200px", background: "blue" }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

/**
 * The exiting layoutId element has no `exit`, but a sibling does.
 */
function Overlay(handle: Handle) {
    let open = true
    w.closeOverlay = () => {
        open = false
        handle.update()
    }
    return () => (
        <div style={{ position: "relative", height: "220px" }}>
            <motion.div
                id="overlay-thumb"
                layoutId="overlay"
                transition={{ duration: 0.3 }}
                style={{ width: "50px", height: "50px", background: "red" }}
            />
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="backdrop"
                        id="overlay-backdrop"
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ width: "10px", height: "10px" }}
                    />
                )}
                {open && (
                    <motion.div
                        key="big"
                        id="overlay-big"
                        layoutId="overlay"
                        transition={{ duration: 0.3 }}
                        style={{ width: "200px", height: "200px", background: "blue" }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

/**
 * layoutId elements that render again straight after they're inserted
 * keep their animated values.
 */
function Dots(handle: Handle) {
    let count = 0
    w.addDots = () => {
        count = 3
        handle.update()
        handle.queueTask(() => handle.update())
    }
    return () => (
        <div>
            {Array.from({ length: count }).map((_, i) => (
                <motion.button
                    key={i}
                    id={"dot-" + i}
                    initial={false}
                    animate={{ scale: i ? 0.5 : 1, opacity: i ? 0.5 : 1 }}
                    layoutId={"dot-" + i}
                    style={{ width: "20px", height: "20px" }}
                />
            ))}
        </div>
    )
}

/**
 * A component without motion elements holds its exit open.
 */
function Held(handle: Handle) {
    let exit: Promise<void> | undefined
    return () => {
        if (!isPresent(handle)) {
            exit ||= new Promise((resolve) => setTimeout(resolve, 300))
            holdPresence(handle, exit)
        }
        return <div id="held">held</div>
    }
}

function Hold(handle: Handle) {
    let visible = true
    w.hideHeld = () => {
        visible = false
        handle.update()
    }
    return () => (
        <AnimatePresence onExitComplete={() => (w.heldExited = true)}>
            {visible && <Held key="held" />}
        </AnimatePresence>
    )
}

export function App() {
    return () => (
        <main>
            <PresenceData />
            <Swap />
            <Overlay />
            <Dots />
            <Hold />
        </main>
    )
}
