import {
    animateMini,
    mix,
    motion,
    MotionConfig,
    MotionGlobalConfig,
} from "framer-motion"
import { useEffect, useRef } from "react"

function isP3<T>(value: T): value is T {
    return typeof value === "string" && value.startsWith("color(display-p3")
}
MotionGlobalConfig.mix = function <T>(a: T, b: T): (p: number) => T {
    if (isP3(a) || isP3(b)) {
        return () => "black" as T
    }

    return mix(a, b) as (p: number) => T
}

/**
 * This test ensures different color types are animated
 * correctly with WAAPI.
 */
export const App = () => {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const animation = animateMini(ref.current!, {
            backgroundColor: [
                "color(display-p3 0 1 0 / 1)",
                "rgba(0, 0, 255, 1)",
            ],
        })

        return () => animation.stop()
    }, [])

    return (
        <MotionConfig transition={{ duration: 1 }}>
            {/* CSS vars: RGBA -> P3 */}
            <motion.div
                className="box"
                style={{ backgroundColor: "var(--abc, rgb(255, 255, 0))" }}
                animate={{ backgroundColor: "color(display-p3 0 1 0 / 0.5)" }}
            />
            {/* CSS vars: P3 -> RGBA */}
            <motion.div
                className="box"
                style={{ backgroundColor: "var(--abc, rgb(255, 255, 0))" }}
                animate={{ backgroundColor: "rgba(0, 0, 255, 1)" }}
            />
            {/* Named color */}
            <motion.div
                className="box"
                initial={{ backgroundColor: "red" }}
                animate={{ backgroundColor: "blue" }}
            />
            {/* P3 -> RGBA */}
            <motion.div
                className="box"
                initial={{ backgroundColor: "color(display-p3 0 1 0 / 1)" }}
                animate={{ backgroundColor: "rgba(0, 0, 255, 1)" }}
            />
            {/* RGBA -> P3 */}
            <motion.div
                className="box"
                initial={{ backgroundColor: "rgba(0, 0, 255, 1)" }}
                animate={{ backgroundColor: "color(display-p3 0 1 0 / 0.5)" }}
            />
            {/* Computed P3 -> RGBA */}
            <motion.div
                className="box p3"
                animate={{ backgroundColor: "rgba(0, 0, 255, 1)" }}
            />
            {/* Computed P3 -> RGBA */}
            <div ref={ref} className="box p3" />
            <StyleSheet />
        </MotionConfig>
    )
}

function StyleSheet() {
    return (
        <style>{`
            body {
              @supports (background: color(display-p3 1 1 1)) { 
                --abc: color(display-p3 0 1 0);
                --def: color(display-p3 0 1 1);
              }
            }


            .box {
                width: 100px;
                height: 100px;
                background-color: #fff;
            }
            .p3 {
                background-color: color(display-p3 0 1 0 / 1);
            }   
        `}</style>
    )
}
