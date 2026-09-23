/**
 * Computes the linear volume multiplier to apply to a song based on its embedded ReplayGain
 * tags, so tracks play back at a consistent loudness.
 */

/**
 * Prefers track gain over album gain, matching most ReplayGain players' default (non-"album
 * mode") behavior. Clamps against the matching peak tag so boosting a track never causes it to
 * clip.
 *
 * @param tags - The song's tag map, expected to contain `replaygain_track_gain` /
 *   `replaygain_track_peak` and/or `replaygain_album_gain` / `replaygain_album_peak`.
 * @returns The linear multiplier to apply to the audio signal's gain. `1` (no change) if no
 *   gain tag is present.
 */
export function replayGainMultiplier(tags: Record<string, string>): number {
  const [gainTag, peakTag] = tags.replaygain_track_gain !== undefined
    ? [tags.replaygain_track_gain, tags.replaygain_track_peak]
    : [tags.replaygain_album_gain, tags.replaygain_album_peak]

  if (gainTag === undefined) return 1

  let multiplier = 10 ** (Number(gainTag) / 20)
  if (peakTag !== undefined) {
    const peak = Number(peakTag)
    if (peak > 0) multiplier = Math.min(multiplier, 1 / peak)
  }
  return multiplier
}
