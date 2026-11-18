/** The zoom lanes written for each song (productions/<song>/zooms.ts), for the scene builder. A song without an entry keeps the
 * steady zoom. The lanes follow the song's music, so every reading of a song shares them. */
import amorNaPraia46s from '../../productions/amor_na_praia_46s/zooms.ts';
import amorNaPraia from '../../productions/amor_na_praia_selection/zooms.ts';
import amourDeMaVie108s from '../../productions/amour_de_ma_vie_108s/zooms.ts';
import amourDeMaVie from '../../productions/amour_de_ma_vie_44s/zooms.ts';
import believer from '../../productions/believer_78s/zooms.ts';
import bones from '../../productions/bones_selection/zooms.ts';
import circusMinimus from '../../productions/circus_minimus_77s/zooms.ts';
import derniereDanseCoral from '../../productions/derniere_danse_coral_selection/zooms.ts';
import funkDoBounceSuperSlowed from '../../productions/funk_do_bounce_super_slowed_selection/zooms.ts';
import funkEstranhoSuperSlowed from '../../productions/funk_estranho_super_slowed_selection/zooms.ts';
import letTheWorldBurn from '../../productions/let_the_world_burn_selection/zooms.ts';
import losVoltaje from '../../productions/los_voltaje_selection/zooms.ts';
import losVoltajeSlowed from '../../productions/los_voltaje_slowed_selection/zooms.ts';
import losVoltajeUltraSlowed from '../../productions/los_voltaje_ultra_slowed_selection/zooms.ts';
import luaNaPraca from '../../productions/lua_na_praca_selection/zooms.ts';
import lunaBala from '../../productions/luna_bala_44s/zooms.ts';
import lunaBalaOriginal from '../../productions/luna_bala_original_selection/zooms.ts';
import lunaBalaSlowed from '../../productions/luna_bala_slowed_selection/zooms.ts';
import montagemComa from '../../productions/montagem_coma_selection/zooms.ts';
import montagemTomadaExtended from '../../productions/montagem_tomada_extended_selection/zooms.ts';
import montagemTomadaSlowed from '../../productions/montagem_tomada_slowed_selection/zooms.ts';
import montagemTomadaSuperSlowed from '../../productions/montagem_tomada_super_slowed_selection/zooms.ts';
import noBatidao from '../../productions/no_batidao_selection/zooms.ts';
import noBatidaoSlowed from '../../productions/no_batidao_slowed_selection/zooms.ts';
import passoBemSolto from '../../productions/passo_bem_solto_selection/zooms.ts';
import passoBemSoltoSlowed from '../../productions/passo_bem_solto_slowed_selection/zooms.ts';
import passoBemSoltoSuperSlowed from '../../productions/passo_bem_solto_super_slowed_selection/zooms.ts';
import petrunko from '../../productions/petrunko_selection/zooms.ts';
import shortMontagemTomadaExtended from '../../productions/short_montagem_tomada_extended/zooms.ts';
import shortMontagemTomadaSuperSlowed from '../../productions/short_montagem_tomada_super_slowed/zooms.ts';
import shortPassoBemSoltoSuperSlowed from '../../productions/short_passo_bem_solto_super_slowed/zooms.ts';
import shortPassoBemSolto from '../../productions/short_passo_bem_solto/zooms.ts';
import shortMontagemTomadaSlowed from '../../productions/short_montagem_tomada_slowed/zooms.ts';
import shortBeliever from '../../productions/short_believer/zooms.ts';
import shortNoBatidao from '../../productions/short_no_batidao/zooms.ts';
import shortValhalla from '../../productions/short_valhalla/zooms.ts';
import tikiTiki from '../../productions/tiki_tiki_48s/zooms.ts';
import trouble from '../../productions/trouble_50s/zooms.ts';
import valhalla from '../../productions/valhalla_40s/zooms.ts';

export type ZoomLane = {id: string; name: string; about: string; keyframes: Array<{t: number; wide: number}>};
export const ZOOMS: Record<string, ZoomLane[]> = {
  amor_na_praia_46s: amorNaPraia46s,
  amor_na_praia_selection: amorNaPraia,
  amour_de_ma_vie_108s: amourDeMaVie108s,
  amour_de_ma_vie_44s: amourDeMaVie,
  believer_78s: believer,
  bones_selection: bones,
  circus_minimus_77s: circusMinimus,
  derniere_danse_coral_selection: derniereDanseCoral,
  funk_do_bounce_super_slowed_selection: funkDoBounceSuperSlowed,
  funk_estranho_super_slowed_selection: funkEstranhoSuperSlowed,
  let_the_world_burn_selection: letTheWorldBurn,
  los_voltaje_selection: losVoltaje,
  los_voltaje_slowed_selection: losVoltajeSlowed,
  los_voltaje_ultra_slowed_selection: losVoltajeUltraSlowed,
  lua_na_praca_selection: luaNaPraca,
  luna_bala_44s: lunaBala,
  luna_bala_original_selection: lunaBalaOriginal,
  luna_bala_slowed_selection: lunaBalaSlowed,
  montagem_coma_selection: montagemComa,
  montagem_tomada_extended_selection: montagemTomadaExtended,
  montagem_tomada_slowed_selection: montagemTomadaSlowed,
  montagem_tomada_super_slowed_selection: montagemTomadaSuperSlowed,
  no_batidao_selection: noBatidao,
  no_batidao_slowed_selection: noBatidaoSlowed,
  passo_bem_solto_selection: passoBemSolto,
  passo_bem_solto_slowed_selection: passoBemSoltoSlowed,
  passo_bem_solto_super_slowed_selection: passoBemSoltoSuperSlowed,
  petrunko_selection: petrunko,
  short_montagem_tomada_extended: shortMontagemTomadaExtended,
  short_montagem_tomada_super_slowed: shortMontagemTomadaSuperSlowed,
  short_passo_bem_solto_super_slowed: shortPassoBemSoltoSuperSlowed,
  short_passo_bem_solto: shortPassoBemSolto,
  short_montagem_tomada_slowed: shortMontagemTomadaSlowed,
  short_believer: shortBeliever,
  short_no_batidao: shortNoBatidao,
  short_valhalla: shortValhalla,
  tiki_tiki_48s: tikiTiki,
  trouble_50s: trouble,
  valhalla_40s: valhalla,
};
