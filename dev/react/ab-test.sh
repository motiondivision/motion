#!/bin/bash
# Interleaved A/B benchmark: alternates baseline (session optimizations
# stashed) and optimized builds per run so machine drift cancels out.
# Results: label, totalSampledJSms, projectionAttributedJSms
set -e
cd /Users/matt/.cursor/worktrees/motion/9c2b
FILES="packages/motion-dom/src/effects/style/render.ts packages/motion-dom/src/frameloop/render-step.ts packages/motion-dom/src/projection packages/motion-dom/src/render/html/HTMLVisualElement.ts packages/motion-dom/src/render/VisualElement.ts"
unset PLAYWRIGHT_BROWSERS_PATH

run_once () {
  label=$1
  yarn build > /dev/null 2>&1
  cd dev/react
  TEST_PORT=9990 yarn vite --port 9990 --strictPort --force > /tmp/vite-ab.log 2>&1 &
  VPID=$!
  npx wait-on -t 30000 http://localhost:9990 > /dev/null 2>&1
  sleep 2
  for r in a b; do
    node profile-layout.mjs layout-stress-transform 2400 9990 0 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s.slice(0,s.lastIndexOf('}')+1));console.log('$label'+'_$r', j.js.totalSampledMs, j.js.projectionAttributedMs)})" >> /tmp/ab-results.txt
  done
  pkill -P $VPID 2>/dev/null || true
  kill $VPID 2>/dev/null || true
  sleep 1
  cd ../..
}

rm -f /tmp/ab-results.txt
for i in 1 2 3 4 5; do
  git stash push -q -m ab -- $FILES
  run_once "BASE_$i"
  git stash pop -q
  run_once "OPT_$i"
done
echo "=== RESULTS ==="
cat /tmp/ab-results.txt
