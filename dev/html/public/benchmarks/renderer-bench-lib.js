/**
 * Shared library for the renderer benchmark pages
 * (renderer-test-1/2/3.html).
 *
 * Provides:
 * - Renderer strategies: legacy (old VisualElement full re-apply),
 *   style (styleEffect), var (varEffect, registered CSS properties),
 *   sheet (experimental: adopted stylesheet rule writes - never touches
 *   the element's style attribute after setup).
 * - A phase runner implementing the protocol: 4 runs without reload,
 *   first run discarded as JIT/warmup.
 * - Frame metering: wallclock frame stats + time spent in Motion's
 *   render step (the actual style write cost).
 */

export const PAINT_PROPS = {
    backgroundColor: ["rgb(255, 40, 40)", "rgb(40, 40, 255)"],
    borderColor: ["rgb(40, 255, 40)", "rgb(255, 40, 255)"],
    borderRadius: ["4px", "20px"],
    boxShadow: ["0 0 2px rgb(255, 40, 40)", "0 0 14px rgb(40, 40, 255)"],
    outlineColor: ["rgb(20, 20, 20)", "rgb(255, 255, 40)"],
}

export function buildBoxes(container, n, descendants = 0) {
    const parts = []
    let inner = ""
    for (let j = 0; j < descendants; j++) {
        inner += `<span class="d${j % 10}">x</span>`
    }
    for (let i = 0; i < n; i++) {
        parts.push(`<div class="box">${inner}</div>`)
    }
    container.innerHTML = parts.join("")
    return Array.from(container.querySelectorAll(".box"))
}

/** ------------------------------------------------------------------ */
/** Renderer strategies                                                 */
/** ------------------------------------------------------------------ */

