/**
 * The audio manifest, `assets/audio/audio.json`, written by `npm run audio`:
 * where each clip sits in the sound effects sprite and where each music loop
 * starts and ends.
 */

/** Files of one sound by format, e.g. `{ m4a: "sfx.m4a" }`; the first one the browser plays wins. */
export type FilesByFormat = Record<string, string>;

export interface AudioManifest {
  sprite: {
    files: FilesByFormat;
    /** Clip name → [start, duration] in seconds. */
    clips: Record<string, [number, number]>;
  };
  music: Record<string, { files: FilesByFormat; loopStart: number; loopEnd: number }>;
}

const MIME: Record<string, string> = {
  ogg: 'audio/ogg; codecs=opus',
  webm: 'audio/webm; codecs=opus',
  m4a: 'audio/mp4; codecs="mp4a.40.2"',
  mp3: 'audio/mpeg',
};

/** The first file whose format the browser says it can play, or null. */
export function pickFile(files: FilesByFormat, canPlay: (mime: string) => boolean): string | null {
  for (const [format, file] of Object.entries(files)) {
    const mime = MIME[format];
    if (mime && canPlay(mime)) return file;
  }
  return null;
}

/** `canPlayType` as a yes or no. */
export function browserCanPlay(mime: string): boolean {
  return document.createElement('audio').canPlayType(mime) !== '';
}
