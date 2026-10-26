import {
    animate,
    domMax,
    LazyMotion,
    motion,
    pinchFeatures,
} from "framer-motion"
import { useRef } from "react"

/**
 * Pinch (two touches, or a trackpad pinch) to zoom and rotate. Drag to
 * move. Releasing below 1x springs back.
 */
export const App = () => {
    const ref = useRef<HTMLDivElement>(null)

    return (
        <LazyMotion features={{ ...domMax, ...pinchFeatures }}>
            <motion.div
                ref={ref}
                drag
                dragMomentum={false}
                pinch={{
                    rotate: true,
                    min: 0.5,
                    max: 4,
                    onEnd: (_, info) => {
                        if (info.scale < 1 && ref.current) {
                            animate(ref.current, {
                                scale: 1,
                                rotate: 0,
                                x: 0,
                                y: 0,
                            })
                        }
                    },
                }}
                style={{
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
