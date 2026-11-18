#!/bin/bash
# Makes the dashboard's video of each spec given (productions/SONG/spec.ts or …/variants/NAME.ts), one after another, through
# the server's own endpoint (the same as the dashboard's "Make the video"). Prints one line per spec.
for spec in "$@"; do
  curl -s -X POST -H 'Content-Type: application/json' -d "{\"spec\":\"$spec\"}" http://10.77.77.1:8770/api/spec-video > /dev/null
  while :; do
    sleep 8; r=$(curl -s "http://10.77.77.1:8770/api/spec-video?spec=$spec")
    echo "$r" | grep -q '"phase":"\(compiling\|rendering\)"' || break
  done
  echo "$spec :: $(echo "$r" | grep -o '"current":[a-z]*\|"phase":"[a-z]*"\|"error":"[^"]*"' | tr '\n' ' ')"
done
