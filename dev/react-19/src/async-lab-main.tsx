import { App } from "./async-lab"
import { hydrate } from "./hydrate"

/**
 * The dev server holds this script back by the "Code delay" of the page.
 */
if (!/motion-hydrate=/.test(document.cookie)) {
    document.cookie = "motion-hydrate=1500;path=/"
}

hydrate(App)
