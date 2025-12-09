#!/bin/bash
set -e

# Get api project root absolute path
projRoot="$( cd -- "$(dirname "$0")/.." >/dev/null 2>&1 ; pwd -P )"

# Copy /src to /dist
mkdir -p "${projRoot}/dist"
cp -r $projRoot/src/* ${projRoot}/dist

# Overwrite version.js
pkgVersion="$(cat "$projRoot/package.json" | grep -Po '"version":.*?[^\\]",' | sed "s/\\s*\"version\": \"//" | sed "s/\",\\s*//")"
gitSha="$(git rev-parse --short HEAD)"
version="${pkgVersion}-${gitSha}"
echo "Building API version ${version}"
echo "exports.version = '${pkgVersion}-${gitSha}'" > $projRoot/dist/version.js
