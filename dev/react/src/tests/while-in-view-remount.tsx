import { motion } from "framer-motion"
import { useRef, useState } from "react"

/**
 * Reproduces #3079: whileInView not triggering after soft navigation.
 * Tests several scenarios:
 * - Element already in viewport on mount
 * - Element remounting after unmount (soft navigation)
 * - Element with custom root ref
 */
export const App = () => {
    const [page, setPage] = useState<"home" | "projects">("home")

    return (
        <div>
            <nav>
                <button id="go-home" onClick={() => setPage("home")}>
                    Home
                </button>
                <button id="go-projects" onClick={() => setPage("projects")}>
                    Projects
                </button>
            </nav>
            {page === "home" && <HomePage />}
            {page === "projects" && <ProjectsPage />}
        </div>
    )
}

function HomePage() {
    return <div id="home-page">Home</div>
}

function ProjectsPage() {
    return (
        <div id="projects-page">
            <Card id="card1" />
            <Card id="card2" />
        </div>
    )
}

function Card({ id }: { id: string }) {
    const scrollRef = useRef<HTMLDivElement>(null)

    return (
        <article ref={scrollRef}>
            <motion.div
                id={id}
                data-in-view="false"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ root: scrollRef, once: true }}
                transition={{ duration: 0.01 }}
                onViewportEnter={() => {
                    const el = document.getElementById(id)
                    if (el) el.dataset.inView = "true"
                }}
                style={{ width: 100, height: 100, background: "red" }}
            />
        </article>
    )
}
