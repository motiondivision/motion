import { formatErrorMessage } from "./format-error-message"

export type DevMessage = (
    check: boolean,
    message: string,
    errorCode?: string
) => void

const isDev =
    typeof process !== "undefined" &&
    process.env &&
    process.env.NODE_ENV !== "production"

let warning: DevMessage = () => {}
let invariant: DevMessage = () => {}

if (isDev) {
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
