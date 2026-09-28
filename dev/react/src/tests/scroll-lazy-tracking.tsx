import {
    motion,
    MotionValue,
    useMotionValueEvent,
    useScroll,
    useTransform,
} from "framer-motion"
import * as React from "react"
import { useRef, useState } from "react"

/**
 * useScroll only measures the scroll in JS while one of its values has a
 * change subscriber. Its scrollInfo handler listens for window scroll events,
 * so their count shows whether it's tracking.
 */
let scrollListeners = 0
const { addEventListener, removeEventListener } = window
window.addEventListener = ((type: string, ...args: any[]) => {
    if (type === "scroll") scrollListeners++
    return (addEventListener as any).call(window, type, ...args)
}) as typeof window.addEventListener
window.removeEventListener = ((type: string, ...args: any[]) => {
    if (type === "scroll") scrollListeners--
    return (removeEventListener as any).call(window, type, ...args)
}) as typeof window.removeEventListener
;(window as any).scrollListeners = () => scrollListeners

const Subscriber = ({ progress }: { progress: MotionValue<number> }) => {
    const ref = useRef<HTMLSpanElement>(null)
    useMotionValueEvent(progress, "change", (latest) => {
        ref.current!.textContent = String(latest)
    })
    return <span id="subscriber" ref={ref} />
}

const ChainSubscriber = ({ value }: { value: MotionValue<number> }) => {
    const ref = useRef<HTMLSpanElement>(null)
    useMotionValueEvent(value, "change", (latest) => {
        ref.current!.textContent = String(latest)
    })
    return <span id="chain-subscriber" ref={ref} />
}

const Mixed = ({ progress }: { progress: MotionValue<number> }) => {
    const x = useTransform(progress, [0, 1], [0, 100])
    return <motion.div id="mixed" style={{ ...box, x }} />
}

export const App = () => {
    const target = useRef<HTMLDivElement>(null)
    const page = useScroll()
    const card = useScroll({ target })
    const pageOpacity = useTransform(page.scrollYProgress, [0, 1], [0.2, 1])
    const targetOpacity = useTransform(
        useTransform(card.scrollYProgress, [0, 1], [0, 1]),
        [0, 1],
        [0, 1]
    )
    const cardOpacity = useTransform(card.scrollYProgress, [0, 1], [1, 0])
    const [subscribed, setSubscribed] = useState(false)
    const [chainSubscribed, setChainSubscribed] = useState(false)
    const [mixed, setMixed] = useState(false)

    return (
        <div style={{ height: 4000, paddingTop: 1000 }}>
            <div ref={target} id="target" style={{ height: 1500 }} />
            <div style={{ position: "fixed", top: 0, left: 0 }}>
                <motion.div
                    id="page-opacity"
                    style={{ ...box, opacity: page.scrollYProgress }}
                />
                <motion.div
                    id="target-opacity"
                    style={{ ...box, opacity: card.scrollYProgress }}
                />
                <motion.div
                    id="page-transform"
                    style={{ ...box, opacity: pageOpacity }}
                />
                <motion.div
                    id="card-transform"
                    style={{ ...box, opacity: cardOpacity }}
                />
                <button
                    id="read"
                    onClick={(event) => {
                        const { dataset } = event.currentTarget
                        dataset.page = String(page.scrollYProgress.get())
                        dataset.target = String(card.scrollYProgress.get())
                        dataset.pageTransform = String(pageOpacity.get())
                        dataset.cardTransform = String(cardOpacity.get())
                        dataset.nested = String(targetOpacity.get())
                    }}
                >
                    Read
                </button>
                <button id="subscribe" onClick={() => setSubscribed(!subscribed)}>
                    Subscribe
                </button>
                <button id="mix" onClick={() => setMixed(!mixed)}>
                    Mix
                </button>
                <button
                    id="subscribe-chain"
                    onClick={() => setChainSubscribed(!chainSubscribed)}
                >
                    Subscribe to chain
                </button>
                {subscribed && <Subscriber progress={page.scrollYProgress} />}
                {mixed && <Mixed progress={card.scrollYProgress} />}
                {chainSubscribed && <ChainSubscriber value={cardOpacity} />}
            </div>
        </div>
    )
}

const box = { width: 10, height: 10 }