export function createStrategies(Motion) {
    const { motionValue, styleEffect, varEffect, frame, cancelFrame } = Motion

    const makeValues = (props) => {
        const values = {}
        for (const prop in props) values[prop] = motionValue(props[prop][0])
        return values
    }

    /**
     * Old VisualElement renderer semantics: any value change schedules a
     * render that re-applies EVERY bound style, including stagnant ones.
     */
    const legacy = {
        name: "legacy (re-apply all)",
        bind(boxes, props) {
            const all = []
            const subscriptions = []
            const renders = []

            for (const box of boxes) {
                const values = makeValues(props)
                const keys = Object.keys(values)

                const render = () => {
                    for (const key of keys) {
                        box.style[key] = values[key].get()
                    }
                }
                renders.push(render)

                for (const key of keys) {
                    subscriptions.push(
                        values[key].on("change", () => frame.render(render))
                    )
                }

                render()
                all.push(values)
            }

            return {
                values: all,
                cleanup() {
                    for (const unsub of subscriptions) unsub()
                    for (const render of renders) cancelFrame(render)
                    for (const box of boxes) box.removeAttribute("style")
                },
            }
        },
    }

    /** Granular per-value writes to element.style */
    const style = {
        name: "styleEffect (granular)",
        bind(boxes, props) {
            const all = []
            const cleanups = []
            for (const box of boxes) {
                const values = makeValues(props)
                cleanups.push(styleEffect(box, values))
                all.push(values)
            }
            return {
                values: all,
                cleanup() {
                    for (const cleanup of cleanups) cleanup()
                    for (const box of boxes) box.removeAttribute("style")
                },
            }
        },
    }

    /** Registered custom properties (inherits: false), written to inline style */
    const varStrategy = {
        name: "varEffect (registered vars)",
        bind(boxes, props) {
            const all = []
            const cleanups = []
            for (const box of boxes) {
                const values = makeValues(props)
                cleanups.push(varEffect(box, values))
                all.push(values)
            }
            return {
                values: all,
                cleanup() {
                    for (const cleanup of cleanups) cleanup()
                    for (const box of boxes) box.removeAttribute("style")
                },
            }
        },
    }

    /**
     * Experimental: per-element rule in an adopted stylesheet. Values are
     * written into the rule's declaration block, so the element's style
     * attribute is never mutated after setup - this dodges [style*=...]
     * attribute invalidation entirely (see style-recalc-harness).
     */
    let sheetId = 0
    const sheet = {
        name: "sheet (adopted stylesheet)",
        bind(boxes, props) {
            const all = []
            const subscriptions = []
            const renders = []
            const styleSheet = new CSSStyleSheet()
            const keys = Object.keys(props)

            const src = []
            const ids = []
            for (let i = 0; i < boxes.length; i++) {
                const id = sheetId++
                ids.push(id)
                boxes[i].setAttribute("data-mb", id)
                src.push(`[data-mb="${id}"] {}`)
            }
            styleSheet.replaceSync(src.join("\n"))
            document.adoptedStyleSheets = [
                ...document.adoptedStyleSheets,
                styleSheet,
            ]

            const dash = (key) =>
                key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

            for (let i = 0; i < boxes.length; i++) {
                const rule = styleSheet.cssRules[i]
                const values = makeValues(props)

                for (const key of keys) {
                    const varName = `--mb${ids[i]}-${key}`
                    try {
                        CSS.registerProperty({
                            name: varName,
                            syntax: "*",
                            inherits: false,
                        })
                    } catch (e) {}
                    rule.style.setProperty(varName, values[key].get())
                    rule.style.setProperty(dash(key), `var(${varName})`)

                    const render = () => {
                        rule.style.setProperty(varName, values[key].get())
                    }
                    renders.push(render)
                    subscriptions.push(
                        values[key].on("change", () => frame.render(render))
                    )
                }

                all.push(values)
            }

            return {
                values: all,
                cleanup() {
                    for (const unsub of subscriptions) unsub()
                    for (const render of renders) cancelFrame(render)
                    document.adoptedStyleSheets =
                        document.adoptedStyleSheets.filter(
                            (s) => s !== styleSheet
                        )
                    for (const box of boxes) box.removeAttribute("data-mb")
                },
            }
        },
    }

    /**
     * WAAPI (element.animate) on the main thread. Values are applied via
     * the animation cascade origin, NOT the style attribute - so there is
     * zero attribute mutation, before, during or after the animation.
     * These paint properties are not compositable, so the animation still
     * ticks on the main thread (style + paint per frame) like the others.
     */
    const waapi = {
        name: "WAAPI (element.animate)",
        bind(boxes) {
            const binding = {
                boxes,
                animations: [],
                cleanup() {
                    for (const animation of binding.animations) {
                        animation.cancel()
                    }
                    binding.animations = []
                },
            }
            return binding
        },
        animate(binding, phaseProps, props, flip, duration) {
            for (const animation of binding.animations) animation.cancel()
            binding.animations = []

            for (const box of binding.boxes) {
                const keyframes = {}
                for (const prop of phaseProps) {
                    const [a, b] = props[prop]
                    keyframes[prop] = flip ? [b, a] : [a, b]
                }
                binding.animations.push(
                    box.animate(keyframes, {
                        duration: duration * 1000,
                        easing: "linear",
                        fill: "forwards",
                    })
                )
            }
            return Promise.all(
                binding.animations.map((animation) => animation.finished)
            )
        },
    }

    /**
     * GSAP's JS renderer: its ticker writes inline styles every frame,
     * so like legacy/styleEffect/varEffect it mutates the style attribute
     * per frame and pays any attribute-selector invalidation cost.
     */
    const gsapStrategy = {
        name: "GSAP (inline writes)",
        bind(boxes, props) {
            for (const box of boxes) {
                for (const key in props) box.style[key] = props[key][0]
            }
            return {
                boxes,
                cleanup() {
                    for (const box of boxes) {
                        window.gsap.killTweensOf(box)
                        box.removeAttribute("style")
                    }
                },
            }
        },
        animate(binding, phaseProps, props, flip, duration) {
            const tweens = []
            for (const box of binding.boxes) {
                /**
                 * fromTo with explicit endpoints, matching the keyframe
                 * semantics of the other strategies. A plain .to() would
                 * create zero-change tweens for any property already at
                 * its target (phases alternate direction), silently
                 * animating fewer values than the other renderers.
                 */
                const fromVars = {}
                const toVars = { duration, ease: "none", overwrite: "auto" }
                for (const prop of phaseProps) {
                    const [a, b] = props[prop]
                    fromVars[prop] = flip ? b : a
                    toVars[prop] = flip ? a : b
                }
                tweens.push(window.gsap.fromTo(box, fromVars, toVars))
            }
            return Promise.all(tweens)
        },
    }

    return { legacy, style, var: varStrategy, sheet, waapi, gsap: gsapStrategy }
}

/** ------------------------------------------------------------------ */
/** Metering                                                            */
/** ------------------------------------------------------------------ */

export function createFrameMeter(Motion) {
    const { frame, cancelFrame } = Motion
    let deltas = []
    let renderMs = 0
    let renderStart = 0
    let rafId
    let lastTs

    const preRender = () => {
        renderStart = performance.now()
    }
    const postRender = () => {
        renderMs += performance.now() - renderStart
    }

    return {
        start() {
            deltas = []
            renderMs = 0
            lastTs = undefined
            frame.preRender(preRender, true)
            frame.postRender(postRender, true)
            const tick = (ts) => {
                if (lastTs !== undefined) deltas.push(ts - lastTs)
                lastTs = ts
                rafId = requestAnimationFrame(tick)
            }
            rafId = requestAnimationFrame(tick)
        },
        stop() {
            cancelAnimationFrame(rafId)
            cancelFrame(preRender)
            cancelFrame(postRender)
            const sorted = [...deltas].sort((a, b) => a - b)
            const frames = deltas.length || 1
            return {
                frames: deltas.length,
                mean: deltas.reduce((a, b) => a + b, 0) / frames,
                p95: sorted[
                    Math.min(sorted.length - 1, Math.floor(0.95 * frames))
                ],
                max: sorted[sorted.length - 1] ?? 0,
                renderMsPerFrame: renderMs / frames,
                fps: 1000 / (deltas.reduce((a, b) => a + b, 0) / frames),
            }
        },
    }
}

