import { formatErrorMessage } from "./format-error-message"

export type DevMessage = (
    check: boolean,
    message: string,
    errorCode?: string
) => void

let warning: DevMessage = () => {}
let invariant: DevMessage = () => {}

if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production"
) {
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
