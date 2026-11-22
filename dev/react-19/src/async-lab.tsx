/**
 * A page to try `motion` from motion/react by hand: components that fetch
 * their animation, layout and drag code, with enter animations that run as
 * CSS until the animation code arrives.
 *
 * "Code delay" holds the feature files back in the dev server (see
 * vite.config.ts), so an enter animation can be interrupted before, as, or
 * after its code arrives. tests/react/async-lab.spec.ts drives the same
 * scenarios.
 */
import {
    AnimatePresence,
    motion,
    Reorder,
    stagger,
    useAnimate,
    useAnimationControls,
} from "motion/react"
import { useEffect, useRef, useState } from "react"
import ReactDOMClient from "react-dom/client"

const stored = (key: string, fallback: string) => {
    try {
        return localStorage.getItem(key) ?? fallback
    } catch {
        return fallback
    }
}

const store = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value)
    } catch {}
}

const interruptAfter = parseInt(stored("lab-interrupt", "800"))

const linear = { type: "tween", ease: "linear", duration: 3 } as const
/**
 * Slow enough to interrupt by hand, with an overshoot that shows if the
 * velocity carries over.
 */
const slowSpring = { type: "spring", visualDuration: 2, bounce: 0.5 } as const
const box = {
    width: 100,
    height: 100,
    borderRadius: 16,
    background: "#0cdcf7",
}
const row = { display: "flex", gap: 24, alignItems: "center" } as const

/**
 * Runs `interrupt` after the chosen time, and from the Interrupt button.
 */
function useInterrupt(interrupt: VoidFunction) {
    const latest = useRef(interrupt)
    latest.current = interrupt

    useEffect(() => {
        const run = () => latest.current()
        window.addEventListener("lab-interrupt", run)
        const timer = interruptAfter && setTimeout(run, interruptAfter)

        return () => {
            window.removeEventListener("lab-interrupt", run)
            timer && clearTimeout(timer)
        }
    }, [])
}

const Label = ({ children }: { children: React.ReactNode }) => (
    <p style={{ margin: "24px 0 8px", opacity: 0.7 }}>{children}</p>
)

/**
 * Enter animations of every kind CSS can and can't run.
 */
function Enter() {
    return (
        <>
            <Label>Tween: opacity and x</Label>
            <motion.div
                id="tween"
                initial={{ opacity: 0, x: -300 }}
                animate={{ opacity: 1, x: 0 }}
                transition={linear}
                style={box}
            />
            <Label>Default spring: x and scale</Label>
            <motion.div
                id="spring"
                initial={{ x: -300, scale: 0.5 }}
                animate={{ x: 0, scale: 1 }}
                style={box}
            />
            <Label>Slow spring: x and scale</Label>
            <motion.div
                id="slow-spring"
                initial={{ x: -300, scale: 0.5 }}
                animate={{ x: 0, scale: 1 }}
                transition={slowSpring}
                style={box}
            />
            <Label>
                Own timing: x for 3 s, scale for 1 s, rotate after 1 s
            </Label>
            <motion.div
                id="independent"
                initial={{ x: -300, scale: 0.5, rotate: -90 }}
                animate={{ x: 0, scale: 1, rotate: 0 }}
                transition={{
                    x: linear,
                    scale: { ...linear, duration: 1 },
                    rotate: { ...linear, duration: 1, delay: 1 },
                }}
                style={box}
            />
            <Label>Colour and radius</Label>
            <motion.div
                id="colour"
                initial={{ backgroundColor: "#ff0088", borderRadius: 0 }}
                animate={{ backgroundColor: "#0cdcf7", borderRadius: 50 }}
                transition={linear}
                style={{ ...box, background: undefined }}
            />
        </>
    )
}

/**
 * Layout animations that start while an enter animation runs.
 */
