#!/usr/bin/env bash
# Builds a local stand-in for Cloudflare from the real code, then starts it on http://localhost:8788
set -e
cd "$(dirname "$0")"
cp ../public/shared/game.js mock/game.js
sed "s#'cloudflare:workers'#'./cf-mock.js'#; s#'../public/shared/game.js'#'./game.js'#" ../src/worker.js > mock/worker.js
node server.mjs
