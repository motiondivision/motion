import {
    animate,
    domMax,
    LazyMotion,
    motion,
    pinchFeatures,
    useMotionValue,
} from "framer-motion"

/**
 * Pinch (two touches, or a trackpad pinch) to zoom and rotate, and drag to
 * move. Letting go below 1x springs back.
 */
export const App = () => {
    const scale = useMotionValue(1)
    const rotate = useMotionValue(0)
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    return (
        <LazyMotion features={{ ...domMax, ...pinchFeatures }}>
            <motion.div
                drag
                dragMomentum={false}
                pinch={{
                    rotate: true,
                    min: 0.5,
                    max: 4,
                    onEnd: () => {
                        if (scale.get() < 1) {
                            animate(scale, 1)
                            animate(rotate, 0)
                            animate(x, 0)
                            animate(y, 0)
                        }
                    },
                }}
                style={{
                    scale,
                    rotate,
                    x,
                    y,
                    width: 300,
                    height: 200,
                    borderRadius: 20,
                    background:
                        "linear-gradient(135deg, #ff0088 0%, #8800ff 100%)",
                }}
            />
        </LazyMotion>
    )
}