function Layout() {
    const [isMoved, setMoved] = useState(false)
    useInterrupt(() => setMoved((moved) => !moved))

    const justify = isMoved ? "flex-end" : "flex-start"

    return (
        <>
            <Label>
                Spring enter into a spring layout animation: the child springs
                in as CSS (x, scale, rotate), and the interrupt moves and
                resizes its layout parent
            </Label>
            <div style={{ display: "flex", justifyContent: justify }}>
                <motion.div
                    id="spring-parent"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={slowSpring}
                    style={{
                        ...box,
                        width: isMoved ? 320 : 180,
                        height: isMoved ? 140 : 100,
                        background: "#8df0cc",
                        padding: 20,
                        boxSizing: "border-box",
                    }}
                >
                    <motion.div
                        id="spring-child"
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={slowSpring}
                        style={{
                            ...box,
                            width: 60,
                            height: 60,
                            marginLeft: isMoved ? "auto" : 0,
                            background: "#ff0088",
                        }}
                    >
                        <motion.div
                            id="spring-grandchild"
                            initial={{ x: -120, scale: 0.3, rotate: -180 }}
                            animate={{ x: 0, scale: 1, rotate: 0 }}
                            transition={slowSpring}
                            style={{
                                ...box,
                                width: 30,
                                height: 30,
                                margin: 15,
                                borderRadius: 6,
                                background: "#fff",
                            }}
                        />
                    </motion.div>
                </motion.div>
            </div>
            <Label>layout + opacity enter (opacity runs as CSS)</Label>
            <div style={{ display: "flex", justifyContent: justify }}>
                <motion.div
                    id="layout-opacity"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={linear}
                    style={{ ...box, width: isMoved ? 200 : 100 }}
                />
            </div>
            <Label>
                layout + x enter (x runs as CSS, and the animation code takes it
                over when the layout animation starts)
            </Label>
            <div style={{ display: "flex", justifyContent: justify }}>
                <motion.div
                    id="layout-x"
                    layout
                    initial={{ opacity: 0, x: -200 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={linear}
                    style={box}
                />
            </div>
            <Label>layout parent, child with a CSS x and scale enter</Label>
            <div style={{ display: "flex", justifyContent: justify }}>
                <motion.div
                    id="layout-parent"
                    layout
                    transition={linear}
                    style={{
                        ...box,
                        width: isMoved ? 300 : 200,
                        background: "#8df0cc",
                        padding: 20,
                    }}
                >
                    <motion.div
                        id="layout-child"
                        initial={{ x: -100, scale: 0.5 }}
                        animate={{ x: 0, scale: 1 }}
                        transition={linear}
                        style={{ ...box, width: 60, height: 60 }}
                    />
                </motion.div>
            </div>
            <Label>layoutId, shared between two places</Label>
            <div style={{ ...row, justifyContent: "space-between" }}>
                {[false, true].map(
                    (side) =>
                        side === isMoved && (
                            <motion.div
                                key={String(side)}
                                id="layout-shared"
                                layoutId="shared"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={linear}
                                style={{
                                    ...box,
                                    marginLeft: side ? "auto" : 0,
                                }}
                            />
                        )
                )}
            </div>
        </>
    )
}

/**
 * The target of `animate` changes while the enter animation runs.
 */
function Target() {
    const [isChanged, setChanged] = useState(false)
    useInterrupt(() => setChanged((changed) => !changed))

    return (
        <>
            <Label>x goes to 0, then to 300 when interrupted</Label>
            <motion.div
                id="target-x"
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: isChanged ? 300 : 0, opacity: 1 }}
                transition={linear}
                style={box}
            />
            <Label>Spring, with scale that keeps its target</Label>
            <motion.div
                id="target-spring"
                initial={{ x: -300, scale: 0.5 }}
                animate={{ x: isChanged ? 300 : 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 20, damping: 6 }}
                style={box}
            />
            <Label>Variants</Label>
            <motion.div
                id="target-variants"
                variants={{
                    hidden: { opacity: 0, x: -300 },
                    visible: { opacity: 1, x: 0 },
                    moved: { opacity: 0.5, x: 300 },
                }}
                initial="hidden"
                animate={isChanged ? "moved" : "visible"}
                transition={linear}
                style={box}
            />
        </>
    )
}

/**
 * Gestures, which work before any code is fetched.
 */
function Gestures() {
    return (
        <>
            <Label>whileHover scale, during an x and scale enter</Label>
            <motion.div
                id="hover"
                initial={{ x: -300, scale: 0.5 }}
                animate={{ x: 0, scale: 1 }}
                whileHover={{ scale: 1.5 }}
                transition={linear}
                style={{ ...box, marginLeft: 300 }}
            />
            <Label>
                whileHover opacity and colour, during an opacity enter
            </Label>
            <motion.div
                id="hover-opacity"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ opacity: 0.5, backgroundColor: "#ff0088" }}
                transition={linear}
                style={box}
            />
            <Label>whileTap and whileFocus</Label>
            <motion.button
                id="tap"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.8 }}
                whileFocus={{ outline: "4px solid #ff0088" }}
                transition={linear}
                style={{ ...box, border: 0 }}
            >
                Tap
            </motion.button>
            <Label>drag (fetches the drag code)</Label>
            <motion.div
                id="drag"
                drag
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={linear}
                style={box}
            />
        </>
    )
}

