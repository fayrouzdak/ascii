/**
 * Pre-decodes every frame of an animated GIF / WebP via the ImageDecoder API
 * and exposes a synchronous `getFrame()` that returns the correct ImageBitmap
 * for the current wall-clock time.
 */

interface DecodedFrame {
  image: ImageBitmap;
  durationMs: number;
}

export class FramePlayer {
  private frames: DecodedFrame[];
  private totalDurationMs: number;
  private startMs = 0;
  readonly width: number;
  readonly height: number;

  static async create(buf: ArrayBuffer, mime: string): Promise<FramePlayer | null> {
    if (!('ImageDecoder' in globalThis)) return null;
    let decoder: ImageDecoder | null = null;
    try {
      decoder = new ImageDecoder({ type: mime, data: buf });
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      if (!track || !track.animated || track.frameCount < 2) {
        decoder.close();
        return null;
      }

      const count = track.frameCount;
      const frames: DecodedFrame[] = [];
      let w = 0;
      let h = 0;

      for (let i = 0; i < count; i++) {
        const result = await decoder.decode({ frameIndex: i });
        const vf = result.image;
        if (i === 0) {
          w = vf.displayWidth;
          h = vf.displayHeight;
        }
        const bmp = await createImageBitmap(vf);
        frames.push({
          image: bmp,
          durationMs: Math.max(10, (vf.duration ?? 100_000) / 1000),
        });
        vf.close();
      }

      decoder.close();
      decoder = null;

      if (frames.length < 2) return null;

      const total = frames.reduce((s, f) => s + f.durationMs, 0);
      return new FramePlayer(frames, total, w, h);
    } catch {
      decoder?.close();
      return null;
    }
  }

  private constructor(frames: DecodedFrame[], totalMs: number, w: number, h: number) {
    this.frames = frames;
    this.totalDurationMs = totalMs;
    this.width = w;
    this.height = h;
    this.startMs = performance.now();
  }

  /** Return the ImageBitmap for the current point in time (loops automatically). */
  getFrame(): ImageBitmap {
    const elapsed = (performance.now() - this.startMs) % this.totalDurationMs;
    let acc = 0;
    for (const f of this.frames) {
      acc += f.durationMs;
      if (elapsed < acc) return f.image;
    }
    return this.frames[this.frames.length - 1]!.image;
  }

  close() {
    for (const f of this.frames) f.image.close();
    this.frames = [];
  }
}
