/**
 * Proof of concept: a whole-app "Motion compiler".
 *
 * Like Tailwind's content scan, it parses every source file before the
 * build, records which motion props the app uses, then swaps the `motion`
 * export of "motion/react" for one built with only the features those props
 * need. Anything it can't see statically (prop spreads, motion.create, a
 * component passed to motion()) makes it keep every feature.
 *
 * It also reports whether the app could use the mini (WAAPI) `motion`
 * component from "motion/react-mini". That's a report, not a switch,
 * because mini changes default transitions (tween, not spring).
 */
import fs from "fs"
import path from "path"
import { parse } from "@babel/parser"

const motionSources = new Set([
    "motion/react",
    "motion/react-client",
    "framer-motion",
])

/**
 * Feature packages and the props or imports that need them.
 */
const featureProps = {
    animation: [
        "animate",
        "variants",
        "whileHover",
        "whileTap",
        "exit",
        "whileInView",
        "whileFocus",
        "whileDrag",
    ],
    exit: ["exit"],
    hover: ["whileHover", "onHoverStart", "onHoverEnd"],
    tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
    focus: ["whileFocus"],
    inView: ["whileInView", "onViewportEnter", "onViewportLeave", "viewport"],
    pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
    drag: [
        "drag",
        "dragControls",
        "whileDrag",
        "dragConstraints",
        "onDrag",
        "onDragStart",
        "onDragEnd",
        "dragListener",
    ],
    layout: [
        "layout",
        "layoutId",
        "layoutDependency",
        "onLayoutAnimationStart",
        "onLayoutAnimationComplete",
        "layoutScroll",
        "layoutRoot",
    ],
}
const featureImports = {
    AnimatePresence: ["exit"],
    LayoutGroup: ["layout"],
    Reorder: ["drag", "layout"],
    useDragControls: ["drag"],
}

const svgTags = new Set(
    "svg path circle ellipse line polygon polyline rect g text tspan use mask clipPath defs linearGradient radialGradient stop pattern symbol image foreignObject filter feGaussianBlur".split(
        " "
    )
)

const miniProps = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "variants",
    "custom",
    "inherit",
    "style",
    "whileHover",
    "whileTap",
    "whileFocus",
    "whileInView",
    "viewport",
    "onAnimationStart",
    "onAnimationComplete",
    "onHoverStart",
    "onHoverEnd",
    "onTapStart",
    "onTap",
    "onTapCancel",
    "onViewportEnter",
    "onViewportLeave",
])
const motionProps = new Set([
    ...Object.values(featureProps).flat(),
    ...miniProps,
    "transformTemplate",
    "onUpdate",
    "onAnimationStart",
    "dragElastic",
    "dragMomentum",
    "dragTransition",
    "dragSnapToOrigin",
    "dragDirectionLock",
    "dragPropagation",
    "onDirectionLock",
    "onDragTransitionEnd",
    "ignoreStrict",
])

function walk(node, visit, parent) {
    if (!node || typeof node.type !== "string") return
    visit(node, parent)
    for (const key in node) {
        if (key === "loc" || key === "start" || key === "end") continue
        const child = node[key]
        if (Array.isArray(child)) child.forEach((c) => walk(c, visit, node))
        else if (child && typeof child.type === "string")
            walk(child, visit, node)
    }
}

const literalString = (node) =>
    node?.type === "StringLiteral" ? node.value : undefined

/**
 * Find transition `type` strings mini can't run, like "spring".
 */
function findTransitionTypes(node, out) {
    walk(node, (n) => {
        if (
            n.type === "ObjectProperty" &&
            (n.key.name === "type" || n.key.value === "type")
        ) {
            out.push(literalString(n.value) ?? "<dynamic>")
        }
    })
}

