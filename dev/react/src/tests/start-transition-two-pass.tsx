import { animate, motion } from "framer-motion"
import {
    memo,
    startTransition,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useTransition,
} from "react"
import {
    SlowList as SlowListBase,
    click,
    duration,
    linear,
    log,
    params,
    runScript,
    update,
} from "./start-transition-helpers"

/**
 * The two-pass pattern Motion+ AnimateNumber uses: a layout effect starts a
 * FLIP animation (the digit roll) immediately, and a *second* render, caused
 * by a setState in an effect, triggers the `layout` width animation.
 *
 * ?mode=sync|transition|useTransition     how the value change is wrapped
 * ?inner=effect|layoutEffect|effectTransition|layoutEffectTransition
 *                                          where/how the width setState runs
 */

const SlowList = memo(SlowListBase)
const inner = params.get("inner") || "effect"
const widths: Record<number, number> = { 1: 100, 2: 300 }

function setTargetWidth(setWidth: (width: number) => void, width: number) {
    log("set-width")
    inner.endsWith("Transition")
        ? startTransition(() => setWidth(width))
        : setWidth(width)
}

function Digit({ value }: { value: number }) {
    const target = widths[value]
    const [width, setWidth] = useState(target)
    const roll = useRef<HTMLDivElement>(null)
    const prev = useRef(value)

    useLayoutEffect(() => {
        if (value === prev.current) return
        prev.current = value
        log("roll-start")
        animate(roll.current!, { y: [100, 0] }, { ...linear, duration })
    }, [value])

    useLayoutEffect(() => {
        inner.startsWith("layoutEffect") && setTargetWidth(setWidth, target)
    }, [target])

    useEffect(() => {
        inner.startsWith("effect") && setTargetWidth(setWidth, target)
    }, [target])

    return (
        <motion.div
            data-track="digit"
            layout
            transition={{ layout: { ...linear, duration } }}
            style={{
                width,
                height: 100,
                background: "#ddd",
                overflow: "hidden",
            }}
        >
            <div
                ref={roll}
                data-track="roll"
                style={{ width: 20, height: 100 }}
            >
                {value}
            </div>
        </motion.div>
    )
}

const scenarios: Record<string, Array<[number, () => void]>> = {
    basic: [[100, click("next")]],
}

export const App = () => {
    const [value, setValue] = useState(1)
    const [, start] = useTransition()

    return (
        <div style={{ padding: 20 }}>
            <button id="run" onClick={() => runScript(scenarios.basic)}>
                run
            </button>
            <button id="next" onClick={() => update(() => setValue(2), start)}>
                next
            </button>
            <Digit value={value} />
            <SlowList tick={value} />
        </div>
    )
}
