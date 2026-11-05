import { domMax, domMax3D, LazyMotion, m } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Layout animations inside, and between, containers turned by CSS that
 * Motion doesn't control. `domMax3D` animates them with quad projection.
 * `?box` uses `domMax`, which animates their bounding boxes. Used by
 * tests/react/layout-3d.spec.ts.
 *
 * ?shared moves a layoutId card from a flat container into the turned one,
 * otherwise a box moves inside the turned container. window.move() starts
 * the change. ?end renders the moved layout from the start.
 */

const probes = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
].map(([left, top], i) => (
    <div
        key={i}
        data-probe
        style={{
            position: "absolute",
            left: `${left}%`,
            top: `${top}%`,
            width: 0,
            height: 0,
        }}
    />
))

const transition = { duration: 10, ease: "linear" } as const

const Box = ({ moved, layoutId }: { moved: boolean; layoutId?: string }) => (
    <m.div
        id="box"
        layout
        layoutId={layoutId}
        transition={transition}
        style={{
            position: "absolute",
            left: moved ? 240 : 20,
            top: moved ? 180 : 20,
            width: 100,
            height: 80,
            background: "#00cc88",
        }}
    >
        {probes}
    </m.div>
)

const container = {
    position: "absolute",
    width: 400,
    height: 300,
    background: "#eee",
} as const

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const features = params.has("box") ? domMax : domMax3D
    const shared = params.has("shared")
    const [moved, setMoved] = useState(params.has("end"))

    useEffect(() => {
        ;(window as any).move = () => setMoved(true)
    }, [])

    return (
        <LazyMotion features={features}>
            {shared ? (
                <>
                    <div id="flat" style={{ ...container, left: 20, top: 20 }}>
                        {!moved && (
                            <Box key="a" moved={false} layoutId="card" />
                        )}
                    </div>
                    <div
                        id="turned"
                        style={{
                            ...container,
                            left: 500,
                            top: 200,
                            transform: "rotate(40deg)",
                        }}
                    >
                        {moved && <Box key="b" moved layoutId="card" />}
                    </div>
                </>
            ) : (
                <div
                    id="turned"
                    style={{
                        ...container,
                        left: 250,
                        top: 150,
                        transform: "rotate(40deg)",
                    }}
                >
                    <Box moved={moved} />
                </div>
            )}
        </LazyMotion>
    )
}
