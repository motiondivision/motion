import {
    AnimationOptions,
    pipe,
    scroll,
    spring,
    useAnimate,
    useAnimateMini,
} from "framer-motion"
import * as React from "react"
import { useEffect } from "react"

function scrollAnimate(
    scope: React.RefObject<HTMLDivElement>,
    animate: any,
    options?: AnimationOptions
) {
    if (!scope.current) return () => {}

    return scroll(
        animate(
            scope.current,
            { transform: ["translate(0px)", "translateX(100px)"] },
            options
        )
    )
}

export const App = () => {
    const [scopeDefault, miniAnimateDefault] = useAnimateMini()
    const [scopeEaseOut, miniAnimateEaseOut] = useAnimateMini()
    const [scopeSpring, miniAnimateSpring] = useAnimateMini()
    const [scopeAnimateDefault, animateDefault] = useAnimate()
    const [scopeAnimateEaseOut, animateEaseOut] = useAnimate()
    const [scopeAnimateSpring, animateSpring] = useAnimate()
    const [scopeAnimateMainThreadDefault, animateMainThreadDefault] =
        useAnimate()
    const [scopeAnimateMainThreadEaseOut, animateMainThreadEaseOut] =
        useAnimate()
    const [scopeAnimateMainThreadSpring, animateMainThreadSpring] = useAnimate()

    useEffect(() => {
        return pipe(
            scrollAnimate(scopeDefault, miniAnimateDefault),
            scrollAnimate(scopeEaseOut, miniAnimateEaseOut, {
                ease: "easeOut",
            }),
            scrollAnimate(scopeSpring, miniAnimateSpring, { type: spring }),
            scrollAnimate(scopeAnimateDefault, animateDefault),
            scrollAnimate(scopeAnimateEaseOut, animateEaseOut, {
                ease: "easeOut",
            }),
            scrollAnimate(scopeAnimateSpring, animateSpring, { type: spring }),
            scrollAnimate(
                scopeAnimateMainThreadDefault,
                animateMainThreadDefault,
                {
                    repeatDelay: 0.0001,
                }
            ),
            scrollAnimate(
                scopeAnimateMainThreadEaseOut,
                animateMainThreadEaseOut,
                {
                    ease: "easeOut",
                    repeatDelay: 0.0001,
                }
            ),
            scrollAnimate(
                scopeAnimateMainThreadSpring,
                animateMainThreadSpring,
                {
                    type: spring,
                    repeatDelay: 0.0001,
                }
            )
        ) as () => void
    }, [])

    return (
        <div style={containerStyle}>
            <div style={scrollContainer}>
                <div ref={scopeDefault} style={progressStyle}>
                    mini - default
                </div>
                <div ref={scopeEaseOut} style={progressStyle}>
                    mini - easeOut
                </div>
                <div ref={scopeSpring} style={progressStyle}>
                    mini - spring
                </div>
                <div ref={scopeAnimateDefault} style={progressStyle}>
                    animate - default
                </div>
                <div ref={scopeAnimateEaseOut} style={progressStyle}>
                    animate - easeOut
                </div>
                <div ref={scopeAnimateSpring} style={progressStyle}>
                    animate - spring
                </div>
                <div ref={scopeAnimateMainThreadDefault} style={progressStyle}>
                    animate main thread - default
                </div>
                <div ref={scopeAnimateMainThreadEaseOut} style={progressStyle}>
                    animate main thread - easeOut
                </div>
                <div ref={scopeAnimateMainThreadSpring} style={progressStyle}>
                    animate main thread - spring
                </div>
            </div>
        </div>
    )
}

const containerStyle: React.CSSProperties = {
    height: "500vh",
}

const scrollContainer: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
}

const progressStyle: React.CSSProperties = {
    width: 100,
    height: 100,
    backgroundColor: "white",
    color: "black",
}
