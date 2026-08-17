#!/bin/bash
# Runs the layout-related Cypress specs against a locally started Vite server.
set -e
cd /Users/matt/.cursor/worktrees/motion/9c2b/dev/react
unset ELECTRON_RUN_AS_NODE
export CYPRESS_CACHE_FOLDER="$HOME/Library/Caches/Cypress"

TEST_PORT=9990 yarn vite --port 9990 --strictPort --force > /tmp/vite-cy.log 2>&1 &
VPID=$!
trap "pkill -P $VPID 2>/dev/null; kill $VPID 2>/dev/null" EXIT
npx wait-on -t 30000 http://localhost:9990

cd ../../packages/framer-motion
npx cypress run --config baseUrl=http://localhost:9990,video=false --spec "$1"
