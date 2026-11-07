#!/bin/bash
# Round-6 films on the recompiled rides (6 at a time). Existing files are kept. Each job: song name preset mix(- for none).
cd /home/holo/prog/line-side-task
mkdir -p generated/concept-lab/films6
jobs=()
for s in tomada los; do for h in strong shake impact todayW; do jobs+=("$s h-$h paper hit:$h"); done; done
for s in los petrunko; do jobs+=("$s p-tamed paper -" "$s p-high paper place:high" "$s p-follow paper place:follow" "$s p-follow-grain paper place:follow,grain:on"); done
for c in slate mauve sumi bauhaus risoDeep lagoon plum; do jobs+=("lua c-$c swatch scheme:$c"); done
jobs+=("lua c-olive swatch scheme:olive,top:sun")
jobs+=("petrunko d-paper paper -" "petrunko d-hokusai swatch scheme:hokusai,top:sun,night:switch" "petrunko d-dune swatch scheme:dune,top:sun,night:switch" "petrunko d-lagoon swatch scheme:lagoon,night:switch")
for b in redbars red iris bars3; do jobs+=("petrunko b-$b paper music:$b"); done
todo=(); for j in "${jobs[@]}"; do set -- $j; [ -f generated/concept-lab/films6/$1-$2.mp4 ] || todo+=("$j"); done
printf '%s\n' "${todo[@]}" | xargs -P 6 -L 1 bash -c 'm=$3; [ "$m" = - ] && m=; /usr/bin/node generated/concept-lab/render.mjs song=$0 c=$2 ${m:+m=$m} out=generated/concept-lab/films6/$0-$1.mp4.part > generated/concept-lab/films6/$0-$1.log 2>&1 && mv generated/concept-lab/films6/$0-$1.mp4.part generated/concept-lab/films6/$0-$1.mp4 && echo done $0 $1 || echo FAILED $0 $1'
