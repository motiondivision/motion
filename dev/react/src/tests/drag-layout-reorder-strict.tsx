import { motion, useMotionValue } from "framer-motion"
import { useState, memo } from "react"

/**
 * Reproduction for issue #3169:
 * Drag + layout + React 19 StrictMode + memoized components
 *
 * Simulates Ant Design Tree's memoization: FileItem is wrapped in
 * React.memo so it doesn't re-render when parent state changes.
 * When a folder expands during drag, new DOM nodes are inserted,
 * shifting the dragged file's layout. The projection system must
 * compensate even though the file's willUpdate() was never called.
 */

const FolderTitle = ({
    name,
    isHovered,
    isExpanded,
}: {
    name: string
    isHovered: boolean
    isExpanded: boolean
}) => {
    return (
        <motion.div
            layout
            data-testid={`folder-title-${name}`}
            style={{
                padding: "8px 10px",
                background: isHovered ? "#555" : "#333",
                color: "white",
            }}
        >
            {isExpanded ? "▼" : "▶"} {name}
        </motion.div>
    )
}

/**
 * Memoized file item — simulates rc-tree's internal memoization.
 * Prevents re-render when parent state changes, which is critical
 * to reproducing the bug: willUpdate() is never called, so the
 * projection system has no snapshot for this node.
 */
const FileItem = memo(({ name }: { name: string }) => {
    const y = useMotionValue(0)
    return (
        <motion.div
            data-testid={`file-${name}`}
            drag="y"
            layout
            dragMomentum={false}
            dragSnapToOrigin
            whileTap={{ scale: 1.05 }}
            style={{
                y,
                height: 35,
                background: "#0099ff",
                color: "white",
                display: "flex",
                alignItems: "center",
                padding: "0 20px",
                marginBottom: 2,
            }}
        >
            {name}
        </motion.div>
    )
})

const PlaceholderFile = ({ name }: { name: string }) => (
    <motion.div
        layout
        data-testid={`placeholder-${name}`}
        style={{
            height: 35,
            background: "#666",
            color: "white",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            marginBottom: 2,
        }}
    >
        {name}
    </motion.div>
)

export const App = () => {
    const [folderHoveredId, setFolderHoveredId] = useState<string | null>(null)
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
        () => new Set(["Folder2"])
    )

    // Expose to Cypress
    ;(window as any).hoverFolder = (name: string | null) => {
        setFolderHoveredId(name)
    }
    ;(window as any).expandFolder = (name: string) => {
        setExpandedFolders((prev) => new Set([...prev, name]))
    }
    ;(window as any).collapseFolder = (name: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev)
            next.delete(name)
            return next
        })
    }

    return (
        <div style={{ padding: 50, width: 300 }}>
            {/* Folder 1 — starts collapsed, expanding inserts content
                ABOVE the draggable files in Folder 2 */}
            <div style={{ marginBottom: 2 }}>
                <FolderTitle
                    name="Folder1"
                    isHovered={folderHoveredId === "Folder1"}
                    isExpanded={expandedFolders.has("Folder1")}
                />
                {expandedFolders.has("Folder1") && (
                    <>
                        <PlaceholderFile name="Existing1a" />
                        <PlaceholderFile name="Existing1b" />
                        <PlaceholderFile name="Existing1c" />
                    </>
                )}
            </div>

            {/* Folder 2 — starts expanded with draggable files */}
            <div style={{ marginBottom: 2 }}>
                <FolderTitle
                    name="Folder2"
                    isHovered={folderHoveredId === "Folder2"}
                    isExpanded={expandedFolders.has("Folder2")}
                />
                {expandedFolders.has("Folder2") && (
                    <>
                        <FileItem name="File1" />
                        <FileItem name="File2" />
                        <FileItem name="File3" />
                    </>
                )}
            </div>

            {/* Folder 3 — empty target */}
            <div style={{ marginBottom: 2 }}>
                <FolderTitle
                    name="Folder3"
                    isHovered={folderHoveredId === "Folder3"}
                    isExpanded={expandedFolders.has("Folder3")}
                />
            </div>

            <div
                id="result"
                data-hovered={folderHoveredId || ""}
                data-expanded={[...expandedFolders].join(",")}
            />
        </div>
    )
}
