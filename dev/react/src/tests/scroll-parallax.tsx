import { animate, scroll } from "framer-motion"
import * as React from "react"

export const App = () => {
    React.useEffect(() => {
        const distance = 400
        document.querySelectorAll(".img-container").forEach((section) => {
            const mainThreadSentinel = section.querySelector(
                ".sentinel.main-thread"
            )
            const waapiSentinel = section.querySelector(".sentinel.waapi")
            const miniSentinel = section.querySelector(".sentinel.mini")

            if (!mainThreadSentinel || !waapiSentinel || !miniSentinel) return

            scroll(
                animate(mainThreadSentinel, {
                    y: [-distance, distance],
                }),
                { target: mainThreadSentinel }
            )

            scroll(
                animate(waapiSentinel, {
                    transform: [
                        `translateY(-${distance}px)`,
                        `translateY(${distance}px)`,
                    ],
                }),
                { target: waapiSentinel }
            )

            scroll(
                animate(miniSentinel, {
                    transform: [
                        `translateY(-${distance}px)`,
                        `translateY(${distance}px)`,
                    ],
                }),
                { target: miniSentinel }
            )
        })
    }, [])

    return (
        <>
            <section className="img-container">
                <div>
                    <div className="img-placeholder" />
                    <div className="main-thread sentinel" />
                    <div className="waapi sentinel" />
                    <div className="mini sentinel" />
                </div>
            </section>
            <section className="img-container">
                <div>
                    <div className="img-placeholder" />
                    <div className="main-thread sentinel" />
                    <div className="waapi sentinel" />
                    <div className="mini sentinel" />
                </div>
            </section>
            <section className="img-container">
                <div>
                    <div className="img-placeholder" />
                    <div className="main-thread sentinel" />
                    <div className="waapi sentinel" />
                    <div className="mini sentinel" />
                </div>
            </section>
            <section className="img-container">
                <div>
                    <div className="img-placeholder" />
                    <div className="main-thread sentinel" />
                    <div className="waapi sentinel" />
                    <div className="mini sentinel" />
                </div>
            </section>
            <section className="img-container">
                <div>
                    <div className="img-placeholder" />
                    <div className="main-thread sentinel" />
                    <div className="waapi sentinel" />
                    <div className="mini sentinel" />
                </div>
            </section>
            <StyleSheet />
        </>
    )
}

function StyleSheet() {
    return (
        <style>{`
      html {
        scroll-snap-type: y mandatory;
    }

    .img-container {
        height: 100vh;
        scroll-snap-align: start;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
    }

    .img-container > div {
        width: 300px;
        height: 400px;
        margin: 20px;
        background: var(--white);
        overflow: hidden;
    }

    .img-container .img-placeholder {
        width: 300px;
        height: 400px;
        background-color: #000;
    }

    .img-container .sentinel {
        position: absolute;
        top: calc(50% - 50px);
        left: 50%;
        width: 100px;
        height: 100px;
        background-color: blue;
    }

    .waapi.sentinel {
       background-color: red;
    }

    .mini.sentinel {
        background-color: green;
    }

    .progress {
        position: fixed;
        left: 0;
        right: 0;
        height: 5px;
        background: var(--accent);
        bottom: 50px;
        transform: scaleX(0);
    }
  `}</style>
    )
}
