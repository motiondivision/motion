import { SubscriptionManager } from "framer-motion/dom"
import { parseUniforms, type UniformLayout } from "./uniforms"

/**
 * WebGPU isn't in this TypeScript's DOM types.
 */
export type GPU = any

/**
 * Whether the browser has WebGPU and can copy elements into its textures.
 */
export const hasWebGPU = () =>
    typeof navigator !== "undefined" &&
    "gpu" in navigator &&
    "drawElementImageToTexture" in
        ((globalThis as GPU).GPUQueue?.prototype || {})

let shared: Promise<GPU | null> | undefined
const lost = new SubscriptionManager<VoidFunction>()

/**
 * One device for every layer on the page. Resolves with `null` if the
 * browser has no adapter to give.
 */
export const requestDevice = () =>
    (shared ||= (async () => {
        try {
            const adapter = await (navigator as GPU).gpu.requestAdapter()
            const device = await adapter.requestDevice()
            device.lost.then(() => {
                shared = undefined
                lost.notify()
            })
            return device
        } catch {
            shared = undefined
            return null
        }
    })())

export const onDeviceLost = (callback: VoidFunction) => lost.add(callback)

/**
 * Every element shader gets these. An instance is one pose of the
 * element: the matrix from poseMatrix(), in CSS pixels, and an alpha.
 */
const prelude = `
struct Layer { size: vec2f, canvas: vec2f, time: f32, perspective: f32, segments: vec2f, origin: vec2f }
@group(0) @binding(0) var<uniform> layer: Layer;
@group(0) @binding(1) var elementTexture: texture_2d<f32>;
@group(0) @binding(2) var elementSampler: sampler;

struct Vertex {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) alpha: f32,
}

// How uv changes across a pixel, which picks the mipmap
var<private> gradX: vec2f;
var<private> gradY: vec2f;

// Transparent outside the element, not a smear of its edge
fn element(uv: vec2f) -> vec4f {
  return textureSampleGrad(elementTexture, elementSampler, uv, gradX, gradY) *
    f32(all(uv >= vec2f(0.0)) && all(uv <= vec2f(1.0)));
}

// A point (x * w, y * w, w), in CSS pixels from the canvas' top-left
fn toClip(p: vec3f) -> vec4f {
  return vec4f(p.x / layer.canvas.x * 2.0 - p.z, p.z - p.y / layer.canvas.y * 2.0, 0.0, p.z);
}

// A point in the layer's perspective. z is towards the viewer.
fn project(position: vec3f) -> vec4f {
  let k = position.z / max(layer.perspective, 1e-6) * f32(layer.perspective > 0.0);
  return toClip(vec3f(position.xy - layer.canvas * 0.5 * k, 1.0 - k));
}

@vertex fn vertexMain(
  @builtin(vertex_index) index: u32,
  @location(0) x: vec3f,
  @location(1) y: vec3f,
  @location(2) offset: vec3f,
  @location(3) alpha: f32,
) -> Vertex {
  let uv = vec2f(f32(index & 1u), f32(index >> 1u));
  return Vertex(toClip(mat3x3f(x, y, offset) * vec3f(uv * layer.size, 1.0)), uv, alpha);
}

@fragment fn fragmentMain(in: Vertex) -> @location(0) vec4f {
  gradX = dpdx(in.uv);
  gradY = dpdy(in.uv);
  return effect(in.uv) * in.alpha;
}
`

/**
 * For a shader with \`fn vertex(uv: vec2f) -> vec4f\`. It's drawn on a
 * grid of layer.segments cells, and vertex() gives the clip space
 * position of each point of it. mapMain writes the uv of each pixel, to
 * find what's under the pointer.
 */
const surface = `
@vertex fn surfaceMain(@builtin(vertex_index) index: u32) -> Vertex {
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  let cell = index / 6u;
  let columns = u32(layer.segments.x);
  let uv = (vec2f(f32(cell % columns), f32(cell / columns)) + corners[index % 6u]) / layer.segments;
  return Vertex(vertex(uv), uv, 1.0);
}

@fragment fn mapMain(in: Vertex) -> @location(0) vec4f {
  return vec4f(in.uv, 0.0, 1.0);
}
`

/**
 * Halves a texture into its next mipmap.
 */
const mipShader = `
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f }
@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> Vertex {
  let p = vec2f(f32(index & 1u), f32(index >> 1u)) * 2.0;
  return Vertex(vec4f(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0), p);
}
@fragment fn fragmentMain(in: Vertex) -> @location(0) vec4f {
  return textureSampleLevel(source, sourceSampler, in.uv, 0.0);
}
`

export const mapFormat = "rg32float"

const uniformsBinding = `@group(1) @binding(0) var<uniform> uniforms: Uniforms;\n`

const defaultShader = `fn effect(uv: vec2f) -> vec4f { return element(uv); }`

/**
 * Covers the scissor rect with the motion blur buffer.
 */
