import { useInsertionEffect } from "react"

let hasInsertedTransitionResetStyle = false

export function useResetViewTransitions(): void {
    useInsertionEffect(() => {
        if (hasInsertedTransitionResetStyle) return
        hasInsertedTransitionResetStyle = true
        const style = document.createElement("style")
        style.textContent = `
    ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {
        animation-timing-function: linear !important;
    }
    `
        document.head.appendChild(style)
    }, [])
}
