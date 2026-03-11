import { AnyResolvedKeyframe } from "../../animation/types"
import { ResolvedValues } from "../types"
import { HTMLRenderState } from "../html/types"

export interface SVGRenderState extends HTMLRenderState {
    /**
     * A mutable record of attributes we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    attrs: ResolvedValues
}

export interface SVGAttributes {
    accentHeight?: AnyResolvedKeyframe | undefined
    accumulate?: "none" | "sum" | undefined
    additive?: "replace" | "sum" | undefined
    alignmentBaseline?:
        | "auto"
        | "baseline"
        | "before-edge"
        | "text-before-edge"
        | "middle"
        | "central"
        | "after-edge"
        | "text-after-edge"
        | "ideographic"
        | "alphabetic"
        | "hanging"
        | "mathematical"
        | "inherit"
        | undefined
    allowReorder?: "no" | "yes" | undefined
    alphabetic?: AnyResolvedKeyframe | undefined
    amplitude?: AnyResolvedKeyframe | undefined
    arabicForm?: "initial" | "medial" | "terminal" | "isolated" | undefined
    ascent?: AnyResolvedKeyframe | undefined
    attributeName?: string | undefined
    attributeType?: string | undefined
    autoReverse?: boolean | undefined
    azimuth?: AnyResolvedKeyframe | undefined
    baseFrequency?: AnyResolvedKeyframe | undefined
    baselineShift?: AnyResolvedKeyframe | undefined
    baseProfile?: AnyResolvedKeyframe | undefined
    bbox?: AnyResolvedKeyframe | undefined
    begin?: AnyResolvedKeyframe | undefined
    bias?: AnyResolvedKeyframe | undefined
    by?: AnyResolvedKeyframe | undefined
    calcMode?: AnyResolvedKeyframe | undefined
    capHeight?: AnyResolvedKeyframe | undefined
    clip?: AnyResolvedKeyframe | undefined
    clipPath?: string | undefined
    clipPathUnits?: AnyResolvedKeyframe | undefined
    clipRule?: AnyResolvedKeyframe | undefined
    colorInterpolation?: AnyResolvedKeyframe | undefined
    colorInterpolationFilters?:
        | "auto"
        | "sRGB"
        | "linearRGB"
        | "inherit"
        | undefined
    colorProfile?: AnyResolvedKeyframe | undefined
    colorRendering?: AnyResolvedKeyframe | undefined
    contentScriptType?: AnyResolvedKeyframe | undefined
    contentStyleType?: AnyResolvedKeyframe | undefined
    cursor?: AnyResolvedKeyframe | undefined
    cx?: AnyResolvedKeyframe | undefined
    cy?: AnyResolvedKeyframe | undefined
    d?: string | undefined
    decelerate?: AnyResolvedKeyframe | undefined
    descent?: AnyResolvedKeyframe | undefined
    diffuseConstant?: AnyResolvedKeyframe | undefined
    direction?: AnyResolvedKeyframe | undefined
    display?: AnyResolvedKeyframe | undefined
    divisor?: AnyResolvedKeyframe | undefined
    dominantBaseline?: AnyResolvedKeyframe | undefined
    dur?: AnyResolvedKeyframe | undefined
    dx?: AnyResolvedKeyframe | undefined
    dy?: AnyResolvedKeyframe | undefined
    edgeMode?: AnyResolvedKeyframe | undefined
    elevation?: AnyResolvedKeyframe | undefined
    enableBackground?: AnyResolvedKeyframe | undefined
    end?: AnyResolvedKeyframe | undefined
    exponent?: AnyResolvedKeyframe | undefined
    externalResourcesRequired?: boolean | undefined
    fill?: string | undefined
    fillOpacity?: AnyResolvedKeyframe | undefined
    fillRule?: "nonzero" | "evenodd" | "inherit" | undefined
    filter?: string | undefined
    filterRes?: AnyResolvedKeyframe | undefined
    filterUnits?: AnyResolvedKeyframe | undefined
    floodColor?: AnyResolvedKeyframe | undefined
    floodOpacity?: AnyResolvedKeyframe | undefined
    focusable?: boolean | "auto" | undefined
    fontFamily?: string | undefined
    fontSize?: AnyResolvedKeyframe | undefined
    fontSizeAdjust?: AnyResolvedKeyframe | undefined
    fontStretch?: AnyResolvedKeyframe | undefined
    fontStyle?: AnyResolvedKeyframe | undefined
    fontVariant?: AnyResolvedKeyframe | undefined
    fontWeight?: AnyResolvedKeyframe | undefined
    format?: AnyResolvedKeyframe | undefined
    fr?: AnyResolvedKeyframe | undefined
    from?: AnyResolvedKeyframe | undefined
    fx?: AnyResolvedKeyframe | undefined
    fy?: AnyResolvedKeyframe | undefined
    g1?: AnyResolvedKeyframe | undefined
    g2?: AnyResolvedKeyframe | undefined
    glyphName?: AnyResolvedKeyframe | undefined
    glyphOrientationHorizontal?: AnyResolvedKeyframe | undefined
    glyphOrientationVertical?: AnyResolvedKeyframe | undefined
    glyphRef?: AnyResolvedKeyframe | undefined
    gradientTransform?: string | undefined
    gradientUnits?: string | undefined
    hanging?: AnyResolvedKeyframe | undefined
    horizAdvX?: AnyResolvedKeyframe | undefined
    horizOriginX?: AnyResolvedKeyframe | undefined
    href?: string | undefined
    ideographic?: AnyResolvedKeyframe | undefined
    imageRendering?: AnyResolvedKeyframe | undefined
    in2?: AnyResolvedKeyframe | undefined
    in?: string | undefined
    intercept?: AnyResolvedKeyframe | undefined
    k1?: AnyResolvedKeyframe | undefined
    k2?: AnyResolvedKeyframe | undefined
    k3?: AnyResolvedKeyframe | undefined
    k4?: AnyResolvedKeyframe | undefined
    k?: AnyResolvedKeyframe | undefined
    kernelMatrix?: AnyResolvedKeyframe | undefined
    kernelUnitLength?: AnyResolvedKeyframe | undefined
    kerning?: AnyResolvedKeyframe | undefined
    keyPoints?: AnyResolvedKeyframe | undefined
    keySplines?: AnyResolvedKeyframe | undefined
    keyTimes?: AnyResolvedKeyframe | undefined
    lengthAdjust?: AnyResolvedKeyframe | undefined
    letterSpacing?: AnyResolvedKeyframe | undefined
    lightingColor?: AnyResolvedKeyframe | undefined
    limitingConeAngle?: AnyResolvedKeyframe | undefined
    local?: AnyResolvedKeyframe | undefined
    markerEnd?: string | undefined
    markerHeight?: AnyResolvedKeyframe | undefined
    markerMid?: string | undefined
    markerStart?: string | undefined
    markerUnits?: AnyResolvedKeyframe | undefined
    markerWidth?: AnyResolvedKeyframe | undefined
    mask?: string | undefined
    maskContentUnits?: AnyResolvedKeyframe | undefined
    maskUnits?: AnyResolvedKeyframe | undefined
    mathematical?: AnyResolvedKeyframe | undefined
    mode?: AnyResolvedKeyframe | undefined
    numOctaves?: AnyResolvedKeyframe | undefined
    offset?: AnyResolvedKeyframe | undefined
    opacity?: AnyResolvedKeyframe | undefined
    operator?: AnyResolvedKeyframe | undefined
    order?: AnyResolvedKeyframe | undefined
    orient?: AnyResolvedKeyframe | undefined
    orientation?: AnyResolvedKeyframe | undefined
    origin?: AnyResolvedKeyframe | undefined
    overflow?: AnyResolvedKeyframe | undefined
    overlinePosition?: AnyResolvedKeyframe | undefined
    overlineThickness?: AnyResolvedKeyframe | undefined
    paintOrder?: AnyResolvedKeyframe | undefined
    panose1?: AnyResolvedKeyframe | undefined
    path?: string | undefined
    pathLength?: AnyResolvedKeyframe | undefined
    patternContentUnits?: string | undefined
    patternTransform?: AnyResolvedKeyframe | undefined
    patternUnits?: string | undefined
    pointerEvents?: AnyResolvedKeyframe | undefined
    points?: string | undefined
    pointsAtX?: AnyResolvedKeyframe | undefined
    pointsAtY?: AnyResolvedKeyframe | undefined
    pointsAtZ?: AnyResolvedKeyframe | undefined
    preserveAlpha?: boolean | undefined
    preserveAspectRatio?: string | undefined
    primitiveUnits?: AnyResolvedKeyframe | undefined
    r?: AnyResolvedKeyframe | undefined
    radius?: AnyResolvedKeyframe | undefined
    refX?: AnyResolvedKeyframe | undefined
    refY?: AnyResolvedKeyframe | undefined
    renderingIntent?: AnyResolvedKeyframe | undefined
    repeatCount?: AnyResolvedKeyframe | undefined
    repeatDur?: AnyResolvedKeyframe | undefined
    requiredExtensions?: AnyResolvedKeyframe | undefined
    requiredFeatures?: AnyResolvedKeyframe | undefined
    restart?: AnyResolvedKeyframe | undefined
    result?: string | undefined
    rotate?: AnyResolvedKeyframe | undefined
    rx?: AnyResolvedKeyframe | undefined
    ry?: AnyResolvedKeyframe | undefined
    scale?: AnyResolvedKeyframe | undefined
    seed?: AnyResolvedKeyframe | undefined
    shapeRendering?: AnyResolvedKeyframe | undefined
    slope?: AnyResolvedKeyframe | undefined
    spacing?: AnyResolvedKeyframe | undefined
    specularConstant?: AnyResolvedKeyframe | undefined
    specularExponent?: AnyResolvedKeyframe | undefined
    speed?: AnyResolvedKeyframe | undefined
    spreadMethod?: string | undefined
    startOffset?: AnyResolvedKeyframe | undefined
    stdDeviation?: AnyResolvedKeyframe | undefined
    stemh?: AnyResolvedKeyframe | undefined
    stemv?: AnyResolvedKeyframe | undefined
    stitchTiles?: AnyResolvedKeyframe | undefined
    stopColor?: string | undefined
    stopOpacity?: AnyResolvedKeyframe | undefined
    strikethroughPosition?: AnyResolvedKeyframe | undefined
    strikethroughThickness?: AnyResolvedKeyframe | undefined
    string?: AnyResolvedKeyframe | undefined
    stroke?: string | undefined
    strokeDasharray?: AnyResolvedKeyframe | undefined
    strokeDashoffset?: AnyResolvedKeyframe | undefined
    strokeLinecap?: "butt" | "round" | "square" | "inherit" | undefined
    strokeLinejoin?: "miter" | "round" | "bevel" | "inherit" | undefined
    strokeMiterlimit?: AnyResolvedKeyframe | undefined
    strokeOpacity?: AnyResolvedKeyframe | undefined
    strokeWidth?: AnyResolvedKeyframe | undefined
    surfaceScale?: AnyResolvedKeyframe | undefined
    systemLanguage?: AnyResolvedKeyframe | undefined
    tableValues?: AnyResolvedKeyframe | undefined
    targetX?: AnyResolvedKeyframe | undefined
    targetY?: AnyResolvedKeyframe | undefined
    textAnchor?: string | undefined
    textDecoration?: AnyResolvedKeyframe | undefined
    textLength?: AnyResolvedKeyframe | undefined
    textRendering?: AnyResolvedKeyframe | undefined
    to?: AnyResolvedKeyframe | undefined
    transform?: string | undefined
    u1?: AnyResolvedKeyframe | undefined
    u2?: AnyResolvedKeyframe | undefined
    underlinePosition?: AnyResolvedKeyframe | undefined
    underlineThickness?: AnyResolvedKeyframe | undefined
    unicode?: AnyResolvedKeyframe | undefined
    unicodeBidi?: AnyResolvedKeyframe | undefined
    unicodeRange?: AnyResolvedKeyframe | undefined
    unitsPerEm?: AnyResolvedKeyframe | undefined
    vAlphabetic?: AnyResolvedKeyframe | undefined
    values?: string | undefined
    vectorEffect?: AnyResolvedKeyframe | undefined
    version?: string | undefined
    vertAdvY?: AnyResolvedKeyframe | undefined
    vertOriginX?: AnyResolvedKeyframe | undefined
    vertOriginY?: AnyResolvedKeyframe | undefined
    vHanging?: AnyResolvedKeyframe | undefined
    vIdeographic?: AnyResolvedKeyframe | undefined
    viewBox?: string | undefined
    viewTarget?: AnyResolvedKeyframe | undefined
    visibility?: AnyResolvedKeyframe | undefined
    vMathematical?: AnyResolvedKeyframe | undefined
    widths?: AnyResolvedKeyframe | undefined
    wordSpacing?: AnyResolvedKeyframe | undefined
    writingMode?: AnyResolvedKeyframe | undefined
    x1?: AnyResolvedKeyframe | undefined
    x2?: AnyResolvedKeyframe | undefined
    x?: AnyResolvedKeyframe | undefined
    xChannelSelector?: string | undefined
    xHeight?: AnyResolvedKeyframe | undefined
    xlinkActuate?: string | undefined
    xlinkArcrole?: string | undefined
    xlinkHref?: string | undefined
    xlinkRole?: string | undefined
    xlinkShow?: string | undefined
    xlinkTitle?: string | undefined
    xlinkType?: string | undefined
    xmlBase?: string | undefined
    xmlLang?: string | undefined
    xmlns?: string | undefined
    xmlnsXlink?: string | undefined
    xmlSpace?: string | undefined
    y1?: AnyResolvedKeyframe | undefined
    y2?: AnyResolvedKeyframe | undefined
    y?: AnyResolvedKeyframe | undefined
    yChannelSelector?: string | undefined
    z?: AnyResolvedKeyframe | undefined
    zoomAndPan?: string | undefined
}
