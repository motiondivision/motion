import { motionValue } from "motion-dom"
import { act, lazy, Suspense } from "react"
import { hydrateRoot } from "react-dom/client"
import { TextEncoder } from "util"
import { domAnimation, LazyMotion, m } from "../../.."

// react-dom/server's browser build needs TextEncoder, which JSDOM lacks
;(global as any).TextEncoder ??= TextEncoder
const { renderToString } = require("react-dom/server")

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((r) => (resolve = r))
    return { promise, resolve }
}

const Content = () => <p>Server content</p>

interface AppProps {
    features: () => Promise<typeof domAnimation>
    Thing: React.ComponentType
}

const App = ({ features, Thing }: AppProps) => (
    <LazyMotion features={features}>
        <section>
            <Suspense fallback="Loading">
                <Thing />
            </Suspense>
        </section>
    </LazyMotion>
)

describe("LazyMotion hydration", () => {
    let container: HTMLDivElement
    let errorSpy: jest.SpyInstance

    beforeEach(() => {
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
        container = document.createElement("div")
        document.body.appendChild(container)
        container.innerHTML = renderToString(
            <App
                features={() => Promise.resolve(domAnimation)}
                Thing={Content}
            />
        )
    })

    afterEach(() => {
        document.body.removeChild(container)
        errorSpy.mockRestore()
    })

    test.each([
        ["after", false],
        ["during", true],
    ])(
        "Async features resolving %s hydration keep the server HTML of a pending Suspense boundary",
        async (_, resolveEarly) => {
            const features = deferred<typeof domAnimation>()
            const chunk = deferred<{ default: React.ComponentType }>()
            const LazyThing = lazy(() => chunk.promise)

            if (resolveEarly) features.resolve(domAnimation)

            const onRecoverableError = jest.fn()
            await act(async () => {
                hydrateRoot(
                    container,
                    <App
                        features={() => features.promise}
                        Thing={LazyThing}
                    />,
                    { onRecoverableError }
                )
            })

            expect(container.textContent).toBe("Server content")

            // Features resolve while the boundary is still dehydrated
            await act(async () => {
                features.resolve(domAnimation)
                await features.promise
            })

            expect(container.textContent).toBe("Server content")

            await act(async () => {
                chunk.resolve({ default: Content })
                await chunk.promise
            })

            expect(container.textContent).toBe("Server content")
            expect(onRecoverableError).not.toHaveBeenCalled()
        }
    )

    test("m components inside a hydrated boundary animate once features load", async () => {
        const x = motionValue(0)
        const animated = deferred<void>()
        const Animated = () => (
            <m.p
                style={{ x }}
                animate={{ x: 20 }}
                transition={{ duration: 0.01 }}
                onAnimationComplete={() => animated.resolve()}
            >
                Server content
            </m.p>
        )

        const features = deferred<typeof domAnimation>()
        const chunk = deferred<{ default: React.ComponentType }>()
        const LazyThing = lazy(() => chunk.promise)

        await act(async () => {
            hydrateRoot(
                container,
                <App features={() => features.promise} Thing={LazyThing} />
            )
        })

        await act(async () => {
            features.resolve(domAnimation)
            await features.promise
        })

        await act(async () => {
            chunk.resolve({ default: Animated })
            await chunk.promise
        })

        await act(() => animated.promise)
        expect(x.get()).toBe(20)
        expect(container.textContent).toBe("Server content")
    })
})
