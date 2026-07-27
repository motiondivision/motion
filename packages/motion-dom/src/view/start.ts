import { secondsToMilliseconds, warnOnce } from "motion-utils"
import { GroupAnimation } from "../animation/GroupAnimation"
import { NativeAnimation } from "../animation/NativeAnimation"
import { NativeAnimationWrapper } from "../animation/NativeAnimationWrapper"
import { AnimationPlaybackControls, DOMKeyframesDefinition } from "../animation/types"
import { getValueTransition } from "../animation/utils/get-value-transition"
import { mapEasingToNativeEasing } from "../animation/waapi/easing/map-easing"
import { applyGeneratorOptions } from "../animation/waapi/utils/apply-generator"
import { cornerRadiusProps } from "../utils/border-radius"
import { ElementOrSelector, resolveElements } from "../utils/resolve-elements"
import type { ViewTransitionBuilder } from "./index"
import { ViewTransitionTarget, ViewTransitionTargetDefinition } from "./types"
import {
    assignViewTransitionNames,
    releaseViewTransitionNames,
} from "./utils/assign-names"
import { chooseLayerType } from "./utils/choose-layer-type"
import { css } from "./utils/css"
import { getViewAnimationLayerInfo } from "./utils/get-layer-info"
import { getViewAnimations } from "./utils/get-view-animations"
import { hasTarget } from "./utils/has-target"

const definitionNames = ["layout", "enter", "exit", "new", "old"] as const

type CornerRadii = Record<(typeof cornerRadiusProps)[number], string>

/**
 * Whether a computed border-radius is square (every component zero). Splitting
 * on whitespace handles two-value/elliptical radii like "0px 20px" - a leading
 * `parseFloat` alone would misread the non-zero vertical radius as square.
 */
const isSquareRadius = (radius: string) =>
    radius.split(" ").every((value) => parseFloat(value) === 0)

/**
 * The `ViewTransitionTarget` buckets driving each generated layer type, in
 * priority order - the inverse of `chooseLayerType`. The new view is driven by
 * `new`/`enter`, the old by `old`/`exit`. `group-children`/`image-pair` have no
 * bucket; they follow the default layout timing.
 */
const typeBuckets: Record<string, (keyof ViewTransitionTarget)[]> = {
    group: ["layout"],
    new: ["new", "enter"],
    old: ["old", "exit"],
}

/**
 * Default "absent" origin for a single-value keyframe, by pseudo type, so e.g.
 * `enter({ scale: 1 })` grows in from 0.85 and `exit({ opacity: 0 })` fades
 * from 1. `enter` prefers the matching `exit` value over these (see below).
 */
const ORIGIN_DEFAULTS: Record<string, Record<string, number>> = {
    new: { opacity: 0, scale: 0.85 },
    old: { opacity: 1, scale: 1 },
}

/**
 * How much two box aspect ratios must differ before a morph is treated as
 * aspect-changing (and so worth cropping). Matches the projection engine's
 * `preserve-aspect` threshold, so small layout jitter doesn't trigger a crop.
 */
const ASPECT_TOLERANCE = 0.2

