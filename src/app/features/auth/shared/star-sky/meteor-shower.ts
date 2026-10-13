import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';

import type { Meteor } from './meteor.interface';
import { METEOR_FRAGMENT, METEOR_VERTEX } from './shaders/star-sky.glsl';
import type { StarSkyLook } from './star-sky-look.type';
import { STAR_SKY } from './star-sky.config';

const placement = new Matrix4();

/**
 * Meteors streaking across the sky at random: each launches at a random
 * moment from a random point in the upper sky, falls at a random angle, speed
 * and length, flares and burns out. Now and then a second follows close behind.
 * One instanced draw call carries the whole pool.
 */
export class MeteorShower {
  readonly object: InstancedMesh<PlaneGeometry, ShaderMaterial>;

  private readonly meteors: Meteor[];
  /** Per instance: tail length, thickness, opacity, tint. */
  private readonly shape: InstancedBufferAttribute;
  private readonly uniforms = {
    uHead: { value: new Color() },
    uTailCool: { value: new Color() },
    uTailWarm: { value: new Color() },
  };
  private opacity = 0;
  private width = 1;
  private height = 1;
  /** Seconds until the next launch. */
  private wait = between(STAR_SKY.meteors.firstDelay);

  constructor(look: StarSkyLook) {
    const { pool } = STAR_SKY.meteors;
    const geometry = new PlaneGeometry(2, 2);
    this.shape = new InstancedBufferAttribute(new Float32Array(pool * 4), 4).setUsage(
      DynamicDrawUsage,
    );
    geometry.setAttribute('aMeteor', this.shape);

    this.object = new InstancedMesh(
      geometry,
      new ShaderMaterial({
        vertexShader: METEOR_VERTEX,
        fragmentShader: METEOR_FRAGMENT,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
      }),
      pool,
    );
    this.object.instanceMatrix.setUsage(DynamicDrawUsage);
    // The shader stretches each streak far beyond the bounds three.js knows of.
    this.object.frustumCulled = false;
    this.object.renderOrder = 1;
    this.object.count = 0;

    this.meteors = Array.from({ length: pool }, (): Meteor => ({
      active: false,
      x: 0,
      y: 0,
      angle: 0,
      speed: 0,
      tail: 0,
      scale: 1,
      brightness: 0,
      tint: 0,
      age: 0,
      life: 1,
    }));
    this.setLook(look);
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  setLook(look: StarSkyLook): void {
    this.object.material.blending = look.blending;
    this.uniforms.uHead.value.set(look.meteors.head);
    this.uniforms.uTailCool.value.set(look.meteors.tailCool);
    this.uniforms.uTailWarm.value.set(look.meteors.tailWarm);
    this.opacity = look.meteors.opacity;
  }

  /** Moves the meteors in flight and launches new ones; when not `running`, clears the sky. */
  update(delta: number, running: boolean): void {
    if (running) {
      this.wait -= delta;
      if (this.wait <= 0) {
        this.launch();
        const { gap, burstChance, burstGap } = STAR_SKY.meteors;
        this.wait = between(Math.random() < burstChance ? burstGap : gap);
      }
    }

    // Meteors in flight are packed into the first instances; only those are drawn.
    let count = 0;
    for (const meteor of this.meteors) {
      if (!meteor.active) continue;
      meteor.age += delta;
      if (!running || meteor.age >= meteor.life) {
        meteor.active = false;
        continue;
      }
      meteor.x += Math.cos(meteor.angle) * meteor.speed * delta;
      meteor.y += Math.sin(meteor.angle) * meteor.speed * delta;

      // The tail draws out behind the head; the meteor flares, then burns out.
      const progress = meteor.age / meteor.life;
      const tail = meteor.tail * MathUtils.smoothstep(progress, 0, 0.35);
      const opacity =
        meteor.brightness *
        this.opacity *
        MathUtils.smoothstep(progress, 0, 0.12) *
        (1 - MathUtils.smoothstep(progress, 0.55, 1));

      placement.makeRotationZ(meteor.angle).setPosition(meteor.x, meteor.y, 0);
      this.object.setMatrixAt(count, placement);
      this.shape.setXYZW(count, tail, meteor.scale, opacity, meteor.tint);
      count++;
    }
    this.object.count = count;
    this.object.instanceMatrix.needsUpdate = true;
    this.shape.needsUpdate = true;
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
    this.object.dispose();
  }

  private launch(): void {
    const meteor = this.meteors.find(({ active }) => !active);
    if (!meteor) return;
    const config = STAR_SKY.meteors;
    const dip = between(config.dip);
    const leftward = Math.random() < 0.5;
    meteor.active = true;
    // From somewhere in the upper sky, starting on the side it travels away from.
    meteor.x =
      (leftward ? MathUtils.randFloat(0.25, 1.1) : MathUtils.randFloat(-0.1, 0.75)) * this.width;
    meteor.y = MathUtils.randFloat(0.4, 1.05) * this.height;
    meteor.angle = leftward ? Math.PI + dip : -dip;
    meteor.speed = between(config.speed);
    meteor.tail = between(config.tail);
    meteor.scale = between(config.scale);
    meteor.brightness = between(config.brightness);
    meteor.tint = Math.random() < config.warmShare ? 1 : 0;
    meteor.age = 0;
    meteor.life = between(config.life);
  }
}

function between([min, max]: readonly [number, number]): number {
  return MathUtils.randFloat(min, max);
}
