#!/usr/bin/env bash
# Builds a local stand-in for Cloudflare from the real code, then starts it on http://localhost:8788
set -e
cd "$(dirname "$0")"
cp ../public/shared/game.js mock/game.js
cp ../public/shared/ludo.js mock/ludo.js
cp ../public/shared/poker.js mock/poker.js
cp ../public/shared/carrom.js mock/carrom.js
cp ../public/shared/ruthless.js mock/ruthless.js
sed "s#'cloudflare:workers'#'./cf-mock.js'#; s#'../public/shared/game.js'#'./game.js'#; s#'../public/shared/ludo.js'#'./ludo.js'#; s#'../public/shared/poker.js'#'./poker.js'#; s#'../public/shared/carrom.js'#'./carrom.js'#; s#'../public/shared/ruthless.js'#'./ruthless.js'#" ../src/worker.js > mock/worker.js
node server.mjs
