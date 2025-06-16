import "@testing-library/jest-dom"
// Get fireEvent from the native testing library
// because @testing-library/react one switches out pointerEnter and pointerLeave
import { fireEvent, getByTestId } from "@testing-library/dom"
import { render as testRender } from "@testing-library/react"
import { act, Fragment, StrictMode } from "react"

/**
 * Stub PointerEvent - this is so we can pass through PointerEvent.isPrimary
 */
const pointerEventProps = ["isPrimary", "pointerType", "button"]
class PointerEventFake extends Event {
    constructor(type: any, props: any) {
        super(type, props)
        if (!props) return
        pointerEventProps.forEach((prop) => {
            if (props[prop] !== null) {
                this[prop as keyof typeof this] = props[prop]
            }
        })
    }
}
;(global as any).PointerEvent = PointerEventFake

// Stub ResizeObserver
if (!(global as any).ResizeObserver) {
    ;(global as any).ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as any
}

// Stub scrollTo
const noop = () => {}
Object.defineProperty(global, "scrollTo", { value: noop, writable: true })

export const click = (element: Element) =>
    act(() => {
        fireEvent.click(element)
    })
export const pointerEnter = (element: Element, options?: any) =>
    act(() => {
        fireEvent.pointerEnter(
            element,
            // Emulate buttonless pointer event for enter/leave
            new PointerEventFake("pointerenter", {
                pointerType: "mouse",
                button: -1,
                ...options,
            })
        )
    })
export const pointerLeave = (element: Element, options?: any) =>
    act(() => {
        fireEvent.pointerLeave(
            element,
            new PointerEventFake("pointerleave", {
                pointerType: "mouse",
                button: -1,
                ...options,
            })
        )
    })
export const pointerDown = (element: Element) =>
    act(() => {
        fireEvent.pointerDown(
            element,
            new PointerEventFake("pointerdown", { isPrimary: true })
        )
    })
export const pointerUp = (element: Element) =>
    act(() => {
        fireEvent.pointerUp(
            element,
            new PointerEventFake("pointerup", { isPrimary: true })
        )
    })
export const pointerMove = (element: Element) =>
    act(() => {
        fireEvent.pointerMove(
            element,
            new PointerEventFake("pointermove", { isPrimary: true })
        )
    })
export const focus = (element: HTMLElement, testId: string) =>
    act(() => {
        getByTestId(element, testId).focus()
    })
export const blur = (element: HTMLElement, testId: string) =>
    act(() => {
        getByTestId(element, testId).blur()
    })

export const render = (children: any, isStrict = true) => {
    const Wrapper = isStrict ? StrictMode : Fragment

    const renderReturn = testRender(<Wrapper>{children}</Wrapper>)

    return {
        ...renderReturn,
        rerender: (children: any) =>
            renderReturn.rerender(<Wrapper>{children}</Wrapper>),
    }
}
