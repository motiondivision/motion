import { createRef } from "react"
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

describe("inView", () => {
    beforeEach(() => {
        document.body.innerHTML = ""
    })

    test("calls with the same options share one IntersectionObserver", () => {
        const elements = Array.from({ length: 5 }, () =>
            document.body.appendChild(document.createElement("div"))
        )
        const before = instances.length

        const stops = elements.map((element) => inView(element, () => {}))

        expect(instances.length - before).toBeLessThanOrEqual(1)
        elements.forEach((element) => expect(observing(element).length).toBe(1))

        stops.forEach((stop) => stop())
        elements.forEach((element) => expect(observing(element).length).toBe(0))
    })

    test("different options get different observers", () => {
        const element = document.body.appendChild(document.createElement("div"))
        const stopA = inView(element, () => {}, { amount: 0.25 })
        const stopB = inView(element, () => {}, { amount: 0.75 })

        expect(observing(element).length).toBe(2)
        stopA()
        stopB()
    })

    test("two calls on one element are both told when it enters and leaves", () => {
        const element = document.body.appendChild(document.createElement("div"))
        const leaveA = jest.fn()
        const leaveB = jest.fn()
        const startA = jest.fn(() => leaveA)
        const startB = jest.fn(() => leaveB)

        const stopA = inView(element, startA)
        const stopB = inView(element, startB)
        const [observer] = observing(element)

        observer.trigger(element, true)
        expect(startA).toHaveBeenCalledTimes(1)
        expect(startB).toHaveBeenCalledTimes(1)

        observer.trigger(element, false)
        expect(leaveA).toHaveBeenCalledTimes(1)
        expect(leaveB).toHaveBeenCalledTimes(1)

        stopA()
        observer.trigger(element, true)
        expect(startA).toHaveBeenCalledTimes(1)
        expect(startB).toHaveBeenCalledTimes(2)

        stopB()
        expect(observing(element).length).toBe(0)
    })

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
