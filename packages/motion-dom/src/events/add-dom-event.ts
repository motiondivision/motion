export function addDomEvent(
    target: EventTarget,
    eventName: string,
    handler: EventListener,
    options: AddEventListenerOptions = { passive: true }
) {
    target.addEventListener(eventName, handler, options)

    return () => target.removeEventListener(eventName, handler)
}
