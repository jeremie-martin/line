/** Low-level track export; production and review jobs share this renderer. */
import {exportVideo} from './lib/export.ts';
import {resolveVideoOptions} from './lib/video_options.ts';
try {
  await exportVideo(await resolveVideoOptions(process.argv.slice(2)));
} catch (error) {
  console.error(`Export failed: ${String(error)}`);
  process.exitCode = 1;
}
