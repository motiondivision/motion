import { domMax3D, frame, LazyMotion, m } from "framer-motion"
import { layoutPlane } from "motion/three"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import * as THREE from "three"

/**
 * A React layoutId card and a three.js plane hand over to each other.
 * window.toggle() moves the card between the page and the scene.
 * Used by tests/react/layout-plane-react.spec.ts.
 */
function useScene(canvas: React.RefObject<HTMLCanvasElement>) {
    const [scene, setScene] = useState<any>()
    useLayoutEffect(() => {
        const element = canvas.current!
        const renderer = new THREE.WebGLRenderer({
            canvas: element,
            preserveDrawingBuffer: true,
        })
        renderer.setPixelRatio(1)
        renderer.setSize(element.clientWidth, element.clientHeight, false)
        const world = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(
            50,
            element.clientWidth / element.clientHeight,
            0.1,
            100
        )
        camera.position.set(0, 0, 6)
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 1.25),
            new THREE.MeshBasicMaterial({
                color: "#0088ff",
                side: THREE.DoubleSide,
            })
        )
        mesh.position.set(1, 0.3, 0)
        mesh.rotation.set(-0.3, 0.5, 0.1)
        world.add(mesh)
        const render = () => renderer.render(world, camera)
        frame.render(render, true)
        setScene({ camera, mesh })
        ;(window as any).scene = { camera, mesh, canvas: element }
        return () => renderer.dispose()
    }, [])
    return scene
}

function Plane({ scene, inScene, canvas }: any) {
    const plane = useRef<any>()

    useLayoutEffect(() => {
        plane.current = layoutPlane(scene.mesh, {
            layoutId: "card",
            camera: scene.camera,
            canvas: canvas.current,
            visible: inScene,
            transition: { duration: 10, ease: "linear" },
        })
        return () => plane.current.hide()
    }, [])

    useLayoutEffect(() => {
        inScene ? plane.current.show(true) : plane.current.hide(true)
    }, [inScene])

    return null
}

export const App = () => {
    const canvas = useRef<HTMLCanvasElement>(null)
    const scene = useScene(canvas)
    const params = new URLSearchParams(window.location.search)
    const [inScene, setInScene] = useState(params.has("scene"))

    useEffect(() => {
        ;(window as any).toggle = () => setInScene((v) => !v)
    }, [])

    return (
        <LazyMotion features={domMax3D}>
            <canvas
                ref={canvas}
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: 800,
                    height: 600,
                }}
            />
            {scene && <Plane scene={scene} inScene={inScene} canvas={canvas} />}
            {!inScene && (
                <m.div
                    id="card"
                    layoutId="card"
                    transition={{ duration: 10, ease: "linear" }}
                    style={{
                        position: "absolute",
                        left: 60,
                        top: 380,
                        width: 160,
                        height: 100,
                        background: "#00cc88",
                    }}
                />
            )}
        </LazyMotion>
    )
}
