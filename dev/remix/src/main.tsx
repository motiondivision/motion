import { createRoot } from "remix/component"
import { loadTest } from "./load-test"

loadTest().then((App) => {
    createRoot(document.getElementById("root")!).render(<App />)
    ;(window as any).rendered = true
})
