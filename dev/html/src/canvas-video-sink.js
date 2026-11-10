/**
 * An encoder for renderVideo(), built on mediabunny. motion/fx has no
 * muxer of its own: renderVideo() hands each frame to an onFrame callback,
 * and this one encodes the canvas with a mediabunny CanvasSource.
 *
 *   const sink = await createVideoSink(layer.canvas, { fps: 60 })
 *   await renderVideo(layer, timeline, { fps: 60, onFrame: sink.onFrame })
 *   const blob = await sink.finalize()
 */
import {
    ALL_FORMATS,
    BufferSource,
    BufferTarget,
    CanvasSource,
    EncodedPacketSink,
    getFirstEncodableVideoCodec,
    Input,
    Mp4OutputFormat,
    Output,
    QUALITY_HIGH,
    WebMOutputFormat,
} from "mediabunny"

export async function createVideoSink(canvas, { fps = 60 } = {}) {
    const { width, height } = canvas
    const codec = await getFirstEncodableVideoCodec(["avc", "vp9", "vp8"], {
        width,
        height,
    })
    if (!codec) throw new Error("This browser can't encode video.")

    const isMp4 = codec === "avc"
    const output = new Output({
        format: isMp4 ? new Mp4OutputFormat() : new WebMOutputFormat(),
        target: new BufferTarget(),
    })
    const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH })
    output.addVideoTrack(source, { frameRate: fps })
    await output.start()

    return {
        codec,
        /**
         * CanvasSource captures the canvas as add() is called, which
         * renderVideo() does inside the frame's paint.
         */
        onFrame: (_canvas, timestamp, duration) =>
            source.add(timestamp, duration),
        finalize: async () => {
            await output.finalize()
            return new Blob([output.target.buffer], {
                type: isMp4 ? "video/mp4" : "video/webm",
            })
        },
    }
}

/**
 * Read back an encoded video's packet timestamps, to check an export.
 */
export async function readVideoTimestamps(blob) {
    const input = new Input({
        formats: ALL_FORMATS,
        source: new BufferSource(await blob.arrayBuffer()),
    })
    const track = await input.getPrimaryVideoTrack()
    const timestamps = []
    for await (const packet of new EncodedPacketSink(track).packets()) {
        timestamps.push(packet.timestamp)
    }
    return { codec: track.codec, timestamps: timestamps.sort((a, b) => a - b) }
}