const copyShader = `
@group(0) @binding(0) var source: texture_2d<f32>;
@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  return vec4f(f32(index & 1u) * 4.0 - 1.0, f32(index >> 1u) * 4.0 - 1.0, 0.0, 1.0);
}
@fragment fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  return textureLoad(source, vec2i(position.xy), 0);
}
`

/**
 * Bytes per instance: the three columns of its matrix and an alpha.
 */
export const instanceSize = 40

const instanceLayout = {
    arrayStride: instanceSize,
    stepMode: "instance",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x3" },
        { shaderLocation: 3, offset: 36, format: "float32" },
    ],
}

const premultiplied = {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
}
const additive = { srcFactor: "one", dstFactor: "one" }

export const blurFormat = "rgba16float"

export interface Program {
    /**
     * Draws to the canvas.
     */
    main: GPU
    /**
     * Adds to the motion blur buffer.
     */
    blur: GPU
    /**
     * For a shader with a vertex function: draws its mesh to the canvas,
     * and the uv of each of its pixels to the hit map.
     */
    surface?: GPU
    map?: GPU
    uniforms?: UniformLayout
    /**
     * Whether the shader reads `layer.time`, so needs drawing every frame.
     */
    usesTime: boolean
    /**
     * `undefined` until the device has compiled the shader.
     */
    isValid?: boolean
}

export interface Renderer {
    device: GPU
    format: string
    elementLayout: GPU
    uniformsLayout: GPU
    sampler: GPU
    copy: GPU
    copyLayout: GPU
    mip: GPU
    mipLayout: GPU
    program(shader?: string): Program
}

export function createRenderer(device: GPU, onChange: VoidFunction): Renderer {
    const format = (navigator as GPU).gpu.getPreferredCanvasFormat()
    const fragment = 2 // GPUShaderStage.FRAGMENT
    const both = 3

    const elementLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: both, buffer: {} },
            { binding: 1, visibility: fragment, texture: {} },
            { binding: 2, visibility: fragment, sampler: {} },
        ],
    })
    const uniformsLayout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: both, buffer: {} }],
    })
    const copyLayout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: fragment, texture: {} }],
    })

    const mipLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: fragment, texture: {} },
            { binding: 1, visibility: fragment, sampler: {} },
        ],
    })

    const pipeline = (
        module: GPU,
        layouts: GPU[],
        targetFormat: string,
        blend?: object,
        buffers?: object[],
        vertexEntry = "vertexMain",
        fragmentEntry = "fragmentMain"
    ) =>
        device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: layouts }),
            vertex: { module, entryPoint: vertexEntry, buffers },
            fragment: {
                module,
                entryPoint: fragmentEntry,
                targets: [
                    {
                        format: targetFormat,
                        blend: blend && { color: blend, alpha: blend },
                    },
                ],
            },
            primitive: {
                topology: buffers ? "triangle-strip" : "triangle-list",
            },
        })

    const programs = new Map<string, Program>()

    const program = (shader = defaultShader) => {
        let compiled = programs.get(shader)
        if (compiled) return compiled

        const uniforms = parseUniforms(shader)
        const layouts = uniforms
            ? [elementLayout, uniformsLayout]
            : [elementLayout]

        const hasVertex = /\bfn\s+vertex\s*\(/.test(shader)

        device.pushErrorScope("validation")
        const module = device.createShaderModule({
            code:
                prelude +
                (uniforms ? uniformsBinding : "") +
                shader +
                // A shader can be a vertex function alone
                (/\bfn\s+effect\s*\(/.test(shader) ? "" : defaultShader) +
                (hasVertex ? surface : ""),
        })
        compiled = {
            surface:
                hasVertex &&
                pipeline(
                    module,
                    layouts,
                    format,
                    premultiplied,
                    undefined,
                    "surfaceMain"
                ),
            map:
                hasVertex &&
                pipeline(
                    module,
                    layouts,
                    mapFormat,
                    undefined,
                    undefined,
                    "surfaceMain",
                    "mapMain"
                ),
            main: pipeline(module, layouts, format, premultiplied, [
                instanceLayout,
            ]),
            blur: pipeline(module, layouts, blurFormat, additive, [
                instanceLayout,
            ]),
            uniforms,
            usesTime: /\blayer\s*\.\s*time\b/.test(shader),
        }
        programs.set(shader, compiled)

        const result = compiled
        device.popErrorScope().then((error: GPU) => {
            result.isValid = !error
            if (error && typeof console !== "undefined") {
                console.warn(
                    `motion/fx: A shader failed, so its elements are drawn without it. ${error.message}`
                )
            }
            onChange()
        })

        return compiled
    }

    // The default shader is known to be good
    program().isValid = true

    return {
        device,
        format,
        elementLayout,
        uniformsLayout,
        copyLayout,
        mipLayout,
        sampler: device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            maxAnisotropy: 8,
        }),
        copy: pipeline(
            device.createShaderModule({ code: copyShader }),
            [copyLayout],
            format,
            premultiplied
        ),
        mip: pipeline(
            device.createShaderModule({ code: mipShader }),
            [mipLayout],
            format
        ),
        program,
    }
}
