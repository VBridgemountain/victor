#!/bin/sh
# Startar V.I.C.T.O.R. Server på Linux. Kräver Node.js 18 eller nyare (t.ex. sudo apt install nodejs).
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo 'Node.js saknas. Installera det först, t.ex.: sudo apt install nodejs'; exit 1; }
exec node server.js "$@"