export function startViewAnimation(
    builder: ViewTransitionBuilder
): Promise<GroupAnimation> {
    const {
        update,
        targets,
        resolveDefs,
        cropOverride,
        pairs,
        classNames,
        flatGroups,
        options: defaultOptions,
    } = builder

    if (!document.startViewTransition) {
        // An async IIFE (not `new Promise(async …)`) so a throwing/rejecting
        // update rejects this promise rather than leaving it unsettled.
        return (async () => {
            await update()
            return new GroupAnimation([])
        })()
    }

    /**
     * Resolve any selector/Element targets to layer names, assigning a
     * `view-transition-name` to each element as we go. We run this before the
     * update (so the elements are captured in the old snapshot) and again
     * after it (for the new snapshot). An element present in both keeps the
     * same name and animates as a single `group` layer.
     */
    const nameRegistry = new Map<Element, string>()
    const assigned: Element[] = []
    /**
     * Elements we tagged with a `view-transition-class` (via `.class()`),
     * tracked separately from `assigned` so cleanup removes the class without
     * ever stripping an author's own inline `view-transition-name`.
     */
    const classed: Element[] = []
    /**
     * Elements we set a `view-transition-group` on (for nesting), tracked for
     * cleanup. `clipChildren` collects the names of nested parents that clip in
     * the live layout, so their `::view-transition-group-children` is clipped
     * through the transition - not just once the live DOM takes back over.
     */
    const grouped: Element[] = []
    const clipChildren = new Set<string>()
    const layerTargets = new Map<string, ViewTransitionTarget>()
    const croppedNames = new Set<string>()
    /**
     * Each layer's explicit `.crop(true | false)` override (by resolved name),
     * so `finalizeCrop` can let an author's choice win over the morph default.
     */
    const cropForName = new Map<string, boolean>()
    /**
     * Each layer's stagger position (index + total) within its subject, per
     * snapshot. Resolving against the snapshot the layer belongs to keeps
     * stagger correct when `update()` replaces the matched elements, and lets
     * us skip a layer that's absent from a snapshot (e.g. an exited element
     * has no `new` pseudo-element).
     */
    const layerStagger = new Map<
        string,
        { old?: [number, number]; new?: [number, number] }
    >()
    /**
     * Names allocated for a paired subject in the old snapshot, replayed onto
     * its new-snapshot target so both ends share a layer and morph.
     */
    const pairNames = new Map<ViewTransitionTargetDefinition, string[]>()
    /**
     * The old (`from`) elements of each paired subject, so their names can be
     * transferred off before the new (`to`) elements inherit them.
     */
    const pairFrom = new Map<ViewTransitionTargetDefinition, Element[]>()

    const resolveLayers = (phase: "old" | "new") => {
        targets.forEach((target, definition) => {
            const className = classNames.get(definition)
            /**
             * Nest each resolved layer under its DOM-ancestor layer by default
             * (`contain`), so an ancestor's clip/transform/opacity reach it
             * through the transition; `.group(false)` opts a subject out (`none`)
             * to stay flat and escape. Skipped for root / pre-named layers, which
             * aren't elements we resolve and style.
             */
            const group =
                definition === "root" || !resolveDefs.has(definition)
                    ? undefined
                    : flatGroups.has(definition)
                      ? "none"
                      : "contain"
            let names: string[]
            if (definition === "root" || !resolveDefs.has(definition)) {
                names = [definition as string]
            } else if (pairs.has(definition)) {
                /**
                 * Paired morph: name the old target in the old snapshot, then
                 * force the same name(s) onto the new target in the new one, so
                 * two different elements morph as a single layer.
                 */
                if (phase === "old") {
                    pairFrom.set(
                        definition,
                        resolveElements(definition as ElementOrSelector)
                    )
                    names = assignViewTransitionNames(
                        definition as ElementOrSelector,
                        nameRegistry,
                        assigned,
                        undefined,
                        className,
                        classed,
                        group,
                        grouped,
                        clipChildren
                    )
                    pairNames.set(definition, names)
                } else {
                    /**
                     * Transfer the name(s) off the `from` elements before the
                     * `to` elements inherit them. A `from` that survives into
                     * the new snapshot (e.g. hidden with `visibility: hidden`
                     * rather than removed) would otherwise keep the name and
                     * collide - "duplicate view-transition-name".
                     */
                    for (const el of pairFrom.get(definition) ?? []) {
                        ;(el as HTMLElement).style?.removeProperty(
                            "view-transition-name"
                        )
                        /**
                         * Drop the old end from the registry too, so the new
                         * end alone supplies this name's `new` crop radii - we
                         * neither re-measure nor get ordered by a stale element.
                         */
                        nameRegistry.delete(el)
                    }
                    names = assignViewTransitionNames(
                        pairs.get(definition) as ElementOrSelector,
                        nameRegistry,
                        assigned,
                        pairNames.get(definition),
                        className,
                        classed,
                        group,
                        grouped,
                        clipChildren
                    )
                }
            } else {
                names = assignViewTransitionNames(
                    definition as ElementOrSelector,
                    nameRegistry,
                    assigned,
                    undefined,
                    className,
                    classed,
                    group,
                    grouped,
                    clipChildren
                )
            }

            // Record any explicit `.crop(true | false)` per resolved name; the
            // crop set itself is computed later by `finalizeCrop` (it needs both
            // snapshots to know which morphs change aspect ratio).
            const override = cropOverride.get(definition)

            names.forEach((name, index) => {
                /**
                 * If two subjects resolve to the same element, merge their
                 * definitions so neither subject's animations are dropped.
                 */
                const existing = layerTargets.get(name)
                layerTargets.set(
                    name,
                    existing && existing !== target
                        ? { ...existing, ...target }
                        : target
                )

                if (override !== undefined) cropForName.set(name, override)

                const stagger = layerStagger.get(name) ?? {}
                stagger[phase] = [index, names.length]
                layerStagger.set(name, stagger)
            })
        })
    }

    /**
     * The stagger index/total for a layer, resolved against the snapshot it
     * belongs to. Returns index -1 when the layer is absent from that snapshot
     * so the caller can skip a pseudo-element that doesn't exist.
     */
    const staggerPosition = (name: string, type: string) => {
        const stagger = layerStagger.get(name)
        const position =
            type === "old"
                ? stagger?.old
                : type === "new"
                  ? stagger?.new
                  : // group / group-children / image-pair persist across both.
                    stagger?.new ?? stagger?.old
        return position ?? ([-1, 1] as const)
    }

    /**
     * Merge default + per-layer transition options for a generated layer and
     * resolve any stagger/delay function against this element's position. Used
     * by both the morph-retiming and crop corner-radius passes.
     */
    const resolveLayerTransition = (
        target: ViewTransitionTarget | undefined,
        type: string,
        transitionName: string,
        index: number,
        total: number
    ) => {
        const transition = mergeTransition(
            getValueTransition(defaultOptions, transitionName),
            getValueTransition(
                (layerOptions(target, type) ?? {}) as any,
                transitionName
            )
        )

        if (typeof transition.delay === "function") {
            transition.delay = transition.delay(index, total)
        }

        return transition
    }

    /**
     * Resolve a layer's group (`layout`) timing to plain WAAPI values: native
     * ms `delay`/`duration` and a baked `ease`. The single source of group
     * timing, shared by the generated-group retiming and the crop corner-radius
     * pass so the rounded clip animates on exactly the box's timing. It returns
     * no generator `type` (the WAAPI-only `NativeAnimation` rejects a string
     * type) nor `repeat`/`times` (which the group's `updateTiming` ignores), so
     * none of them can leak into the radius animation and desync it.
     */
    const resolveGroupTiming = (name: string) => {
        const [index, total] = staggerPosition(name, "group")
        const transition = resolveLayerTransition(
            layerTargets.get(name),
            "group",
            "layout",
            index === -1 ? 0 : index,
            total
        )
        transition.duration &&= secondsToMilliseconds(transition.duration)
        const { delay = 0, duration, ease } = applyGeneratorOptions(transition)
        return { delay: secondsToMilliseconds(delay), duration, ease }
    }

    /**
     * Each layer's measured box + corner radii per snapshot. The box lets
     * `finalizeCrop` tell whether a morph's aspect ratio changed (the only case
     * worth cropping); the radii let a cropped morph's group clip animate each
     * corner from the old element's radius to the new element's, keeping it
     * rounded where `overflow: clip` would otherwise square the corners.
     *
     * We never flatten the source for capture (a snapshot is a paint of the live
     * DOM, so squaring an element just for its capture would flash one real
     * square frame). For an aspect-changing morph `object-fit: cover` crops each
     * snapshot's own baked corners off-screen mid-morph, so the animated clip is
     * the only visible corner; a near-same-aspect forced crop (`.crop(true)`)
     * can't hide the outgoing snapshot's silhouette, but the endpoints coincide.
     */
    const cropMeasurements = new Map<
        string,
        {
            old?: { width: number; height: number; radii: CornerRadii }
            new?: { width: number; height: number; radii: CornerRadii }
        }
    >()

    const measureLayers = (phase: "old" | "new") =>
        nameRegistry.forEach((name, element) => {
            const el = element as HTMLElement
            const rect = el.getBoundingClientRect?.()
            if (rect && rect.height) {
                const style = getComputedStyle(el)
                const radii = {} as CornerRadii
                for (const corner of cornerRadiusProps) {
                    radii[corner] = style[corner]
                }
                const entry = cropMeasurements.get(name) ?? {}
                entry[phase] = { width: rect.width, height: rect.height, radii }
                cropMeasurements.set(name, entry)
            }
        })

    /**
     * With both snapshots measured, settle which layers crop. The default crops
     * only a morph whose aspect ratio *changes* between snapshots - the one case
     * where `object-fit: cover` does real work. A same-aspect morph or a
     * fade-only layer is left uncropped: its corners scale naturally (no flash
     * from squaring, no `overflow: clip` eating its shadow) and a backdrop can't
     * be clipped to nothing. An explicit `.crop(true | false)` overrides either
     * way. Runs after both snapshots are measured, since aspect needs both.
     */
    const finalizeCrop = () => {
        croppedNames.clear()
        for (const name of layerStagger.keys()) {
            if (name === "root") continue
            // An explicit `.crop(true | false)` wins; otherwise crop a morph
            // whose aspect ratio changed.
            if (cropForName.get(name) ?? aspectChanged(name)) {
                croppedNames.add(name)
            }
        }
    }

    /**
     * Whether a layer is a morph whose box aspect ratio changed between
     * snapshots (beyond a small tolerance). Fade-only layers (one snapshot) are
     * never "changed".
     */
    const aspectChanged = (name: string) => {
        const box = cropMeasurements.get(name)
        if (!box?.old || !box?.new || !box.old.height || !box.new.height) {
            return false
        }
        return (
            Math.abs(
                box.old.width / box.old.height -
                    box.new.width / box.new.height
            ) > ASPECT_TOLERANCE
        )
    }

    /**
     * Write the persistent view-transition CSS: suppress root capture when the
     * root has no animations of its own; force linear timing (baked into the
     * keyframes, so we can retime later via updateTiming); and clip +
     * object-fit: cover every cropped morph (the UA default overflows on
     * aspect-ratio change).
     *
     * `css.commit` replaces rather than appends, so we re-set the full rule set
     * each call - the crop rules are only known after `finalizeCrop` runs in the
     * update callback, so the second call writes them.
     */
    const commitViewCSS = () => {
        if (!hasTarget("root", targets)) {
            css.set(":root", { "view-transition-name": "none" })
        }

        css.set(
            "::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)",
            { "animation-timing-function": "linear !important" }
        )

        croppedNames.forEach((name) => {
            css.set(`::view-transition-group(${name})`, { overflow: "clip" })
            css.set(
                `::view-transition-old(${name}), ::view-transition-new(${name})`,
                { width: "100%", height: "100%", "object-fit": "cover" }
            )
        })

        /**
         * Clip the nested children of any layer that clips in the live layout,
         * so a wrapper crops its child for the whole morph (mirroring the DOM)
         * rather than only at the live-DOM handoff. No-op on browsers without
         * nested view-transition groups.
         */
        clipChildren.forEach((name) => {
            css.set(`::view-transition-group-children(${name})`, {
                overflow: "clip",
            })
        })

        css.commit() // Write
    }

    const cleanup = () => {
        releaseViewTransitionNames(assigned, classed, grouped)
        css.remove() // Write
    }

    const callback = async () => {
        await update()

        /**
         * Re-resolve so elements created by the update are named for the new
         * snapshot, then measure them. With both snapshots measured we can
         * settle the crop set (aspect-changing morphs + forced).
         */
        resolveLayers("new")
        measureLayers("new")
        finalizeCrop()

        /**
         * Re-commit the crop CSS unconditionally: `finalizeCrop` is computed
         * here (after both snapshots are measured), so the clip rules must be
         * (re)written to match the settled set.
         */
        commitViewCSS()
    }

    let transition: ViewTransition
    try {
        resolveLayers("old")
        /**
         * Measure the old snapshot against the optimistic crop set (the new
         * snapshot doesn't exist yet, so aspect change can't be known here;
         * `finalizeCrop` settles it post-update).
         */
        measureLayers("old")
        commitViewCSS()
        transition = document.startViewTransition(callback)
    } catch (error) {
        /**
         * The prelude writes inline names before the transition exists. If it
         * throws (e.g. startViewTransition rejects in a bad UA state), release
         * them so we neither leak DOM state nor stall the queue on a promise
         * that never settles - hand back a rejection it can advance past.
         */
        cleanup()
        return Promise.reject(error)
    }

    transition.finished.finally(cleanup)

    return new Promise<GroupAnimation>((resolve, reject) => {
        transition.ready
            .then(() => {
                const generatedViewAnimations = getViewAnimations()

                const animations: AnimationPlaybackControls[] = []

                /**
                 * Create animations for each of our explicitly-defined subjects.
                 * `opacityAnimated` additionally tracks which `${name}:${type}`
                 * we faded, so we can keep the UA `plus-lighter` blend only for a
                 * genuine opacity crossfade (both sides fading) and drop it for a
                 * slide/transform, where additive compositing would flash bright.
                 */
                const explicitlyAnimated = new Set<string>()
                const opacityAnimated = new Set<string>()
                layerTargets.forEach((target, name) => {
                    const stagger = layerStagger.get(name)
                    /**
                     * Presence: `enter` only fires for a pure newcomer (a new
                     * view with no old), `exit` only for a pure leaver. A
                     * survivor (both) gets neither - it just morphs.
                     */
                    const enterApplies = !!stagger?.new && !stagger?.old
                    const exitApplies = !!stagger?.old && !stagger?.new

                    for (const key of definitionNames) {
                        if (!target[key]) continue
                        if (key === "enter" && !enterApplies) continue
                        if (key === "exit" && !exitApplies) continue

                        const type = chooseLayerType(
                            key as keyof ViewTransitionTarget
                        )
                        const [index, total] = staggerPosition(name, type)
                        // Skip a layer absent from its snapshot.
                        if (index === -1) continue

                        const { keyframes, options } =
                            target[key as keyof ViewTransitionTarget]!

                        for (let [valueName, valueKeyframes] of Object.entries(
                            keyframes
                        )) {
                            // Skip only missing values - `0` (e.g. opacity: 0)
                            // is valid and must reach the from-value inference.
                            if (valueKeyframes == null) continue

                            /**
                             * The view path hands keyframes straight to WAAPI,
                             * so Motion's `x`/`y` shorthands (compiled to
                             * `transform` only via the value pipeline) have no
                             * effect. Warn and skip - use `transform`/`translate`.
                             */
                            if (valueName === "x" || valueName === "y") {
                                warnOnce(
                                    false,
                                    `animateView() animates view-transition layers with CSS properties; the "${valueName}" shorthand has no effect - use transform, e.g. { transform: "translateX(40px)" }.`
                                )
                                continue
                            }

                            /**
                             * enter/exit win over new/old on a shared property -
                             * skip it here when the gated bucket also defines it.
                             */
                            if (
                                key === "new" &&
                                enterApplies &&
                                target.enter?.keyframes[
                                    valueName as keyof DOMKeyframesDefinition
                                ] != null
                            ) {
                                continue
                            }
                            if (
                                key === "old" &&
                                exitApplies &&
                                target.exit?.keyframes[
                                    valueName as keyof DOMKeyframesDefinition
                                ] != null
                            ) {
                                continue
                            }

                            const valueOptions = mergeTransition(
                                getValueTransition(
                                    defaultOptions as any,
                                    valueName
                                ),
                                getValueTransition(options as any, valueName)
                            )

                            /**
                             * Infer an origin for a single-value keyframe. An
                             * `enter` mirrors the matching `exit` value (a
                             * defined exit reverses into the enter for free);
                             * otherwise the per-type default (opacity 0/1, scale
                             * 0.85). No default -> left as-is (animates from the
                             * live value).
                             *
                             * `new`/`old` fire for survivors too, where only the
                             * opacity crossfade default applies - a transform
                             * default like scale 0.85 would pop a persisting
                             * element, so gate it on the layer actually
                             * entering/leaving.
                             */
                            if (!Array.isArray(valueKeyframes)) {
                                const exitValue =
                                    key === "enter"
                                        ? target.exit?.keyframes[
                                              valueName as keyof DOMKeyframesDefinition
                                          ]
                                        : undefined
                                const allowDefault =
                                    valueName === "opacity" ||
                                    (type === "new" ? enterApplies : exitApplies)
                                const from =
                                    exitValue != null
                                        ? Array.isArray(exitValue)
                                            ? exitValue[exitValue.length - 1]
                                            : exitValue
                                        : allowDefault
                                          ? ORIGIN_DEFAULTS[type]?.[valueName]
                                          : undefined
                                if (from !== undefined) {
                                    valueKeyframes = [from, valueKeyframes]
                                }
                            }

                            /**
                             * Resolve stagger function if provided, per element
                             * across this subject's resolved layers.
                             */
                            if (typeof valueOptions.delay === "function") {
                                valueOptions.delay = valueOptions.delay(
                                    index,
                                    total
                                )
                            }

                            valueOptions.duration &&= secondsToMilliseconds(
                                valueOptions.duration
                            )

                            valueOptions.delay &&= secondsToMilliseconds(
                                valueOptions.delay
                            )

                            animations.push(
                                new NativeAnimation({
                                    ...valueOptions,
                                    element: document.documentElement,
                                    name: valueName,
                                    pseudoElement: `::view-transition-${type}(${name})`,
                                    keyframes: valueKeyframes,
                                })
                            )
                            explicitlyAnimated.add(`${name}:${type}`)
                            if (valueName === "opacity") {
                                opacityAnimated.add(`${name}:${type}`)
                            }
                        }
                    }
                })

                /**
                 * Handle browser generated animations
                 */
                for (const animation of generatedViewAnimations) {
                    if (animation.playState === "finished") continue

                    const { effect } = animation
                    if (!effect || !(effect instanceof KeyframeEffect)) continue

                    const { pseudoElement } = effect
                    if (!pseudoElement) continue

                    const name = getViewAnimationLayerInfo(pseudoElement)
                    if (!name) continue

                    const targetDefinition = layerTargets.get(name.layer)

                    /**
                     * We built our own animation for this layer, so drop the
                     * browser-generated fade we're replacing. The UA
                     * `plus-lighter` blend is a *separate* generated animation on
                     * the same pseudo (it sets `mix-blend-mode` in its keyframes):
                     * keep it *only* for a true opacity crossfade - both sides
                     * fading - so a symmetric crossfade composites without
                     * darkening, but a slide/transform (where both layers stay
                     * opaque and overlap) doesn't flash bright from the addition.
                     */
                    if (explicitlyAnimated.has(`${name.layer}:${name.type}`)) {
                        const isCrossfade =
                            opacityAnimated.has(`${name.layer}:new`) &&
                            opacityAnimated.has(`${name.layer}:old`)
                        if (
                            isCrossfade &&
                            effect
                                .getKeyframes()
                                .some((keyframe) => keyframe.mixBlendMode)
                        ) {
                            animations.push(new NativeAnimationWrapper(animation))
                        } else {
                            animation.cancel()
                        }
                        continue
                    }

                    /**
                     * Drop the orphaned half of the default crossfade. The UA
                     * fades old out and new in as a *pair*; if the opposing half
                     * was explicitly overridden with something other than an
                     * opacity fade (a clip or transform reveal), this side's
                     * default opacity fade has no partner - left to run it would
                     * dissolve what should be a static backdrop (e.g.
                     * `.new({ clipPath })` should reveal over a still old view,
                     * not fade the old out around the growing clip). Cancel it -
                     * and its `plus-lighter` sibling on the same pseudo, which
                     * would otherwise flash bright where the two opaque layers
                     * overlap. A genuine crossfade (the opposing side also fading
                     * opacity) keeps both halves and is handled above.
                     */
                    const opposite =
                        name.type === "old"
                            ? "new"
                            : name.type === "new"
                              ? "old"
                              : undefined
                    if (
                        opposite &&
                        explicitlyAnimated.has(
                            `${name.layer}:${opposite}`
                        ) &&
                        !opacityAnimated.has(`${name.layer}:${opposite}`)
                    ) {
                        animation.cancel()
                        continue
                    }

                    /**
                     * Otherwise retime the browser-generated animation to
                     * Motion's timing. This auto-enables the layout (group)
                     * morph for any resolved/named target, and applies the
                     * default timing to old/new layers we haven't explicitly
                     * overridden.
                     *
                     * group + group-children both follow the layout timing so
                     * the nesting container stays in sync with the morph.
                     */
                    /**
                     * A survivor's old + new are the two halves of one
                     * `plus-lighter` crossfade. They must share identical timing
                     * (so their opacities stay mirrored and sum to 1 - else the
                     * additive blend flashes bright wherever both are partly
                     * visible) and fade linearly (the bounce belongs on the
                     * group's geometry, not the opacity). So time them as the
                     * group, rather than via their own - potentially staggered,
                     * or enter/exit-derived - old/new options.
                     */
                    const stagger = layerStagger.get(name.layer)
                    const isMorphCrossfade =
                        (name.type === "old" || name.type === "new") &&
                        !!stagger?.old &&
                        !!stagger?.new

                    let timing: {
                        delay: number
                        duration?: number
                        easing: string
                    }
                    if (name.type.startsWith("group")) {
                        // group + group-children follow the resolved group
                        // timing - the single source shared with the crop
                        // corner-radius pass below.
                        const { delay, duration, ease } = resolveGroupTiming(
                            name.layer
                        )
                        timing = {
                            delay,
                            duration,
                            easing: mapEasingToNativeEasing(
                                ease,
                                duration!
                            ) as string,
                        }
                    } else {
                        const timingType = isMorphCrossfade ? "group" : name.type
                        const [index, total] = staggerPosition(
                            name.layer,
                            timingType
                        )
                        const transitionName =
                            timingType === "group" ? "layout" : ""
                        let animationTransition = resolveLayerTransition(
                            targetDefinition,
                            timingType,
                            transitionName,
                            index === -1 ? 0 : index,
                            total
                        )

                        /**
                         * The crossfade should resolve at the spring's
                         * *perceptual* (visual) duration - the geometry can keep
                         * bouncing, but the opacity shouldn't drag through the
                         * settle. So capture `visualDuration` before
                         * `applyGeneratorOptions` replaces it with the full
                         * overshoot duration, and use it for the fade.
                         */
                        const visualDuration = animationTransition.visualDuration

                        animationTransition.duration &&= secondsToMilliseconds(
                            animationTransition.duration
                        )

                        animationTransition =
                            applyGeneratorOptions(animationTransition)

                        timing = {
                            delay: secondsToMilliseconds(
                                animationTransition.delay ?? 0
                            ),
                            duration:
                                isMorphCrossfade && visualDuration !== undefined
                                    ? secondsToMilliseconds(visualDuration)
                                    : animationTransition.duration,
                            easing: isMorphCrossfade
                                ? "linear"
                                : (mapEasingToNativeEasing(
                                      animationTransition.ease,
                                      animationTransition.duration!
                                  ) as string),
                        }
                    }

                    effect.updateTiming(timing)

                    animations.push(new NativeAnimationWrapper(animation))
                }

                /**
                 * Round each cropped layer's clip. Its `::view-transition-group`
                 * has `overflow: clip`, which would otherwise square the corners
                 * mid-morph; animate each corner from the old element's radius to
                 * the new element's so the crop stays rounded. Timed as the group
                 * (`layout`) so the radius tracks the morphing box.
                 */
                cropMeasurements.forEach((entry, name) => {
                    if (!croppedNames.has(name)) return

                    // Reuse the group's resolved timing - native ms delay/
                    // duration + a baked ease, with no generator `type` or
                    // repeat/times to leak into (or throw inside) NativeAnimation.
                    const { delay, duration, ease } = resolveGroupTiming(name)

                    for (const corner of cornerRadiusProps) {
                        // `||` (not `??`) so an empty measurement falls back to
                        // the other snapshot rather than an invalid keyframe.
                        const from =
                            entry.old?.radii[corner] ||
                            entry.new?.radii[corner] ||
                            "0px"
                        const to =
                            entry.new?.radii[corner] ||
                            entry.old?.radii[corner] ||
                            "0px"
                        // Nothing to round if the corner is square at both ends.
                        if (isSquareRadius(from) && isSquareRadius(to)) continue

                        animations.push(
                            new NativeAnimation({
                                element: document.documentElement,
                                name: corner,
                                pseudoElement: `::view-transition-group(${name})`,
                                keyframes: [from, to],
                                delay,
                                duration,
                                ease,
                            })
                        )
                    }
                })

                resolve(new GroupAnimation(animations))
            })
            .catch(() =>
                /**
                 * `ready` rejects when the transition is skipped - no visual
                 * change, or superseded by an interrupting transition. The DOM
                 * update still applied, so settle with no animations rather than
                 * surfacing it as an error to an awaiting caller. A genuine
                 * failure in `update()` rejects `updateCallbackDone` (already
                 * settled by now), so propagate that instead.
                 */
                transition.updateCallbackDone.then(
                    () => resolve(new GroupAnimation([])),
                    reject
                )
            )
    })
}

/**
 * The options that should time a given generated layer type, so a retimed
 * group/old/new picks up any per-target transition the user provided. Checks
 * the type's buckets in priority order (e.g. `new` before `enter`).
 */
function layerOptions(target: ViewTransitionTarget | undefined, type: string) {
    for (const bucket of typeBuckets[type] ?? []) {
        const options = target?.[bucket]?.options
        if (options) return options
    }
}

/**
 * Merge a base transition (e.g. the default `options`) with a per-layer/value
 * override. An explicit `duration` on the override must win over an inherited
 * generator's own timing: a spring prefers `visualDuration`, and
 * `spring.applyToOptions` overwrites `duration` with the computed settle time -
 * so without this the override is silently discarded. Dropping the inherited
 * `type`/`visualDuration` makes the layer a plain tween of that duration, unless
 * it asked for its own generator `type`/`visualDuration`.
 */
function mergeTransition(base: any, override: any) {
    const merged = { ...base, ...override }

    if (override.duration !== undefined) {
        if (override.visualDuration === undefined) delete merged.visualDuration
        if (override.type === undefined) delete merged.type
    }

    return merged
}
