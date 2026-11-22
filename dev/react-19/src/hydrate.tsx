import type { ComponentType } from "react"
import { hydrateRoot } from "react-dom/client"
import type { PageProps } from "./page-props"

/**
 * Hydrate a page the dev server rendered, with what it was rendered from.
 */
export function hydrate(App: ComponentType<PageProps>) {
    hydrateRoot(
        document.getElementById("root")!,
        <App
            cookies={document.cookie}
            url={location.pathname + location.search}
        />,
        {
            onRecoverableError: (error) =>
                console.error("Hydration error:", error),
        }
    )
}