/**
 * Components that are removed while their enter animations run.
 */
function Exit() {
    const [isVisible, setVisible] = useState(true)
    useInterrupt(() => setVisible((visible) => !visible))

    return (
        <>
            <Label>Exit: fades and moves right when interrupted</Label>
            <div style={{ height: 100 }}>
                <AnimatePresence>
                    {isVisible && (
                        <motion.div
                            id="exit"
                            initial={{ opacity: 0, x: -300 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 300 }}
                            transition={linear}
                            style={box}
                        />
                    )}
                </AnimatePresence>
            </div>
            <Label>mode="wait": the next one enters after the exit</Label>
            <div style={{ height: 100 }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={String(isVisible)}
                        id="exit-wait"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ ...linear, duration: 1 }}
                        style={{
                            ...box,
                            background: isVisible ? "#0cdcf7" : "#ff0088",
                        }}
                    />
                </AnimatePresence>
            </div>
        </>
    )
}

/**
 * Animations started from code.
 */
function Imperative() {
    const controls = useAnimationControls()
    const [scope, animate] = useAnimate()

    useEffect(() => {
        controls.start({ x: 0, opacity: 1, transition: linear })
    }, [controls])

    useInterrupt(() => {
        controls.start({ x: 300, transition: linear })
        animate(scope.current, { x: 300 }, linear)
    })

    return (
        <>
            <Label>useAnimationControls: started in an effect at mount</Label>
            <motion.div
                id="controls"
                initial={{ x: -300, opacity: 0 }}
                animate={controls}
                style={box}
            />
            <Label>useAnimate on a component with an enter animation</Label>
            <motion.div
                id="animate"
                ref={scope}
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={linear}
                style={box}
            />
        </>
    )
}

/**
 * A parent that staggers children, which take its variants.
 */
function Stagger() {
    const [isVisible, setVisible] = useState(true)
    useInterrupt(() => setVisible((visible) => !visible))

    return (
        <>
            <Label>Children take the parent's variants, 0.2 s apart</Label>
            <motion.div
                id="stagger"
                variants={{
                    hidden: { opacity: 0 },
                    visible: {
                        opacity: 1,
                        transition: {
                            delayChildren: stagger(0.2),
                            duration: 1,
                        },
                    },
                }}
                initial="hidden"
                animate={isVisible ? "visible" : "hidden"}
                style={{ ...row, padding: 20, background: "#8df0cc" }}
            >
                {[0, 1, 2, 3].map((index) => (
                    <motion.div
                        key={index}
                        id={"stagger-" + index}
                        variants={{
                            hidden: { opacity: 0, y: 60 },
                            visible: {
                                opacity: 1,
                                y: 0,
                                transition: { duration: 1 },
                            },
                        }}
                        style={box}
                    />
                ))}
            </motion.div>
        </>
    )
}

/**
 * Enter animations that CSS can't run. One of these on a page turns the
 * CSS enter animations of the whole page off, so they all start together
 * when the animation code arrives. Development builds log a warning.
 */
function Invalid() {
    const [isMoved, setMoved] = useState(false)
    useInterrupt(() => setMoved((moved) => !moved))

    const justify = isMoved ? "flex-end" : "flex-start"

    return (
        <>
            <Label>
                A tween that CSS can run. It waits too, so it starts with the
                others
            </Label>
            <motion.div
                id="invalid-tween"
                initial={{ opacity: 0, x: -300 }}
                animate={{ opacity: 1, x: 0 }}
                transition={linear}
                style={box}
            />
            <Label>Keyframes </Label>
            <motion.div
                id="keyframes"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.3, 1] }}
                transition={linear}
                style={box}
            />
        </>
    )
}

/**
 * Reorder, which needs layout and drag.
 */
