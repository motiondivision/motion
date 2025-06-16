import React from "react"
import ReactDOMClient from "react-dom/client"
import App from "./App.tsx"
import "./index.css"

ReactDOMClient.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
