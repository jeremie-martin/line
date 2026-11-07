#!/bin/bash
cd /home/holo/prog/line-side-task/generated/concept-lab
mkdir -p fourup/r4 fourup/r5; mv fourup/*.mp4 fourup/r4/ 2>/dev/null
{ for s in los petrunko lua batidao burn coma tomada; do echo "$s fourup/r5/$s.mp4 paper hokusai lagoon black"; done
  for s in los petrunko lua; do echo "$s fourup/r5/$s-colours.mp4 lagoon riso dune plum"; done; } | xargs -P 2 -L 1 ./fourup.sh
