#!/bin/bash
# R20 themes demo: the twelve themes on Circus Minimus (6 at a time). Existing files are kept.
cd /home/holo/prog/line-side-task
mkdir -p generated/concept-lab/films7
printf '%s\n' paper hokusai dune prussian celadon aubergine wisteria black plum oldrose ultramarine aconite | while read t; do [ -f generated/concept-lab/films7/circus-$t.mp4 ] || echo $t; done |
  xargs -P 6 -I{} bash -c '/usr/bin/node generated/concept-lab/render.mjs song=circus c=t-{} out=generated/concept-lab/films7/circus-{}.mp4.part > generated/concept-lab/films7/circus-{}.log 2>&1 && mv generated/concept-lab/films7/circus-{}.mp4.part generated/concept-lab/films7/circus-{}.mp4 && echo done {} || echo FAILED {}'
