import type { BenchmarkCase } from "./cases/case.ts";
import { materializedVariantCases } from "./variant_catalog.generated.ts";

import { benchmarkCase as riverReentryCase } from "./cases/normative/representative/river_reentry.ts";
import { benchmarkCase as countercurrentCase } from "./cases/normative/representative/countercurrent.ts";
import { benchmarkCase as splitSignalCase } from "./cases/normative/representative/split_signal.ts";
import { benchmarkCase as pickupLatticeCase } from "./cases/normative/representative/pickup_lattice.ts";
import { benchmarkCase as loosePocketCase } from "./cases/normative/representative/loose_pocket.ts";
import { benchmarkCase as offgridConversationCase } from "./cases/normative/representative/offgrid_conversation.ts";
import { benchmarkCase as risingSwitchCase } from "./cases/normative/representative/rising_switch.ts";
import { benchmarkCase as meterExchangeCase } from "./cases/normative/representative/meter_exchange.ts";
import { benchmarkCase as wideBreathsCase } from "./cases/normative/representative/wide_breaths.ts";
import { benchmarkCase as openHookCase } from "./cases/normative/representative/open_hook.ts";
import { benchmarkCase as amplitudeTidesCase } from "./cases/normative/representative/amplitude_tides.ts";
import { benchmarkCase as denseDialogueCase } from "./cases/normative/representative/dense_dialogue.ts";
import { benchmarkCase as highAirDriveCase } from "./cases/normative/representative/high_air_drive.ts";
import { benchmarkCase as sparseLowlineCase } from "./cases/normative/representative/sparse_lowline.ts";
import { benchmarkCase as pickupProgressionCase } from "./cases/normative/capability/frontier_pickup_progression.ts";
import { benchmarkCase as denseRecoveryCase } from "./cases/normative/capability/frontier_dense_recovery.ts";
import { benchmarkCase as lowAirEnduranceCase } from "./cases/normative/capability/frontier_low_air_endurance.ts";
import { benchmarkCase as transitionMosaicCase } from "./cases/normative/regression/regression_transition_mosaic.ts";
import { benchmarkCase as amplitudeMosaicCase } from "./cases/normative/regression/regression_amplitude_mosaic.ts";
import { benchmarkCase as believerRhythmCase } from "./cases/normative/development_music/believer_56_6s.ts";
import { benchmarkCase as believerImpactCase } from "./cases/normative/development_music/believer_impact_56s.ts";
import { benchmarkCase as amorCase } from "./cases/qualification/amor_na_praia_46s.ts";
import { benchmarkCase as lunaCase } from "./cases/qualification/luna_bala_44s.ts";
import { benchmarkCase as tikiCase } from "./cases/qualification/tiki_tiki_48s.ts";
import { benchmarkCase as shelterCase } from "./cases/qualification/shelter_impact_sync_81s.ts";
import { benchmarkCase as amourCase } from "./cases/qualification/amour_de_ma_vie_short_44s.ts";

export type CatalogEntry = {
  sourcePath: string;
  dependencies?: string[];
  case: BenchmarkCase;
};

const normative = (sourcePath: string, caseDefinition: BenchmarkCase): CatalogEntry => ({ sourcePath, case: caseDefinition });
const qualification = (
  sourcePath: string,
  dependencies: string[],
  caseDefinition: BenchmarkCase,
): CatalogEntry => ({ sourcePath, dependencies, case: caseDefinition });