export function analyzeFile(file, code, result) {
    let ast
    try {
        ast = parse(code, {
            sourceType: "module",
            plugins: ["jsx", "typescript"],
        })
    } catch (e) {
        result.unknown.push(`${file}: couldn't parse (${e.message})`)
        return
    }

    const motionNames = new Set()
    for (const node of ast.program.body) {
        if (
            node.type !== "ImportDeclaration" ||
            !motionSources.has(node.source.value)
        )
            continue
        for (const s of node.specifiers) {
            const imported =
                s.type === "ImportNamespaceSpecifier"
                    ? "*"
                    : s.imported?.name ?? "default"
            if (imported === "motion" || imported === "m" || imported === "*")
                motionNames.add(s.local.name)
            featureImports[imported]?.forEach((f) => result.features.add(f))
            if (
                ["useAnimationControls", "useAnimation", "Reorder"].includes(
                    imported
                )
            ) {
                result.miniBlockers.push(`${file}: imports ${imported}`)
            }
        }
    }
    if (!motionNames.size) return

    walk(ast.program, (node, parent) => {
        // motion.create(Component), motion(Component), m.create(...)
        if (node.type === "CallExpression") {
            const callee = node.callee
            const isFactory =
                (callee.type === "Identifier" &&
                    motionNames.has(callee.name)) ||
                (callee.type === "MemberExpression" &&
                    motionNames.has(callee.object.name) &&
                    callee.property.name === "create")
            if (isFactory) {
                result.unknown.push(
                    `${file}:${node.loc.start.line} ${code.slice(
                        node.start,
                        node.end
                    )}: props reach it through another component`
                )
            }
        }

        if (node.type !== "JSXOpeningElement") return
        const name = node.name
        if (
            name.type !== "JSXMemberExpression" ||
            !motionNames.has(name.object.name)
        )
            return

        const tag = name.property.name
        const where = `${file}:${node.loc.start.line} <${name.object.name}.${tag}>`
        result.elements++
        if (svgTags.has(tag)) result.svg = true

        for (const attr of node.attributes) {
            if (attr.type === "JSXSpreadAttribute") {
                result.unknown.push(`${where}: spreads props`)
                continue
            }
            const prop = attr.name.name
            result.props.add(prop)
            for (const feature in featureProps) {
                if (featureProps[feature].includes(prop))
                    result.features.add(feature)
            }
            if (motionProps.has(prop) && !miniProps.has(prop)) {
                result.miniBlockers.push(`${where}: ${prop}`)
            }
            if (
                prop === "transition" ||
                prop === "variants" ||
                prop === "animate" ||
                prop.startsWith("while")
            ) {
                const value = attr.value?.expression
                if (value?.type === "Identifier") {
                    result.miniUnverified.push(
                        `${where}: ${prop}={${value.name}}`
                    )
                }
                const types = []
                findTransitionTypes(value, types)
                types.forEach((type) =>
                    result.miniBlockers.push(
                        `${where}: transition type "${type}"`
                    )
                )
            }
        }
        if (svgTags.has(tag) && tag !== "svg" && tag !== "g") {
            result.miniBlockers.push(
                `${where}: SVG attributes can't animate with WAAPI`
            )
        }
    })
}

export function analyze(files) {
    const result = {
        files: files.length,
        elements: 0,
        props: new Set(),
        features: new Set(),
        svg: false,
        unknown: [],
        miniBlockers: [],
        miniUnverified: [],
    }
    for (const file of files)
        analyzeFile(file, fs.readFileSync(file, "utf8"), result)
    if (result.unknown.length) {
        Object.keys(featureProps).forEach((f) => result.features.add(f))
        result.svg = true
    }
    return result
}

/**
 * The module that replaces `motion`. The deep imports are internals a
 * shipped version would export from a "motion/react-compiler" entry.
 */
