#!/bin/bash
# Render the concept films in parallel (6 at a time). Existing files are kept.
cd /home/holo/prog/line-side-task
jobs=()
for song in petrunko lua los; do for c in ride catch score iris sections together; do
  out=generated/concept-lab/films/$song-$c.mp4; [ -f "$out" ] || jobs+=("$song $c $out"); done; done
printf '%s\n' "${jobs[@]}" | xargs -P 6 -L 1 bash -c 'node generated/concept-lab/render.mjs song=$0 c=$1 out=$2 > generated/concept-lab/films/$0-$1.log 2>&1 && echo done $0 $1 || echo FAILED $0 $1'
