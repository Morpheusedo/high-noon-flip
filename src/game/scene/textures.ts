/**
 * Small textures drawn in code at start-up: soft light, rays, sheen, the muzzle
 * flash and the little coins of a win. They are gradients and shapes, so
 * drawing them is cheaper than shipping them as files.
 */
import { Texture } from 'pixi.js';

export interface FxTextures {
  /** A white radial blob: dust, smoke, glow, shadow, sparks. */
  soft: Texture;
  /** Dark corners. */
  vignette: Texture;
  /** Fourteen rays from the centre, for a win. */
  rays: Texture;
  /** A thin horizontal band of light: glints and streaks. */
  sheen: Texture;
  /** A star-shaped burst for the muzzle. */
  flash: Texture;
  /** A small gold coin for the win shower. */
  miniCoin: Texture;
}

let cached: FxTextures | null = null;

export function fxTextures(): FxTextures {
  cached ??= {
    soft: draw(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    }),
    vignette: draw(256, 256, (c) => {
      const g = c.createRadialGradient(128, 128, 60, 128, 128, 180);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(8,3,8,.78)');
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
    }),
    rays: draw(512, 512, (c) => {
      c.translate(256, 256);
      const g = c.createRadialGradient(0, 0, 30, 0, 0, 256);
      g.addColorStop(0, 'rgba(255,255,255,.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      for (let i = 0; i < 14; i++) {
        c.rotate((Math.PI * 2) / 14);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(256, -26);
        c.lineTo(256, 26);
        c.closePath();
        c.fill();
      }
    }),
    sheen: draw(64, 4, (c) => {
      const g = c.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 4);
    }),
    flash: draw(256, 256, (c) => {
      c.translate(128, 128);
      c.fillStyle = '#fff6d0';
      c.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = (i * Math.PI) / 10;
        const r = i % 2 ? 44 : 122 - (i % 4) * 14;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    }),
    miniCoin: draw(64, 64, (c) => {
      const g = c.createRadialGradient(24, 22, 2, 32, 32, 31);
      g.addColorStop(0, '#fff3c4');
      g.addColorStop(0.5, '#f2c14e');
      g.addColorStop(1, '#9a6a15');
      c.fillStyle = g;
      c.beginPath();
      c.arc(32, 32, 30, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#8a5a10';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(32, 32, 23, 0, Math.PI * 2);
      c.stroke();
    }),
  };
  return cached;
}

function draw(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('2D canvas is not available');
  paint(c);
  return Texture.from(canvas);
}
