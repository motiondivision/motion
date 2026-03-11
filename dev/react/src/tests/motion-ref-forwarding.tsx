import { motion } from "framer-motion"
import { useRef, useState, useCallback } from "react"

/**
 * Test for ref forwarding behavior in motion components.
 * Tests:
 * 1. RefObject forwarding - ref.current should be set to the DOM element
 * 2. Callback ref forwarding - callback should be called with DOM element on mount, null on unmount
 * 3. Callback ref cleanup (React 19) - cleanup function should be called on unmount
 */
export const App = () => {
    const [mounted, setMounted] = useState(true)
    const [results, setResults] = useState({
        refObjectMounted: false,
        refObjectValue: "none",
        callbackRefMountCalled: false,
        callbackRefMountValue: "none",
        callbackRefUnmountCalled: false,
        callbackRefUnmountValue: "none",
        cleanupCalled: false,
    })

    // Test 1: RefObject
    const refObject = useRef<HTMLDivElement>(null)

    // Test 2: Callback ref
    const callbackRef = useCallback((instance: HTMLDivElement | null) => {
        if (instance) {
            setResults((prev) => ({
                ...prev,
                callbackRefMountCalled: true,
                callbackRefMountValue: instance.tagName,
            }))
            // Return cleanup function (React 19 feature)
            return () => {
                setResults((prev) => ({
                    ...prev,
                    cleanupCalled: true,
                }))
            }
        } else {
            setResults((prev) => ({
                ...prev,
                callbackRefUnmountCalled: true,
                callbackRefUnmountValue: "null",
            }))
        }
    }, [])

    // Check refObject after mount
    const checkRefObject = () => {
        setResults((prev) => ({
            ...prev,
            refObjectMounted: true,
            refObjectValue: refObject.current?.tagName || "null",
        }))
    }

    return (
        <div style={{ padding: 20 }}>
            <h2>Motion Ref Forwarding Test</h2>

            <button id="toggle" onClick={() => setMounted(!mounted)}>
                {mounted ? "Unmount" : "Mount"}
            </button>
            <button id="check-ref" onClick={checkRefObject}>
                Check RefObject
            </button>

            {mounted && (
                <>
                    <motion.div
                        id="ref-object-target"
                        ref={refObject}
                        style={{
                            width: 100,
                            height: 100,
                            background: "blue",
                            margin: 10,
                        }}
                    >
                        RefObject Target
                    </motion.div>

                    <motion.div
                        id="callback-ref-target"
                        ref={callbackRef}
                        style={{
                            width: 100,
                            height: 100,
                            background: "green",
                            margin: 10,
                        }}
                    >
                        Callback Ref Target
                    </motion.div>
                </>
            )}

            <div id="results" style={{ marginTop: 20, fontFamily: "monospace" }}>
                <div
                    id="ref-object-mounted"
                    data-value={results.refObjectMounted.toString()}
                >
                    refObject checked: {results.refObjectMounted.toString()}
                </div>
                <div id="ref-object-value" data-value={results.refObjectValue}>
                    refObject.current?.tagName: {results.refObjectValue}
                </div>
                <div
                    id="callback-mount-called"
                    data-value={results.callbackRefMountCalled.toString()}
                >
                    callback ref mount called:{" "}
                    {results.callbackRefMountCalled.toString()}
                </div>
                <div
                    id="callback-mount-value"
                    data-value={results.callbackRefMountValue}
                >
                    callback ref mount value: {results.callbackRefMountValue}
                </div>
                <div
                    id="callback-unmount-called"
                    data-value={results.callbackRefUnmountCalled.toString()}
                >
                    callback ref unmount called:{" "}
                    {results.callbackRefUnmountCalled.toString()}
                </div>
                <div
                    id="cleanup-called"
                    data-value={results.cleanupCalled.toString()}
                >
                    cleanup function called: {results.cleanupCalled.toString()}
                </div>
            </div>
        </div>
    )
}
