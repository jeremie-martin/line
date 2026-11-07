#!/bin/bash
# Round-3 films (6 at a time). Existing files are kept.
cd /home/holo/prog/line-side-task
mkdir -p generated/concept-lab/films3
jobs=()
for song in petrunko lua los; do for c in ride plus scarf ridge night shade; do jobs+=("$song $c"); done; done
for song in batidao burn coma; do for c in scarf ride; do jobs+=("$song $c"); done; done
todo=(); for j in "${jobs[@]}"; do set -- $j; [ -f generated/concept-lab/films3/$1-$2.mp4 ] || todo+=("$j"); done
printf '%s\n' "${todo[@]}" | xargs -P 6 -L 1 bash -c 'node generated/concept-lab/render.mjs song=$0 c=$1 out=generated/concept-lab/films3/$0-$1.mp4 > generated/concept-lab/films3/$0-$1.log 2>&1 && echo done $0 $1 || echo FAILED $0 $1'
