#!/bin/bash
# Recompile the lab's rides (rides.js SONGS: each song's seed, and its variant when not spec.ts) with the current compiler, into
# rides/<key>/; a ride already done is kept. Then prepare.mjs builds their scenes.
cd /home/holo/prog/line-side-task
export PATH=/usr/bin:$PATH
# one line per song: key, song, seed[, variant] (no trailing blank: xargs -L would join the next line to it)
node -e "import('./generated/concept-lab/rides.js').then(({SONGS}) => {for (const [key, s] of Object.entries(SONGS)) console.log([key, s.song, s.seed, s.variant].filter(Boolean).join(' '));})" |
  xargs -P 4 -L 1 bash -c 'dir="generated/concept-lab/rides/${0:?}"; [ -f "$dir/done" ] && exit 0; rm -rf -- "$dir"; node scripts/produce/automatic.ts --song=$1 --seed=$2 ${3:+--variant=$3} --out="$dir" > generated/concept-lab/rides-$0.log 2>&1 && touch "$dir/done" && echo done $0 || echo FAILED $0'
