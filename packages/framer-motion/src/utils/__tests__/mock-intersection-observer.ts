export type MockIntersectionObserverEntry = {
    isIntersecting: boolean
    target: Element
}

export type MockIntersectionObserverCallback = (
    entries: MockIntersectionObserverEntry[]
) => void

let activeIntersectionObserver: MockIntersectionObserverCallback | undefined
let lastObserverOptions: IntersectionObserverInit | undefined

export const getActiveObserver = () => activeIntersectionObserver
export const getLastObserverOptions = () => lastObserverOptions

window.IntersectionObserver = class MockIntersectionObserver {
    callback: MockIntersectionObserverCallback

    constructor(
        callback: MockIntersectionObserverCallback,
        options?: IntersectionObserverInit
    ) {
        this.callback = callback
        lastObserverOptions = options
    }

    observe(_element: Element) {
        activeIntersectionObserver = this.callback
    }

    unobserve(_element: Element) {
        activeIntersectionObserver = undefined
    }

    disconnect() {
        activeIntersectionObserver = undefined
    }
} as any