export const normativeCases: CatalogEntry[] = [
  normative("benchmark/v2/cases/normative/representative/river_reentry.ts", riverReentryCase),
  normative("benchmark/v2/cases/normative/representative/countercurrent.ts", countercurrentCase),
  normative("benchmark/v2/cases/normative/representative/split_signal.ts", splitSignalCase),
  normative("benchmark/v2/cases/normative/representative/pickup_lattice.ts", pickupLatticeCase),
  normative("benchmark/v2/cases/normative/representative/loose_pocket.ts", loosePocketCase),
  normative("benchmark/v2/cases/normative/representative/offgrid_conversation.ts", offgridConversationCase),
  normative("benchmark/v2/cases/normative/representative/rising_switch.ts", risingSwitchCase),
  normative("benchmark/v2/cases/normative/representative/meter_exchange.ts", meterExchangeCase),
  normative("benchmark/v2/cases/normative/representative/wide_breaths.ts", wideBreathsCase),
  normative("benchmark/v2/cases/normative/representative/open_hook.ts", openHookCase),
  normative("benchmark/v2/cases/normative/representative/amplitude_tides.ts", amplitudeTidesCase),
  normative("benchmark/v2/cases/normative/representative/dense_dialogue.ts", denseDialogueCase),
  normative("benchmark/v2/cases/normative/representative/high_air_drive.ts", highAirDriveCase),
  normative("benchmark/v2/cases/normative/representative/sparse_lowline.ts", sparseLowlineCase),
  normative("benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts", pickupProgressionCase),
  normative("benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts", denseRecoveryCase),
  normative("benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts", lowAirEnduranceCase),
  normative("benchmark/v2/cases/normative/regression/regression_transition_mosaic.ts", transitionMosaicCase),
  normative("benchmark/v2/cases/normative/regression/regression_amplitude_mosaic.ts", amplitudeMosaicCase),
  normative("benchmark/v2/cases/normative/development_music/believer_56_6s.ts", believerRhythmCase),
  normative("benchmark/v2/cases/normative/development_music/believer_impact_56s.ts", believerImpactCase),
];

export const variantCases: CatalogEntry[] = materializedVariantCases;

export const qualificationCases: CatalogEntry[] = [
  qualification("benchmark/v2/cases/qualification/amor_na_praia_46s.ts", ["productions/amor_na_praia_46s/spec.ts", "productions/amor_na_praia_46s/audio.json"], amorCase),
  qualification("benchmark/v2/cases/qualification/luna_bala_44s.ts", ["productions/luna_bala_44s/spec.ts", "productions/luna_bala_44s/audio.json"], lunaCase),
  qualification("benchmark/v2/cases/qualification/tiki_tiki_48s.ts", ["productions/tiki_tiki_48s/spec.ts", "productions/tiki_tiki_48s/audio.json"], tikiCase),
  qualification("benchmark/v2/cases/qualification/shelter_impact_sync_81s.ts", ["scripts/v0/specs/shelter_impact_sync.ts", "scripts/v0/specs/_music.ts"], shelterCase),
  qualification("benchmark/v2/cases/qualification/amour_de_ma_vie_short_44s.ts", ["scripts/v0/specs/amour_de_ma_vie_short.ts", "beats/amour_de_ma_vie_short.rhythm.json"], amourCase),
];

export const developmentCases: CatalogEntry[] = [...normativeCases, ...variantCases];

assertCatalog();

function assertCatalog(): void {
  const all = [...developmentCases, ...qualificationCases];
  const ids = all.map((entry) => entry.case.metadata.id);
  if (new Set(ids).size !== ids.length) throw new Error(`Benchmark V2 catalog IDs must be unique`);
  for (const entry of variantCases) {
    const parent = entry.case.metadata.variant?.parentId;
    if (parent === undefined || !normativeCases.some((candidate) => candidate.case.metadata.id === parent)) {
      throw new Error(`${entry.case.metadata.id}: variant parent is absent`);
    }
  }
  for (const parent of normativeCases) {
    const parentId = parent.case.metadata.id;
    const variants = variantCases.filter((entry) => entry.case.metadata.variant?.parentId === parentId);
    const expectedVariants = parentId === "frontier_low_air_endurance" ? 3 : 1;
    if (variants.length !== expectedVariants) {
      throw new Error(`${parentId}: expected ${expectedVariants} deliberate variant(s), found ${variants.length}`);
    }
  }
}
