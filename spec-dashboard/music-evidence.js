/** Every measured source survives; the merged event's timestamp is not its
 * sources' timestamp. These are observations, never requested impacts. */
export function sourceEvents(events) {
  return events.flatMap(event => Object.entries(event.sources).map(([source, value]) => ({
    t: value.t, strength: value.rise, peak: value.peak, source,
    mergedTime: event.t,
  }))).sort((a, b) => a.t - b.t || a.source.localeCompare(b.source));
}

/** Closest centered measurement window, in original audio seconds. */
export function vocalFrame(evidence, time) {
  if (!evidence || time < 0 || time >= evidence.duration) return null;
  const index = Math.min(evidence.rms.length - 1, Math.max(0, Math.round(time * evidence.sampleRate / evidence.hopSamples)));
  const frame = {t: index * evidence.hopSamples / evidence.sampleRate, rms: evidence.rms[index], change: evidence.spectralChange[index]};
  if (evidence.bandFlux) frame.bandFlux = evidence.bandFlux.map(band => ({
    name: band.name, filterCenterHz: band.filterCenterHz, value: band.values[index],
  }));
  return frame;
}
