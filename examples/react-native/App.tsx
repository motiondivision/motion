import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { AnimatePresence, motion, stagger } from "motion/react-native"

/**
 * Each demo animates a value Motion owns, so it plays on the UI thread.
 * Press "Block JS thread" to busy the JS thread for two seconds: these keep
 * moving, and the onUpdate box (which runs in JS) freezes.
 */
export function App() {
    return (
        <ScrollView contentContainerStyle={styles.page}>
            <Text style={styles.title}>Motion for React Native</Text>
            <BlockJS />
            <Demo label="Spring entrance">
                <motion.View
                    style={styles.box}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", bounce: 0.4 }}
                />
            </Demo>
            <Toggle />
            <Demo label="whileTap">
                <motion.View
                    style={styles.box}
                    whileTap={{ scale: 0.8, backgroundColor: "#ff0088" }}
                />
            </Demo>
            <Loader />
            <Stagger />
            <PresenceList />
            <Demo label="onUpdate (runs in JS, freezes when blocked)">
                <motion.View
                    style={styles.box}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    onUpdate={() => {}}
                />
            </Demo>
        </ScrollView>
    )
}

function Demo({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View style={styles.demo}>
            <Text style={styles.label}>{label}</Text>
            {children}
        </View>
    )
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <Pressable style={styles.button} onPress={onPress}>
            <Text style={styles.buttonText}>{label}</Text>
        </Pressable>
    )
}

function BlockJS() {
    return (
        <Button
            label="Block JS thread for 2s"
            onPress={() => {
                const end = Date.now() + 2000
                while (Date.now() < end) {}
            }}
        />
    )
}

function Toggle() {
    const [on, setOn] = useState(false)

    return (
        <Demo label="Toggle (tap fast to interrupt)">
            <motion.View
                style={styles.box}
                animate={{ x: on ? 200 : 0, rotate: on ? 180 : 0 }}
                transition={{ type: "spring", visualDuration: 0.6, bounce: 0.3 }}
            />
            <Button label="Toggle" onPress={() => setOn(!on)} />
        </Demo>
    )
}

function Loader() {
    return (
        <Demo label="Infinite loop">
            <motion.View
                style={[styles.box, styles.loader]}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
        </Demo>
    )
}

const list = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { delayChildren: stagger(0.1) } },
}

const item = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
}

function Stagger() {
    const [count, setCount] = useState(0)

    return (
        <Demo label="Variants + stagger">
            <motion.View
                key={count}
                style={styles.row}
                variants={list}
                initial="hidden"
                animate="visible"
            >
                {[0, 1, 2, 3].map((i) => (
                    <motion.View key={i} style={styles.dot} variants={item} />
                ))}
            </motion.View>
            <Button label="Replay" onPress={() => setCount(count + 1)} />
        </Demo>
    )
}

function PresenceList() {
    const [items, setItems] = useState([0, 1, 2])

    return (
        <Demo label="AnimatePresence">
            <View style={styles.row}>
                <AnimatePresence>
                    {items.map((id) => (
                        <motion.View
                            key={id}
                            style={styles.dot}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                        />
                    ))}
                </AnimatePresence>
            </View>
            <View style={styles.row}>
                <Button
                    label="Add"
                    onPress={() =>
                        setItems([...items, (items[items.length - 1] ?? -1) + 1])
                    }
                />
                <Button label="Remove" onPress={() => setItems(items.slice(0, -1))} />
            </View>
        </Demo>
    )
}

const styles = StyleSheet.create({
    page: { padding: 24, paddingTop: 80, gap: 32 },
    title: { fontSize: 24, fontWeight: "700" },
    demo: { gap: 12 },
    label: { fontSize: 14, color: "#666" },
    box: { width: 80, height: 80, borderRadius: 16, backgroundColor: "#8df0cc" },
    loader: { width: 40, height: 40, borderRadius: 8 },
    row: { flexDirection: "row", gap: 12 },
    dot: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#0d63f8" },
    button: {
        alignSelf: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: "#111",
    },
    buttonText: { color: "#fff", fontWeight: "600" },
})
