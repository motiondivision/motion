export function getEventTargetWindow(target: EventTarget): Window {
    if ((target as Window).window === target) {
        return target as Window
    }

    if ((target as Document).defaultView) {
        return (target as Document).defaultView as Window
    }

    return (target as Element).ownerDocument?.defaultView ?? window
}
