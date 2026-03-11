#!/usr/bin/env node

// Load environment variables from .env file
require("dotenv").config()

const fs = require("fs")
const path = require("path")

/**
 * Extract version from package.json
 */
function getVersion() {
    const packageJsonPath = path.join(
        __dirname,
        "..",
        "packages",
        "motion",
        "package.json"
    )

    if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`Package.json not found at ${packageJsonPath}`)
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
    return packageJson.version
}

/**
 * Extract changelog section for a specific version
 */
function getVersionChangelog(version) {
    const changelogPath = path.join(__dirname, "..", "CHANGELOG.md")

    if (!fs.existsSync(changelogPath)) {
        console.warn(`Changelog not found at ${changelogPath}`)
        return null
    }

    const changelogText = fs.readFileSync(changelogPath, "utf8")

    // Find the section for the requested version
    const versionHeader = `## [${version}]`
    const startIdx = changelogText.indexOf(versionHeader)

    if (startIdx === -1) {
        console.warn(`Version ${version} not found in changelog`)
        return null
    }

    const rest = changelogText.slice(startIdx)
    const nextHeaderIdx = rest.indexOf("## [", versionHeader.length)
    const section = nextHeaderIdx !== -1 ? rest.slice(0, nextHeaderIdx) : rest

    return section.trim()
}

/**
 * Send notification to Slack API
 */
async function notifySlack() {
    try {
        const version = getVersion()
        console.log(`📦 Version: ${version}`)

        // Skip if version includes "-" (not a main branch release)
        if (version.includes("-")) {
            console.log(
                `⏭️  Skipping Slack notification for pre-release version: ${version}`
            )
            return
        }

        const changelog = getVersionChangelog(version)
        if (!changelog) {
            console.warn(`⚠️  No changelog found for version ${version}`)
        }

        // Check for dev mode
        const isDev = process.env.NODE_ENV !== "production"
        const apiUrl =
            process.env.SLACK_UPDATE_API_URL ||
            (isDev
                ? "http://localhost:8787/slack/update"
                : "https://api.motion.dev/slack/update")
        const authToken =
            process.env.UPDATE_SECRET_TOKEN || (isDev ? "test" : null)

        if (!authToken) {
            throw new Error(
                "UPDATE_SECRET_TOKEN environment variable is not set (or NODE_ENV must be set to non-production for dev mode)"
            )
        }

        if (isDev) {
            console.log(`🔧 Dev mode: Using local API at ${apiUrl}`)
        }

        const payload = {
            type: "motion",
            version: version,
        }

        if (changelog) {
            payload.changelog = changelog
        }

        console.log(`📤 Sending notification to Slack...`)
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(payload),
        })

        const responseBody = await response.text()

        if (!response.ok) {
            throw new Error(
                `Slack API returned ${response.status}: ${responseBody}`
            )
        }

        const result = JSON.parse(responseBody)
        console.log(`✅ Successfully sent Slack notification`)
        console.log(`   Messages sent: ${result.messageSentCount}`)
        console.log(`   Message type: ${result.messageType}`)
    } catch (error) {
        console.error(`❌ Error sending Slack notification:`, error.message)
        process.exit(1)
    }
}

// Run the script
if (require.main === module) {
    notifySlack()
}

module.exports = { notifySlack }