export function generate(result, { fm }) {
    const f = result.features
    const imports = [
        `import { createMotionProxy } from "${fm}/render/components/create-proxy.mjs"`,
        `import { HTMLVisualElement, SVGVisualElement } from "motion-dom"`,
    ]
    const entries = []
    if (f.has("animation") || f.has("exit")) {
        imports.push(
            `import { animations } from "${fm}/motion/features/animations.mjs"`
        )
        entries.push("...animations")
    }
    const gesture = {
        hover: ["gestures/hover.mjs", "HoverGesture"],
        tap: ["gestures/press.mjs", "PressGesture"],
        focus: ["gestures/focus.mjs", "FocusGesture"],
        inView: ["motion/features/viewport/index.mjs", "InViewFeature"],
        pan: ["gestures/pan/index.mjs", "PanGesture"],
    }
    for (const key in gesture) {
        if (!f.has(key)) continue
        imports.push(
            `import { ${gesture[key][1]} } from "${fm}/${gesture[key][0]}"`
        )
        entries.push(`${key}: { Feature: ${gesture[key][1]} }`)
    }
    if (f.has("drag")) {
        imports.push(`import { drag } from "${fm}/motion/features/drag.mjs"`)
        entries.push("...drag")
    }
    if (f.has("layout")) {
        imports.push(
            `import { layout } from "${fm}/motion/features/layout.mjs"`
        )
        entries.push("...layout")
    }

    const renderer = result.svg
        ? `(C, o) => (o.isSVG ?? (typeof C === "string" && /^[a-z]/.test(C) && ${JSON.stringify(
              [...svgTags]
          )}.includes(C))) ? new SVGVisualElement(o) : new HTMLVisualElement(o, { allowProjection: true })`
        : `(C, o) => new HTMLVisualElement(o, { allowProjection: ${
              f.has("layout") || f.has("drag")
          } })`

    return [
        ...[...new Set(imports)],
        `export const motion = /*@__PURE__*/ createMotionProxy({ ${entries.join(
            ", "
        )} }, ${renderer})`,
    ].join("\n")
}

export function report(result) {
    const lines = [
        `Motion compiler: ${result.elements} motion elements in ${result.files} files`,
        `  features: ${[...result.features].join(", ") || "none"}${
            result.svg ? " + SVG renderer" : ""
        }`,
    ]
    if (result.unknown.length) {
        lines.push(`  kept every feature, because:`)
        result.unknown.forEach((u) => lines.push(`    - ${u}`))
    }
    lines.push(
        result.miniBlockers.length || result.unknown.length
            ? `  mini motion: not eligible (${
                  result.miniBlockers.length + result.unknown.length
              } blockers)`
            : `  mini motion: eligible${
                  result.miniUnverified.length
                      ? `, after checking ${result.miniUnverified.length} non-literal transitions/variants`
                      : ""
              }`
    )
    result.miniBlockers.slice(0, 8).forEach((b) => lines.push(`    - ${b}`))
    return lines.join("\n")
}

/**
 * Rollup/Vite plugin.
 */
export function motionCompiler({ files, fm }) {
    const appFiles = new Set(files.map((file) => path.resolve(file)))
    let code
    return {
        name: "motion-compiler",
        buildStart() {
            const result = analyze(files)
            code = generate(result, { fm })
            this.warn?.(report(result))
        },
        resolveId(id, importer) {
            if (id === "\0motion-compiled" || id === "\0motion-react") return id
            if (!motionSources.has(id) || !importer) return
            /**
             * Only the app's own imports are compiled. Libraries, and
             * the generated modules, get the real package.
             */
            if (appFiles.has(importer)) {
                return { id: "\0motion-react", moduleSideEffects: false }
            }
            if (importer.startsWith("\0")) {
                return this.resolve(id, files[0], { skipSelf: true })
            }
        },
        async load(id) {
            if (id === "\0motion-compiled") return code
            if (id === "\0motion-react") {
                return `export * from "motion/react"\nexport { motion } from "\0motion-compiled"`
            }
        },
    }
}

export function listFiles(dir) {
    return fs
        .readdirSync(dir, { recursive: true })
        .filter((f) => /\.(t|j)sx?$/.test(f))
        .map((f) => path.join(dir, f))
}
