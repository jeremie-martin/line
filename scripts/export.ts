/** Legacy editor exporter. Camera resolution is shared with the video renderer. */
import {exportVideo, MirrorUnreachableError} from './lib/export.ts';
import {resolveVideoOptions} from './lib/video_options.ts';
try {
  await exportVideo(await resolveVideoOptions(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof MirrorUnreachableError
    ? 'Cannot reach the mirror. Start python3 -m http.server 8765 --bind 127.0.0.1 from mirror/.'
    : String(error));
  process.exitCode = error instanceof MirrorUnreachableError ? 2 : 1;
}
