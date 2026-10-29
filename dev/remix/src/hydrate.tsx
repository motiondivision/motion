import { createRoot } from "remix/component"
import { loadTest } from "./load-test"

/**
 * The page starts with the server-rendered HTML. Tests call `hydrate()` to
 * check the server render first.
 */
;(window as any).hydrate = () =>
    loadTest().then((App) => {
        createRoot(document.getElementById("root")!).render(<App />)
        ;(window as any).rendered = true
    })