function ReorderList() {
    const [items, setItems] = useState(["One", "Two", "Three", "Four"])
    useInterrupt(() => setItems((items) => [...items].reverse()))

    return (
        <>
            <Label>Drag to reorder. Interrupt reverses the list.</Label>
            <Reorder.Group
                axis="y"
                values={items}
                onReorder={setItems}
                style={{ listStyle: "none", padding: 0, width: 300 }}
            >
                {items.map((item) => (
                    <Reorder.Item
                        key={item}
                        value={item}
                        id={"reorder-" + item}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={linear}
                        style={{
                            ...box,
                            width: 300,
                            height: 50,
                            marginBottom: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {item}
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </>
    )
}

const scenarios: { [name: string]: () => React.ReactNode } = {
    "Enter animations": Enter,
    "Layout animation interrupts enter": Layout,
    "Target changes during enter": Target,
    "Gestures during enter": Gestures,
    "Exit during enter": Exit,
    "Controls and useAnimate": Imperative,
    "Staggered variants": Stagger,
    "An enter animation CSS can't run": Invalid,
    Reorder: ReorderList,
}

/**
 * The dev server marks the files Motion fetches itself with ?lazy.
 */
const files = {
    animation: /animation\/appear\/animations\.mjs\?lazy/,
    layout: /motion\/features\/layout\.mjs\?lazy/,
    drag: /motion\/features\/drag\.mjs\?lazy/,
}

/**
 * When each feature file arrived, from the browser's own record.
 */
function Arrivals() {
    const [arrived, setArrived] = useState<{ [name: string]: number }>({})

    useEffect(() => {
        const read = () => {
            const next: { [name: string]: number } = {}
            for (const entry of performance.getEntriesByType("resource")) {
                for (const name in files) {
                    if (files[name as keyof typeof files].test(entry.name)) {
                        next[name] = Math.round(
                            (entry as PerformanceResourceTiming).responseEnd
                        )
                    }
                }
            }
            setArrived((latest) =>
                JSON.stringify(latest) === JSON.stringify(next) ? latest : next
            )
        }
        const timer = setInterval(read, 100)
        return () => clearInterval(timer)
    }, [])

    return (
        <span id="arrivals">
            {Object.keys(files)
                .map((name) =>
                    arrived[name]
                        ? `${name} at ${arrived[name]} ms`
                        : `${name} not fetched`
                )
                .join(" · ")}
        </span>
    )
}

function Select({
    id,
    label,
    value,
    options,
}: {
    id: string
    label: string
    value: string
    options: { [value: string]: string }
}) {
    return (
        <label>
            {label}{" "}
            <select
                id={id}
                value={value}
                onChange={(event) => {
                    store("lab-" + id, event.target.value)

                    /**
                     * The dev server reads the delay from a cookie.
                     */
                    if (id === "delay") {
                        document.cookie = `motion-delay=${event.target.value};path=/`
                    }

                    location.reload()
                }}
            >
                {Object.keys(options).map((option) => (
                    <option key={option} value={option}>
                        {options[option]}
                    </option>
                ))}
            </select>
        </label>
    )
}

const times = (values: number[], none: string) =>
    Object.fromEntries(values.map((ms) => [String(ms), ms ? `${ms} ms` : none]))

function App() {
    const name = stored("lab-scenario", "Layout animation interrupts enter")
    const Scenario = scenarios[name] || Enter

    return (
        <div
            style={{
                font: "14px/1.4 system-ui, sans-serif",
                color: "#fff",
                background: "#0b1011",
                minHeight: "100vh",
                padding: 24,
                boxSizing: "border-box",
                overflow: "hidden",
            }}
        >
            <div style={{ ...row, flexWrap: "wrap", gap: 16 }}>
                <Select
                    id="scenario"
                    label="Scenario"
                    value={name}
                    options={Object.fromEntries(
                        Object.keys(scenarios).map((key) => [key, key])
                    )}
                />
                <Select
                    id="delay"
                    label="Code delay"
                    value={stored("lab-delay", "0")}
                    options={times([0, 500, 1500, 3000, 6000], "none")}
                />
                <Select
                    id="interrupt"
                    label="Interrupt after"
                    value={String(interruptAfter)}
                    options={times([0, 300, 800, 2000], "off")}
                />
                <button
                    id="interrupt-now"
                    onClick={() =>
                        window.dispatchEvent(new Event("lab-interrupt"))
                    }
                >
                    Interrupt now
                </button>
                <button id="replay" onClick={() => location.reload()}>
                    Replay
                </button>
            </div>
            <p style={{ opacity: 0.7 }}>
                Each scenario has one interruption: a layout change, a new
                target, an exit, a reorder. It runs once after the "Interrupt
                after" time, and each time you press "Interrupt now". "Code
                delay" holds back the animation, layout and drag code.
            </p>
            <p style={{ opacity: 0.7 }}>
                <Arrivals />
            </p>
            <Scenario />
        </div>
    )
}

document.cookie = `motion-delay=${stored("lab-delay", "0")};path=/`

ReactDOMClient.createRoot(document.getElementById("root")!).render(<App />)
