import { describe, expect, it } from 'vitest';
import { ease, Tweens } from '../src/game/scene/tween';

describe('Tweens', () => {
  it('moves a value over time and resolves at the end', async () => {
    const tweens = new Tweens();
    const o = { x: 0 };
    let done = false;
    void tweens.to(o, { x: 100 }, 100, ease.linear).then(() => (done = true));
    tweens.update(50);
    expect(o.x).toBe(50);
    tweens.update(50);
    await Promise.resolve();
    expect(o.x).toBe(100);
    expect(done).toBe(true);
  });

  it('starts from the value at the end of the delay', () => {
    const tweens = new Tweens();
    const o = { x: 0 };
    void tweens.to(o, { x: 100 }, 100, ease.linear, 50);
    o.x = 40;
    tweens.update(50);
    tweens.update(50);
    expect(o.x).toBe(70);
  });

  it('hands a field to the newer tween and settles the older one', async () => {
    const tweens = new Tweens();
    const o = { x: 0 };
    let first = false;
    void tweens.to(o, { x: 100 }, 100, ease.linear).then(() => (first = true));
    tweens.update(50);
    void tweens.to(o, { x: 0 }, 100, ease.linear);
    await Promise.resolve();
    expect(first).toBe(true);
    tweens.update(50);
    expect(o.x).toBe(25);
  });

  it('drops an older step still waiting on its delay', () => {
    const tweens = new Tweens();
    const o = { a: 0 };
    // a fade-in and a delayed fade-out, then the same again before the first fade-out
    void tweens.to(o, { a: 1 }, 100, ease.linear);
    void tweens.to(o, { a: 0 }, 100, ease.linear, 300);
    tweens.update(200);
    void tweens.to(o, { a: 1 }, 100, ease.linear);
    void tweens.to(o, { a: 0 }, 100, ease.linear, 300);
    tweens.update(150);
    expect(o.a).toBe(1);
  });

  it('waits on the scene clock', async () => {
    const tweens = new Tweens();
    let done = false;
    void tweens.wait(100).then(() => (done = true));
    tweens.update(99);
    await Promise.resolve();
    expect(done).toBe(false);
    tweens.update(1);
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it('settles everything at once on a rebuild', async () => {
    const tweens = new Tweens();
    const o = { x: 0 };
    let settled = 0;
    void tweens.to(o, { x: 10 }, 1000).then(() => settled++);
    void tweens.wait(1000).then(() => settled++);
    tweens.finishAll();
    await Promise.resolve();
    expect(o.x).toBe(10);
    expect(settled).toBe(2);
  });
});
