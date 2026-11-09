import { domMax, LazyMotion, motion, pinchFeatures } from "framer-motion"

/**
 * Pinch (two touches, or a trackpad pinch) to zoom and rotate, and drag to
 * move. Past its limits the photo resists, and springs back on release.
 * Rotation snaps to the nearest 90deg.
 */
export const App = () => (
    <LazyMotion features={{ ...domMax, ...pinchFeatures }}>
        <motion.div
            drag
            dragMomentum={false}
            pinch={{
                scale: { min: 1, max: 4 },
                rotate: { snap: 90 },
            }}
            style={{
                width: 300,
                height: 200,
                borderRadius: 20,
                background: "linear-gradient(135deg, #ff0088 0%, #8800ff 100%)",
            }}
        />
    </LazyMotion>
)
