export type MockResizeObserverEntry = {
  target: Element
}

export type MockResizeObserverCallback = (
  entries: MockResizeObserverEntry[]
) => void

let activeObserver: any

window.ResizeObserver = class MockResizeObserver {
  elements = new Set<Element>()

  callback: MockResizeObserverCallback | undefined

  constructor(callback: MockResizeObserverCallback) {
    this.callback = callback
    activeObserver = this
  }

  observe(element: Element) {
    this.elements.add(element)
  }

  unobserve(element: Element) {
    this.elements.delete(element)
  }

  disconnect() {
    this.elements = new Set()
    this.callback = undefined
    activeObserver = undefined
  }

  notify() {
    const entries = Array.from(this.elements).map((element) => ({
      target: element,
      contentRect: {},
      borderBoxSize: {},
    }))

    this.callback?.(entries)
  }
} as any

export function triggerResize() {
  activeObserver?.notify()
}
