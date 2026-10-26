/**
 * Just enough of React Native and Reanimated to run motion components in
 * jsdom. "UI thread" functions run on the JS thread, with jsdom's
 * requestAnimationFrame as the UI thread's frame loop.
 */
import { forwardRef, useRef } from "react"

const flatten = (style: any): any =>
    Array.isArray(style)
        ? Object.assign({}, ...style.map(flatten))
        : style && typeof style === "object" && "evaluate" in style
        ? style.evaluate()
        : style

/**
 * The latest style of each rendered host, by testID, with animated styles
 * evaluated now.
 */
const hosts = new Map<string, any>()
export const getStyle = (testID: string) => flatten(hosts.get(testID))

const createHost = (name: string) =>
    forwardRef((props: any, ref: any) => {
        const { style, testID, children, ...rest } = props
        hosts.set(testID, style)
        const handlers: any = {}
        for (const key in rest) {
            if (key.startsWith("onTouch")) handlers[key] = rest[key]
        }
        return (
            <div ref={ref} data-testid={testID} data-native={name} {...handlers}>
                {children}
            </div>
        )
    })

export const reactNative = {
    View: createHost("View"),
    Text: createHost("Text"),
    Image: createHost("Image"),
    ScrollView: createHost("ScrollView"),
    StyleSheet: { flatten },
    AccessibilityInfo: {
        isReduceMotionEnabled: () => Promise.resolve(false),
        addEventListener: () => ({ remove() {} }),
    },
}

const makeMutable = (initial: any) => {
    const sv = {
        value: initial,
        modify(modifier: (value: any) => any) {
            sv.value = modifier(sv.value)
        },
    }
    return sv
}

export const reanimated = {
    __esModule: true,
    default: {
        View: reactNative.View,
        Text: reactNative.Text,
        Image: reactNative.Image,
        ScrollView: reactNative.ScrollView,
        createAnimatedComponent: () => createHost("Custom"),
    },
    runOnUI: (fn: Function) => fn,
    runOnJS: (fn: Function) => fn,
    useSharedValue: (initial: any) => {
        const ref = useRef<any>(null)
        if (!ref.current) ref.current = makeMutable(initial)
        return ref.current
    },
    useAnimatedStyle: (updater: () => any) => ({ evaluate: updater }),
}
