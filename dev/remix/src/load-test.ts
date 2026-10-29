const tests = import.meta.glob<{ App: any }>("./tests/*.tsx")

/**
 * Load the test page named by `?test=`.
 */
export function loadTest() {
    const name = new URLSearchParams(location.search).get("test")
    const load = tests[`./tests/${name}.tsx`]
    if (!load) throw new Error(`No Remix test page named "${name}"`)
    return load().then(({ App }) => App)
}
