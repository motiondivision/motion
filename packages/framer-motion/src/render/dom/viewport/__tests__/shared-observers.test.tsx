import { act, createRef } from "react"
import { useInView } from "../../../../utils/use-in-view"
import { render } from "../../../../jest.setup"
import { motion } from "../../../components/motion"
import { inView } from ".."

/**
 * A mock that, like the browser, reports an entry for each element it
 * starts observing and only reports entries for observed elements.
 */
const instances: MockObserver[] = []

class MockObserver {
    observed = new Set<Element>()
    constructor(public callback: IntersectionObserverCallback) {
        instances.push(this)
    }
    observe(element: Element) {
        this.observed.add(element)
    }
    unobserve(element: Element) {
        this.observed.delete(element)
    }
    disconnect() {
        this.observed.clear()
    }
    trigger(target: Element, isIntersecting: boolean) {
        this.observed.has(target) &&
            this.callback(
                [{ target, isIntersecting } as IntersectionObserverEntry],
                this as any
            )
    }
}

;(window as any).IntersectionObserver = MockObserver

const observing = (element: Element) =>
    instances.filter((instance) => instance.observed.has(element))

describe("useInView", () => {
    test("components with the same options share one IntersectionObserver", () => {
        const before = instances.length
        const refs = Array.from({ length: 5 }, () =>
            createRef<HTMLDivElement>()
        )
        const Item = ({ index }: { index: number }) => {
            useInView(refs[index])
            return <div ref={refs[index]} />
        }
        const { unmount } = render(
            <>
                {refs.map((_, i) => (
                    <Item key={i} index={i} />
                ))}
            </>
        )

        expect(instances.length - before).toBeLessThanOrEqual(1)
        refs.forEach((ref) => expect(observing(ref.current!).length).toBe(1))

        const elements = refs.map((ref) => ref.current!)
        unmount()
        elements.forEach((element) => expect(observing(element).length).toBe(0))
    })

    test("is told when its element enters and leaves, and stops after entering once", async () => {
        const ref = createRef<HTMLDivElement>()
        const onceRef = createRef<HTMLDivElement>()
        const results: boolean[] = []
        const Component = () => {
            const isInView = useInView(ref)
            useInView(onceRef, { once: true })
            results.push(isInView)
            return (
                <>
                    <div ref={ref} />
                    <div ref={onceRef} />
                </>
            )
        }
        render(<Component />)

        const [observer] = observing(ref.current!)
        await act(async () => observer.trigger(ref.current!, true))
        await act(async () => observer.trigger(ref.current!, false))
        expect(results[results.length - 1]).toBe(false)
        expect(results).toContain(true)

        const [onceObserver] = observing(onceRef.current!)
        await act(async () => onceObserver.trigger(onceRef.current!, true))
        expect(observing(onceRef.current!).length).toBe(0)
    })
})

describe("inView", () => {
    test("an onStart without a leave callback stops observing only its element", () => {
        const a = document.body.appendChild(document.createElement("div"))
        const b = document.body.appendChild(document.createElement("div"))
        const onStart = jest.fn()

        const stop = inView([a, b], onStart)
        const [observer] = observing(a)
        observer.trigger(a, true)

        expect(onStart).toHaveBeenCalledTimes(1)
        expect(observing(a).length).toBe(0)
        expect(observing(b).length).toBe(1)
        stop()
    })
})

describe("whileInView with viewport once", () => {
    test("stops observing once the element has entered", () => {
        const ref = createRef<HTMLDivElement>()
        const onViewportEnter = jest.fn()
        render(
            <motion.div
                ref={ref}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                onViewportEnter={onViewportEnter}
            />
        )

        const [observer] = observing(ref.current!)
        expect(observer).toBeDefined()

        observer.trigger(ref.current!, true)
        expect(onViewportEnter).toHaveBeenCalledTimes(1)
        expect(observing(ref.current!).length).toBe(0)
    })

    test("keeps observing without once", () => {
        const ref = createRef<HTMLDivElement>()
        const onViewportLeave = jest.fn()
        render(
            <motion.div
                ref={ref}
                whileInView={{ opacity: 1 }}
                onViewportLeave={onViewportLeave}
            />
        )

        const [observer] = observing(ref.current!)
        observer.trigger(ref.current!, true)
        observer.trigger(ref.current!, false)

        expect(onViewportLeave).toHaveBeenCalledTimes(1)
        expect(observing(ref.current!).length).toBe(1)
    })
})
