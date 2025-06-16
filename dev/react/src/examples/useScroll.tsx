import { useState, useRef } from "react"
import {
    mix,
    motion,
    useElementScroll,
    useSpring,
} from "framer-motion"

const randomInt = (min, max) => Math.round(mix(min, max, Math.random()))
const generateParagraphLength = () => randomInt(10, 40)
const generateWordLength = () => randomInt(20, 100)

// Randomly generate some paragraphs of word lengths
const paragraphs = Array.from(Array(40)).map(() => {
    return Array.from(Array(generateParagraphLength())).map(generateWordLength)
})

const Word = ({ width }) => <div className="word" style={{ width }} />

const Paragraph = ({ words }) => (
    <div className="paragraph">
        {words.map((width) => (
            <Word width={width} />
        ))}
    </div>
)

export const ContentPlaceholder = () => (
    <div className="content-placeholder">
        <div className="header">
            <Word width={75} />
            <Word width={245} />
            <Word width={120} />
        </div>
        {paragraphs.map((words) => (
            <Paragraph words={words} />
        ))}
    </div>
)

export const Example = () => {
    const [isComplete, setIsComplete] = useState(false)
    const containerRef = useRef(null)
    const { scrollYProgress } = useElementScroll(containerRef)
    // const yRange = useTransform(scrollYProgress, [0, 0.9], [0, 1])
    // const pathLength = useSpring(yRange, {
    //     stiffness: 100,
    //     damping: 30,
    //     restDelta: 0.001,
    // })

    // const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001,
        restSpeed: 0.001,
    })

    // return (
    //   <>
    //     <motion.div className="progress-bar" style={{ scaleX }} />
    //     <h1>
    //       <code>useScroll</code> with spring smoothing
    //     </h1>
    //     <LoremIpsum />
    //   </>
    // );

    // useEffect(() => yRange.on("change", (v) => setIsComplete(v >= 1)), [yRange])

    return (
        <div
            ref={containerRef}
            style={{
                overflow: "scroll",
                height: "50vh",
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
            }}
        >
            <motion.div
                style={{
                    left: 0,
                    position: "fixed",
                    width: "100%",
                    height: 10,
                    background: "white",
                    scaleX,
                    transformOrigin: "0% 0%",
                }}
            />
            <ContentPlaceholder />
            <svg className="progress-icon" viewBox="0 0 60 60">
                <motion.path
                    fill="none"
                    strokeWidth="5"
                    stroke="white"
                    strokeDasharray="0px 10000px"
                    d="M 0, 20 a 20, 20 0 1,0 40,0 a 20, 20 0 1,0 -40,0"
                    style={{
                        // pathLength,
                        rotate: 90,
                        translateX: 5,
                        translateY: 5,
                        scaleX: -1, // Reverse direction of line animation
                    }}
                />
                <motion.path
                    fill="none"
                    strokeWidth="5"
                    stroke="white"
                    d="M14,26 L 22,33 L 35,16"
                    initial={false}
                    strokeDasharray="0px 10000px"
                    animate={{ pathLength: isComplete ? 1 : 0 }}
                />
            </svg>
        </div>
    )
}

export const App = () => {
    return (
        <>
            <style>{`body {
  background: #7700ff;
  background-repeat: no-repeat;
  padding: 0;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.refresh {
  padding: 10px;
  position: absolute;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 10px;
  width: 20px;
  height: 20px;
  top: 10px;
  right: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.content-placeholder {
  max-width: 600px;
  margin-top: 100px;
  margin-bottom: 200px;
  padding: 20px;
}

.header {
  width: 100%;
  margin-bottom: 50px;
}

.header .word {
  height: 50px;
  margin-right: 12px;
}

.word {
  height: 18px;
  background: white;
  border-radius: 10px;
  display: inline-block;
  margin-bottom: 8px;
  margin-right: 8px;
  background: white;
  border-radius: 10px;
  display: inline-block;
}

.paragraph {
  margin-bottom: 40px;
}

.progress-icon {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 120px;
  height: 120px;
}

@media (max-width: 600px) {
  .content-placeholder {
    padding-left: 80px;
  }

  .progress-icon {
    width: 70px;
    height: 70px;
    left: 10px;
    top: 10px;
  }

  .header .word {
    height: 30px;
  }

  .word {
    height: 14px;
    margin-bottom: 5px;
    margin-right: 5px;
  }

  .paragraph {
    margin-bottom: 20px;
  }
}
`}</style>
            <div className="example-container">
                <Example />
            </div>
        </>
    )
}
