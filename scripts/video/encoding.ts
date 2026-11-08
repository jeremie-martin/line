/** The one encoding standard of every video the repository writes: H.264 yuv420p, BT.709 limited range, with all four colour
 * tags, so every player decodes the colours that were drawn (an untagged or mislabelled file is read with another matrix by
 * some players: reds turn orange). Used by the video writer and by any FFmpeg composition of written videos. */
/** RGB frames to BT.709 limited-range yuv420p, the result tagged as such. */
export const CONVERT = 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv';
/** Re-tag after a composition filter of videos already in the standard (pad, stack, text keep the samples). */
export const KEEP = 'format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv';
/** The container and stream tags of the standard. */
export const TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
export const VIDEO = ['-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', ...TAGS];
export const AUDIO = ['-c:a', 'aac', '-b:a', '192k'];
