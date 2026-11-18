/** The drop of each song, [start, end] in song seconds: a musical judgement, placed by hand from the spec's sections
 * (no detector found it reliably). The picture snaps each end to the strongest hit near it. A song without a drop has no
 * Night and no scheme switch. */
export const DROP_TIMES: Record<string, [number, number]> = {
  circus_minimus_77s: [38.5, 51.3], // from the hook (its first measured impact) to the re-entry hit (owner, round 20)
  petrunko_selection: [22.4, 40.5],
  los_voltaje_selection: [23.9, 40.5],
  lua_na_praca_selection: [29.7, 49.6],
  no_batidao_selection: [15.2, 29.5],
  let_the_world_burn_selection: [4.5, 24.5],
  montagem_coma_selection: [19.1, 33.6],
  montagem_tomada_super_slowed_selection: [37.0, 50.0],
  short_montagem_tomada_slowed: [17.857, 35.15],
  short_believer: [22.646, 51.084],
  short_no_batidao: [12.622, 26.937],
  short_valhalla: [1.149, 11.529],
  short_montagem_tomada_extended: [38.152, 52.92],
};
