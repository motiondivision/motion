import { LayoutGroup, motion } from "framer-motion"
import { Fragment, memo, useEffect, useState } from "react"

/**
 * #box is dragged, and memoized. "r" grows #spacer, above it, and unmounts
 * #gone in the same commit, while no mounted motion component re-renders.
 * So the layout update starts in #gone's unmount, while React is already
 * changing the DOM (#spacer has already grown).
 *
 * #gone has a layoutId. With ?group it's also in a LayoutGroup with another
 * (memoized) member, which #gone's unmount updates too.
 */
const group = new URLSearchParams(window.location.search).has("group")
const Wrapper = group ? LayoutGroup : Fragment

const Box = memo(() => (
    <motion.div
        id="box"
        drag
        dragMomentum={false}
        style={{ width: 100, height: 100, background: "red" }}
    />
))

const Member = memo(() => (
    <motion.div layout style={{ width: 50, height: 20, background: "blue" }} />
))

export const App = () => {
    const [open, setOpen] = useState(false)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) =>
            e.key === "r" && setOpen((o) => !o)
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    return (
        <>
            <Wrapper>
                <div id="spacer" style={{ height: open ? 150 : 50 }} />
                <div>
                    {!open && (
                        <motion.div
                            id="gone"
                            layoutId="gone"
                            style={{ width: 50, height: 20, background: "green" }}
                        />
                    )}
                </div>
                {group && <Member />}
            </Wrapper>
            <Box />
        </>
    )
}
