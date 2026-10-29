import { on, ref, type Handle } from "remix/component"
import { stagger } from "motion"
import { AnimatePresence, MotionConfig, motion } from "motion/remix"

const linear = { duration: 1, ease: "linear" } as const
const w = window as any

/**
 * A motion element inside a removed plain element still exits.
 */
function NestedExit(handle: Handle) {
    let visible = true
    w.hideNested = () => {
        visible = false
        handle.update()
    }
    return () => (
        <AnimatePresence>
            {visible && (
                <div key="wrapper" id="nested-wrapper">
                    <motion.div
                        id="nested-exit"
                        class="box"
                        exit={{ opacity: 0 }}
                        transition={linear}
                    />
                </div>
            )}
        </AnimatePresence>
    )
}

/**
 * Children animate a parent's variant change with this render's
 * transition.
 */
function VariantTransition(handle: Handle) {
    let open = false
    w.toggleVariant = () => {
        open = !open
        handle.update()
    }
    return () => (
        <motion.div animate={open ? "open" : "closed"} initial={false}>
            <motion.div
                id="variant-child"
                class="box"
                variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
                transition={{ ...linear, delay: open ? 0.5 : 0 }}
            />
        </motion.div>
    )
}

/**
 * Children added later stagger from the start of their own group.
 */
function Entering(handle: Handle) {
    let count = 2
    w.addItems = () => {
        count += 2
        handle.update()
    }
    return () => (
        <motion.ul
            initial="hidden"
            animate="visible"
            variants={{
                visible: { transition: { delayChildren: stagger(0.5) } },
            }}
        >
            {Array.from({ length: count }, (_, i) => (
                <motion.li
                    key={i}
                    id={"entering-" + i}
                    variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1 },
                    }}
                    transition={{ duration: 0.2 }}
                >
                    {i}
                </motion.li>
            ))}
        </motion.ul>
    )
}

/**
 * A layout animation uses this render's transition.
 */
function LayoutTransition(handle: Handle) {
    let isOn = false
    w.toggleLayout = () => {
        isOn = !isOn
        handle.update()
    }
    return () => (
        <div
            style={{
                display: "flex",
                width: "400px",
                justifyContent: isOn ? "flex-end" : "flex-start",
            }}
        >
            <motion.div
                id="layout-transition"
                class="box"
                layout
                transition={isOn ? linear : { duration: 0.05 }}
            />
        </div>
    )
}

/**
 * Exiting in popLayout mode, a layoutId element hands over to its
 * replacement, which animates from it.
 */
function SharedExit(handle: Handle) {
    let open = true
    w.closeShared = () => {
        open = false
        handle.update()
    }
    return () => (
        <div style={{ position: "relative", height: "300px" }}>
            {!open && (
                <motion.button
                    id="shared-button"
                    layoutId="shared"
                    transition={linear}
                    style={{ width: "50px", height: "50px" }}
                />
            )}
            <AnimatePresence mode="popLayout">
                {open && (
                    <motion.div
                        key="menu"
                        id="shared-menu"
                        layoutId="shared"
                        transition={linear}
                        exit={{ opacity: 0.5 }}
                        style={{ width: "250px", height: "250px" }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

/**
 * An inherited value that stays the same for one label still animates
 * on the next.
 */
const inherited = {
    idle: { opacity: 0.3 },
    a: { opacity: 0.3, transition: { duration: 0.2 } },
    b: { opacity: 1, transition: { duration: 0.4 } },
}

function Inherited(handle: Handle) {
    let phase = "idle"
    w.startInherited = () => {
        phase = "a"
        handle.update()
    }
    return () => (
        <motion.div
            initial={false}
            animate={phase}
            onAnimationComplete={(definition: unknown) => {
                if (definition !== "a") return
                phase = "b"
                handle.update()
            }}
        >
            <motion.div id="inherited" class="box" variants={inherited} />
        </motion.div>
    )
}

/**
 * A static style value that changes before the element mounts renders
 * the latest value.
 */
function StaticBeforeMount(handle: Handle) {
    let x = 160
    return () => (
        <div
            mix={ref(() => {
                x = 27
                handle.update()
            })}
        >
            <motion.div id="static-before-mount" class="box" style={{ x }} />
        </div>
    )
}

/**
 * anchorX="right" keeps a popped exiting element pinned to the right.
 */
function AnchorRight(handle: Handle) {
    let visible = true
    w.hideAnchor = () => {
        visible = false
        handle.update()
    }
    return () => (
        <div
            id="anchor-parent"
            style={{
                position: "relative",
                display: "flex",
                justifyContent: "flex-end",
                width: "300px",
            }}
        >
            <AnimatePresence mode="popLayout" anchorX="right">
                {visible && (
                    <motion.span
                        key="anchor"
                        id="anchor-right"
                        exit={{ opacity: 0 }}
                        transition={linear}
                        style={{ width: "50px", height: "20px" }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

/**
 * A nested MotionConfig keeps the outer reducedMotion.
 */
function NestedConfig() {
    return () => (
        <MotionConfig reducedMotion="always">
            <MotionConfig transition={{ duration: 1 }}>
                <motion.div
                    id="nested-config"
                    class="box"
                    initial={{ x: 0 }}
                    animate={{ x: 100 }}
                />
            </MotionConfig>
        </MotionConfig>
    )
}

function Drag(handle: Handle) {
    let enabled = false
    w.enableDrag = () => {
        enabled = true
        handle.update()
    }
    return () => (
        <div>
            <motion.div
                id="drag-x"
                class="box"
                drag="x"
                whileTap={{ scale: 0.9 }}
            />
            <motion.div
                id="drag-later"
                class="box"
                drag={enabled ? "x" : false}
            />
        </div>
    )
}

export function App() {
    return () => (
        <main>
            <NestedExit />
            <VariantTransition />
            <Entering />
            <LayoutTransition />
            <SharedExit />
            <Inherited />
            <StaticBeforeMount />
            <AnchorRight />
            <NestedConfig />
            <Drag />
            <button mix={on("click", () => {})}>noop</button>
        </main>
    )
}
