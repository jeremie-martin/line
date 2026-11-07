#!/bin/bash
# Round-6 films (6 at a time). Existing files are kept. Each job: song name preset mix.
cd /home/holo/prog/line-side-task
mkdir -p generated/concept-lab/films6
jobs=()
for s in petrunko tomada los coma; do for h in strong punch recoil big; do jobs+=("$s h-$h paper hit:$h"); done; done
for s in los petrunko lua; do for p in tamed high dive official; do jobs+=("$s p-$p paper place:$p"); done; done
for s in los petrunko lua; do for c in paper hokusai lagoon black; do jobs+=("$s $c $c -"); done; done
todo=(); for j in "${jobs[@]}"; do set -- $j; [ -f generated/concept-lab/films6/$1-$2.mp4 ] || todo+=("$j"); done
printf '%s\n' "${todo[@]}" | xargs -P 6 -L 1 bash -c 'm=$3; [ "$m" = - ] && m=; /usr/bin/node generated/concept-lab/render.mjs song=$0 c=$2 ${m:+m=$m} out=generated/concept-lab/films6/$0-$1.mp4 > generated/concept-lab/films6/$0-$1.log 2>&1 && echo done $0 $1 || echo FAILED $0 $1'
