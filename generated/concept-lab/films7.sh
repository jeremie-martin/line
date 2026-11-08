#!/bin/bash
# R20 themes demo: the twelve themes on Circus Minimus (6 at a time), written by the production writer. Existing films are kept.
cd /home/holo/prog/line-side-task
mkdir -p generated/concept-lab/films7
printf '%s\n' paper hokusai dune prussian celadon aubergine wisteria black plum oldrose ultramarine aconite | while read t; do [ -f generated/concept-lab/films7/circus-$t.mp4 ] || echo $t; done |
  xargs -P 6 -I{} bash -c 'node generated/concept-lab/film.mjs song=circus c={} out=generated/concept-lab/films7/circus-{}.mp4 > generated/concept-lab/films7/circus-{}.log 2>&1 && echo done {} || echo FAILED {}'
