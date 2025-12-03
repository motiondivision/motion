let warning: DevMessage = () => {}
let invariant: DevMessage = () => {}

if (import.meta.env?.DEV ?? false) {
    warning = (check, message, errorCode) => {
        if (!check && typeof console !== "undefined") {
            console.warn(formatErrorMessage(message, errorCode))
        }
    }

    invariant = (check, message, errorCode) => {
        if (!check) {
            throw new Error(formatErrorMessage(message, errorCode))
        }
    }
}

export { invariant, warning }
