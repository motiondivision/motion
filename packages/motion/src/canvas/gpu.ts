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
 * element: a 2D affine matrix in CSS pixels and an alpha.
 */
const prelude = `
struct Layer { size: vec2f, canvas: vec2f, time: f32 }
@group(0) @binding(0) var<uniform> layer: Layer;
@group(0) @binding(1) var elementTexture: texture_2d<f32>;
@group(0) @binding(2) var elementSampler: sampler;

struct Vertex {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) alpha: f32,
}

fn element(uv: vec2f) -> vec4f {
  return textureSampleLevel(elementTexture, elementSampler, uv, 0.0);
}

@vertex fn vertexMain(
  @builtin(vertex_index) index: u32,
  @location(0) matrix: vec4f,
  @location(1) offset: vec2f,
  @location(2) alpha: f32,
) -> Vertex {
  let uv = vec2f(f32(index & 1u), f32(index >> 1u));
  let p = mat2x2f(matrix.xy, matrix.zw) * (uv * layer.size) + offset;
  return Vertex(
    vec4f(p.x / layer.canvas.x * 2.0 - 1.0, 1.0 - p.y / layer.canvas.y * 2.0, 0.0, 1.0),
    uv,
    alpha,
  );
}

@fragment fn fragmentMain(in: Vertex) -> @location(0) vec4f {
  return effect(in.uv) * in.alpha;
}
`

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
 * Bytes per instance: matrix (4 floats), offset (2) and alpha (1).
 */
export const instanceSize = 28

const instanceLayout = {
    arrayStride: instanceSize,
    stepMode: "instance",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x4" },
        { shaderLocation: 1, offset: 16, format: "float32x2" },
        { shaderLocation: 2, offset: 24, format: "float32" },
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

    const pipeline = (
        module: GPU,
        layouts: GPU[],
        targetFormat: string,
        blend: object,
        buffers?: object[]
    ) =>
        device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: layouts }),
            vertex: { module, entryPoint: "vertexMain", buffers },
            fragment: {
                module,
                entryPoint: "fragmentMain",
                targets: [
                    {
                        format: targetFormat,
                        blend: { color: blend, alpha: blend },
                    },
                ],
            },
            primitive: { topology: "triangle-strip" },
        })

    const programs = new Map<string, Program>()

    const program = (shader = defaultShader) => {
        let compiled = programs.get(shader)
        if (compiled) return compiled

        const uniforms = parseUniforms(shader)
        const layouts = uniforms
            ? [elementLayout, uniformsLayout]
            : [elementLayout]

        device.pushErrorScope("validation")
        const module = device.createShaderModule({
            code: prelude + (uniforms ? uniformsBinding : "") + shader,
        })
        compiled = {
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
                    `motion/canvas: A shader failed, so its elements are drawn without it. ${error.message}`
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
        sampler: device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        }),
        copy: pipeline(
            device.createShaderModule({ code: copyShader }),
            [copyLayout],
            format,
            premultiplied
        ),
        program,
    }
}