/** ------------------------------------------------------------------ */
/** Runner                                                              */
/** ------------------------------------------------------------------ */

/**
 * Creates a benchmark driver. Phases are named prop subsets, e.g.
 * { A: [all five], B: ["backgroundColor"] }. Exposes granular
 * setup/runPhase/teardown for external (CDP) drivers, and runAll()
 * implementing the standard protocol: per strategy, `runs` iterations
 * of each phase without reload, first run discarded.
 */
export function createRunner({
    Motion,
    boxes,
    strategies,
    props,
    phases,
    duration = 2,
    runs = 4,
    onStatus = () => {},
}) {
    const { animate } = Motion
    const meter = createFrameMeter(Motion)

    let active = null
    let direction = 0

    async function setup(name) {
        if (active) teardown()
        direction = 0
        const strategy = strategies[name]
        active = { name, strategy, binding: strategy.bind(boxes, props) }
        await new Promise((resolve) => setTimeout(resolve, 100))
    }

    async function runPhase(phaseName) {
        const phaseProps = phases[phaseName]
        const flip = direction++ % 2 === 1

        meter.start()
        if (active.strategy.animate) {
            /**
             * Strategy drives its own animation (e.g. CSS transitions),
             * bypassing Motion's main-thread animation loop entirely.
             */
            await active.strategy.animate(
                active.binding,
                phaseProps,
                props,
                flip,
                duration
            )
        } else {
            const animations = []
            for (const values of active.binding.values) {
                for (const prop of phaseProps) {
                    const [a, b] = props[prop]
                    animations.push(
                        animate(values[prop], flip ? [b, a] : [a, b], {
                            duration,
                            ease: "linear",
                        })
                    )
                }
            }
            await Promise.all(animations)
        }
        const stats = meter.stop()
        await new Promise((resolve) => setTimeout(resolve, 100))
        return stats
    }

    function teardown() {
        active?.binding.cleanup()
        active = null
    }

    async function runAll(names) {
        const results = []
        for (const name of names) {
            await setup(name)
            const perPhase = {}
            for (const phaseName in phases) perPhase[phaseName] = []

            for (let r = 0; r < runs; r++) {
                for (const phaseName in phases) {
                    onStatus(
                        `${strategies[name].name} — run ${
                            r + 1
                        }/${runs}, phase ${phaseName}`
                    )
                    perPhase[phaseName].push(await runPhase(phaseName))
                }
            }
            teardown()

            const summary = { name: strategies[name].name }
            for (const phaseName in phases) {
                /** Discard first run (JIT warmup) */
                const warm = perPhase[phaseName].slice(1)
                const avg = (key) =>
                    warm.reduce((a, s) => a + s[key], 0) / warm.length
                summary[phaseName] = {
                    mean: avg("mean"),
                    p95: avg("p95"),
                    fps: avg("fps"),
                    renderMsPerFrame: avg("renderMsPerFrame"),
                    runs: perPhase[phaseName],
                }
            }
            results.push(summary)
        }
        return results
    }

    return { setup, runPhase, teardown, runAll }
}

/** ------------------------------------------------------------------ */
/** Reporting                                                           */
/** ------------------------------------------------------------------ */

export function renderResultsTable(el, results, phases) {
    const phaseNames = Object.keys(phases)
    let html = `<tr><th>renderer</th>`
    for (const p of phaseNames) {
        html += `<th>${p}: fps</th><th>${p}: mean frame (ms)</th><th>${p}: p95 (ms)</th><th>${p}: render JS (ms/frame)</th>`
    }
    html += `</tr>`
    for (const r of results) {
        html += `<tr><td>${r.name}</td>`
        for (const p of phaseNames) {
            html += `<td>${r[p].fps.toFixed(1)}</td><td>${r[p].mean.toFixed(
                2
            )}</td><td>${r[p].p95.toFixed(2)}</td><td>${r[
                p
            ].renderMsPerFrame.toFixed(3)}</td>`
        }
        html += `</tr>`
    }
    el.innerHTML = html
}

export const panelCSS = `
    #panel {
        position: fixed; top: 0; left: 0; right: 0;
        background: rgba(0, 0, 0, 0.88); color: #fff;
        padding: 10px 14px; z-index: 1000;
        font-family: system-ui, sans-serif; font-size: 12px;
        max-height: 40vh; overflow: auto;
    }
    #panel table { border-collapse: collapse; margin-top: 6px; }
    #panel td, #panel th { border: 1px solid #555; padding: 2px 8px; text-align: right; }
    #panel th:first-child, #panel td:first-child { text-align: left; }
`
