#!/bin/bash
# Recompile the lab's rides (Circus Minimus uses its latest spec, voice-drums, not spec.ts's pairs3) with the current compiler (same songs and seeds as round 1–5), into rides/<key>/.
cd /home/holo/prog/line-side-task
export PATH=/usr/bin:$PATH
printf '%s\n' "petrunko petrunko_selection 202" "lua lua_na_praca_selection 101" "los los_voltaje_selection 202" "batidao no_batidao_selection 202" \
  "burn let_the_world_burn_selection 202" "coma montagem_coma_selection 202" "tomada montagem_tomada_super_slowed_selection 202" "circus circus_minimus_77s 101 voice-drums" |
  xargs -P 4 -L 1 bash -c '[ -f generated/concept-lab/rides/$0/done ] && exit 0; rm -rf generated/concept-lab/rides/$0; node scripts/produce/automatic.ts --song=$1 --seed=$2 ${3:+--variant=$3} --out=generated/concept-lab/rides/$0 > generated/concept-lab/rides-$0.log 2>&1 && touch generated/concept-lab/rides/$0/done && echo done $0 || echo FAILED $0'
