/**
 * Pages for tests/react/async-features.spec.ts. They have their own entry,
 * as the main one imports every test page, and any page that makes a
 * `motion` component loads the layout and drag features for all of them.
 */
import { AnimatePresence, motion as asyncMotion } from "framer-motion/core"
import * as React from "react"
import { StrictMode, useState } from "react"
import ReactDOMClient from "react-dom/client"

const { Activity } = React as any

const params = new URLSearchParams(window.location.search)
const testCase = params.get("case")

const linear = (duration: number) =>
    ({ type: "tween", ease: "linear", duration }) as const

const box = { height: 100, background: "red" }

/**
 * A layout change, made before or after the layout feature arrives.
 */
function Layout({ motion = asyncMotion }) {
    const [isWide, setWide] = useState(false)

    return (
        <>
            <button id="toggle" onClick={() => setWide(!isWide)} />
            <motion.div
                id="box"
                layout
                transition={linear(10)}
                style={{ ...box, width: isWide ? 400 : 100 }}
            />
        </>
    )
}

/**
 * The layout feature arrives while the modal exits. The modal then enters
 * again before it's removed, and later exits with only its layout
 * animation to wait for.
 */
function Presence({ motion = asyncMotion }) {
    const [isOpen, setOpen] = useState(true)
    const [hasExit, setExit] = useState(true)

    return (
        <>
            <button id="toggle" onClick={() => setOpen(!isOpen)} />
            <button id="no-exit" onClick={() => setExit(false)} />
            <motion.div
                id="thumbnail"
                layoutId="shared"
                transition={linear(2)}
                style={{ ...box, width: 100 }}
            />
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        id="modal"
                        key="modal"
                        layoutId="shared"
                        exit={hasExit ? { opacity: 0.9 } : undefined}
                        transition={linear(2)}
                        style={{
                            ...box,
                            position: "absolute",
                            top: 300,
                            left: 300,
                            width: 300,
                        }}
                    />
                )}
            </AnimatePresence>
        </>
    )
}

/**
 * Two mounted elements share a layoutId when the layout feature arrives.
 */
function Shared({ motion = asyncMotion }) {
    return (
        <>
            <motion.div
                id="a"
                layoutId="shared"
                transition={linear(2)}
                style={{ ...box, width: 100 }}
            />
            <motion.div
                id="b"
                layoutId="shared"
                transition={linear(2)}
                style={{ ...box, width: 300, marginTop: 200, marginLeft: 200 }}
            />
        </>
    )
}

/**
 * The features arrive while the elements are hidden.
 */
function Hidden({ motion = asyncMotion }) {
    const [isHidden, setHidden] = useState(false)
    const [isWide, setWide] = useState(false)

    return (
        <>
            <button id="hide" onClick={() => setHidden(!isHidden)} />
            <button id="toggle" onClick={() => setWide(!isWide)} />
            <Activity mode={isHidden ? "hidden" : "visible"}>
                <motion.div id="parent" style={{ padding: 20 }}>
                    <motion.div
                        id="box"
                        layout
                        transition={linear(10)}
                        style={{ ...box, width: isWide ? 400 : 100 }}
                    />
                    <motion.div
                        id="drag"
                        drag
                        dragMomentum={false}
                        style={{ ...box, width: 100, background: "blue" }}
                    />
                </motion.div>
            </Activity>
        </>
    )
}

const cases: Record<string, typeof Layout> = {
    layout: Layout,
    presence: Presence,
    shared: Shared,
    hidden: Hidden,
}

async function start() {
    /**
     * The components that bundle their features, to compare with.
     */
    const motion =
        params.get("impl") === "sync"
            ? (await import("framer-motion")).motion
            : undefined

    const Case = cases[testCase!]
    const app = <Case motion={motion as typeof asyncMotion} />

    ReactDOMClient.createRoot(document.getElementById("root")!).render(
        params.has("strict") ? <StrictMode>{app}</StrictMode> : app
    )
}

start()
