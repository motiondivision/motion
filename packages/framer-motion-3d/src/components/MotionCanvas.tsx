"use client"

import {
    Camera,
    events as createPointerEvents,
    createRoot,
    Dpr,
    Props,
    ReconcilerRoot,
    unmountComponentAtNode,
} from "@react-three/fiber"
import {
    clamp,
    MotionConfigContext,
    MotionContext,
    useForceUpdate,
    useIsomorphicLayoutEffect,
} from "framer-motion"
import * as React from "react"
import {
    forwardRef,
    MutableRefObject,
    useContext,
    useLayoutEffect,
    useRef,
} from "react"
import { mergeRefs } from "react-merge-refs"
import { DimensionsState, MotionCanvasContext } from "./MotionCanvasContext"

export interface MotionCanvasProps extends Omit<Props, "resize"> {}

type SetBlock = false | Promise<null> | null
type UnblockProps = {
    set: React.Dispatch<React.SetStateAction<SetBlock>>
    children: React.ReactNode
}

const devicePixelRatio =
    typeof window !== "undefined" ? window.devicePixelRatio : 1

const calculateDpr = (dpr?: Dpr) =>
    Array.isArray(dpr)
        ? clamp(dpr[0], dpr[1], devicePixelRatio)
        : dpr || devicePixelRatio

/**
 * This file contains a version of R3F's Canvas component that uses our projection
 * system for layout measurements instead of use-react-measure so we can keep the
 * projection and cameras in frame.
 *
 * https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/src/web/Canvas.tsx
 */

function Block({ set }: Omit<UnblockProps, "children">) {
    useIsomorphicLayoutEffect(() => {
        set(new Promise(() => null))
        return () => set(false)
    }, [])
    return null
}

class ErrorBoundary extends React.Component<
    { set: React.Dispatch<any>; children: React.ReactNode },
    { error: boolean }
> {
    state = { error: false }
    static getDerivedStateFromError = () => ({ error: true })
    componentDidCatch(error: any) {
        this.props.set(error)
    }
    render() {
        return this.state.error ? null : this.props.children
    }
}

function CanvasComponent(
    {
        children,
        fallback,
        tabIndex,
        id,
        style,
        className,
        events,
        ...props
    }: MotionCanvasProps,
    forwardedRef: MutableRefObject<HTMLCanvasElement>
) {
    /**
     * Import existing contexts to pass through variants and MotionConfig from
     * the DOM to the 3D tree. Shared variants aren't officially supported yet
     * because the parent DOM tree fires effects before the 3D tree, whereas
     * variants are expected to run from bottom-up in useEffect.
     */
    const motionContext = useContext(MotionContext)
    const configContext = useContext(MotionConfigContext)
    const [forceRender] = useForceUpdate()

    const layoutCamera = useRef<Camera>(null)
    const dimensions = useRef<DimensionsState>({
        size: { width: 0, height: 0 },
    })
    const { size, dpr } = dimensions.current

    const containerRef = useRef<HTMLDivElement>(null)

    const handleResize = (): void => {
        const container = containerRef.current!
        dimensions.current = {
            size: {
                width: container.offsetWidth,
                height: container.offsetHeight,
            },
        }
        forceRender()
    }

    // Set canvas size on mount
    useLayoutEffect(handleResize, [])

    const canvasRef = React.useRef<HTMLCanvasElement>(null!)
    const [block, setBlock] = React.useState<SetBlock>(false)
    const [error, setError] = React.useState<any>(false)

    // Suspend this component if block is a promise (2nd run)
    if (block) throw block
    // Throw exception outwards if anything within canvas throws
    if (error) throw error

    const root = useRef<ReconcilerRoot<HTMLCanvasElement> | null>(null)
    if (size.width > 0 && size.height > 0) {
        if (!root.current) {
            root.current = createRoot(canvasRef.current)
        }
        root.current!.configure({
            ...props,
            dpr: dpr || props.dpr,
            size: { ...size, top: 0, left: 0 },
            events: events || createPointerEvents,
        }).render(
            <ErrorBoundary set={setError}>
                <React.Suspense fallback={<Block set={setBlock} />}>
                    <MotionCanvasContext.Provider
                        value={{
                            dimensions,
                            layoutCamera,
                            requestedDpr: calculateDpr(props.dpr),
                        }}
                    >
                        <MotionConfigContext.Provider value={configContext}>
                            <MotionContext.Provider value={motionContext}>
                                {children}
                            </MotionContext.Provider>
                        </MotionConfigContext.Provider>
                    </MotionCanvasContext.Provider>
                </React.Suspense>
            </ErrorBoundary>
        )
    }

    useIsomorphicLayoutEffect(() => {
        const container = canvasRef.current
        return () => unmountComponentAtNode(container)
    }, [])

    return (
        <div
            ref={containerRef}
            id={id}
            className={className}
            tabIndex={tabIndex}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                ...style,
            }}
        >
            <canvas
                ref={mergeRefs([canvasRef, forwardedRef])}
                style={{ display: "block" }}
            >
                {fallback}
            </canvas>
        </div>
    )
}

/**
 * @deprecated Motion 3D is deprecated.
 */
export const MotionCanvas = forwardRef(CanvasComponent)
