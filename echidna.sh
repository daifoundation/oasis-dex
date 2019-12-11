#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

docker run -t -v `pwd`:/src trailofbits/echidna crytic-compile . && echidna-test /src/src/oasis.echidna.sol