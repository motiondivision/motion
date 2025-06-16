import { StrictMode } from "react"

const examples = import.meta.glob("../../react/src/examples/*.tsx", {
    eager: true,
    import: "App",
})
const tests = import.meta.glob("../../react/src/tests/*.tsx", {
    eager: true,
    import: "App",
})

function App() {
    const url = new URL(window.location.href)
    const exampleId = url.searchParams.get("example")
    const testId = url.searchParams.get("test")

    const Module = exampleId
        ? examples[`../../react/src/examples/${exampleId}.tsx`]
        : testId
        ? tests[`../../react/src/tests/${testId}.tsx`]
        : null

    if (Module) {
        return (
            <StrictMode>
                <Module />
            </StrictMode>
        )
    } else {
        return <ExampleList />
    }
}

const ExampleList = () => {
    return (
        <div>
            <h2>Motion Playground</h2>
            <p>
                You can edit any of these in the{" "}
                <code>dev/react/src/examples</code>
                folder.
            </p>
            <ul>
                {Object.keys(examples).map((name: string) => {
                    const segments = name.split("/")
                    const filename = segments[segments.length - 1].replace(
                        /\.tsx$/,
                        ""
                    )
                    return (
                        <li key={filename}>
                            <a href={`?example=${filename}`}>{filename}</a>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

export default App
