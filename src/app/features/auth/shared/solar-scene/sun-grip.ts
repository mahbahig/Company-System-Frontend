import { Quaternion, Raycaster, Sphere, Vector2, Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { SOLAR_SCENE } from './solar-scene.config';
import type { Sun } from './sun';

/** Below this angle (rad) and spin (rad/s) the sun counts as home. */
const SETTLED = 0.001;
/** Floor on the time between two pointer samples, so one quick event can't read as a huge spin. */
const MIN_SAMPLE = 1 / 240;

const raycaster = new Raycaster();
const ndc = new Vector2();
const bounds = new Sphere();
const centre = new Vector3();
const rim = new Vector3();
const across = new Vector3();
const drag = new Vector3();
const sample = new Vector3();
const offset = new Vector3();
const pull = new Vector3();
const axis = new Vector3();
const step = new Quaternion();
const toParent = new Quaternion();

/** Turns `rotation` further by the rotation vector `by` (axis × angle), about the parent's axes. */
function turnBy(rotation: Quaternion, by: Vector3): void {
  const angle = by.length();
  if (angle === 0) return;
  step.setFromAxisAngle(axis.copy(by).divideScalar(angle), angle);
  rotation.premultiply(step).normalize();
}

/** `rotation` as a rotation vector (axis × angle) taking the short way round, so the angle is at most π. */
function shortestTurn(rotation: Quaternion, target: Vector3): Vector3 {
  const w = Math.min(Math.abs(rotation.w), 1);
  const sine = Math.sqrt(1 - w * w);
  if (sine < Number.EPSILON) return target.set(0, 0, 0);
  const scale = ((rotation.w < 0 ? -2 : 2) * Math.acos(w)) / sine;
  return target.set(rotation.x, rotation.y, rotation.z).multiplyScalar(scale);
}

/**
 * Lets the user take hold of the sun and turn it any way, a full revolution
 * and beyond. A drag that starts on the disc turns it like a trackball —
 * sideways about the screen's vertical, up and down about its horizontal —
 * and leaves the camera where it is; a drag anywhere else still orbits.
 *
 * On release a damped spring brings it home by the shorter way round, carrying
 * the fling: let go gently and it eases back, flick it past half a turn and it
 * completes the revolution instead. Under reduced motion it is home at once.
 */
export class SunGrip {
  /** How far the sun is turned from rest, in its parent's space. */
  readonly turn = new Quaternion();

  /** Angular velocity, rad/s, as a rotation vector in the parent's space. */
  private readonly spin = new Vector3();
  private readonly last = new Vector2();
  private pointerId: number | null = null;
  private lastTime = 0;
  private radiansPerPixel = 0;
  private orbiting = false;
  private resting = true;
  private changed = false;
  private reducedMotion: boolean;

  /**
   * Call before the controls are connected to the canvas: listeners run in the
   * order they were added, so a press on the sun is claimed (and the controls
   * switched off) before OrbitControls ever sees it.
   */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: PerspectiveCamera,
    private readonly controls: OrbitControls,
    private readonly sun: Sun,
    reducedMotion: boolean,
    private readonly onGrab: () => void,
  ) {
    this.reducedMotion = reducedMotion;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onRelease);
    canvas.addEventListener('pointercancel', this.onRelease);
    canvas.addEventListener('lostpointercapture', this.onRelease);
    controls.addEventListener('start', this.onOrbitStart);
    controls.addEventListener('end', this.onOrbitEnd);
  }

  /** The user is holding the sun right now. */
  get held(): boolean {
    return this.pointerId !== null;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced && !this.held) this.goHome();
  }

  /** Steps the way home; true when the sun's turn changed since the last call. */
  update(delta: number): boolean {
    if (!this.held && !this.resting) this.stepHome(delta);
    const changed = this.changed;
    this.changed = false;
    return changed;
  }

  dispose(): void {
    const { canvas, controls } = this;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onRelease);
    canvas.removeEventListener('pointercancel', this.onRelease);
    canvas.removeEventListener('lostpointercapture', this.onRelease);
    controls.removeEventListener('start', this.onOrbitStart);
    controls.removeEventListener('end', this.onOrbitEnd);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.held || this.orbiting || !event.isPrimary || event.button !== 0) return;
    if (!this.hitsSun(event)) return;
    this.pointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.controls.enabled = false;
    this.last.set(event.clientX, event.clientY);
    this.lastTime = event.timeStamp;
    this.spin.set(0, 0, 0);
    this.resting = false;
    this.onGrab();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    const seconds = Math.max((event.timeStamp - this.lastTime) / 1000, MIN_SAMPLE);
    const dx = event.clientX - this.last.x;
    const dy = event.clientY - this.last.y;
    this.last.set(event.clientX, event.clientY);
    this.lastTime = event.timeStamp;

    // The screen's axes in the sun's parent space: a sideways drag turns it
    // about the vertical, an up-and-down one about the horizontal, so the
    // near side always travels with the hand.
    this.sun.object.getWorldQuaternion(toParent).invert();
    drag.setFromMatrixColumn(this.camera.matrixWorld, 1).multiplyScalar(dx);
    across.setFromMatrixColumn(this.camera.matrixWorld, 0).multiplyScalar(dy);
    drag.add(across).applyQuaternion(toParent).multiplyScalar(this.radiansPerPixel);
    turnBy(this.turn, drag);

    // The fling is the drag's recent velocity, smoothed so one jittery sample
    // can't decide it.
    const { smoothing } = SOLAR_SCENE.grip.fling;
    this.spin.lerp(sample.copy(drag).divideScalar(seconds), 1 - Math.exp(-seconds / smoothing));
    this.changed = true;
  };

  private readonly onRelease = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.controls.enabled = true;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    const { stillness, maxSpin } = SOLAR_SCENE.grip.fling;
    if ((event.timeStamp - this.lastTime) / 1000 > stillness) this.spin.set(0, 0, 0);
    this.spin.clampLength(0, maxSpin);
    if (this.reducedMotion) this.goHome();
  };

  private readonly onOrbitStart = (): void => {
    this.orbiting = true;
  };

  private readonly onOrbitEnd = (): void => {
    this.orbiting = false;
  };

  /**
   * Whether the press lands on the disc. When it does, also sets how far a
   * pixel of drag turns the sun, from the disc's size on screen right now.
   */
  private hitsSun(event: PointerEvent): boolean {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2,
    );
    const { reach, turnRate } = SOLAR_SCENE.grip;
    this.sun.getBounds(bounds);
    const radius = bounds.radius;
    bounds.radius *= reach;
    raycaster.setFromCamera(ndc, this.camera);
    if (!raycaster.ray.intersectsSphere(bounds)) return false;

    centre.copy(bounds.center).project(this.camera);
    rim
      .setFromMatrixColumn(this.camera.matrixWorld, 1)
      .multiplyScalar(radius)
      .add(bounds.center)
      .project(this.camera);
    const screenRadius = (Math.abs(rim.y - centre.y) * rect.height) / 2;
    this.radiansPerPixel = turnRate / Math.max(screenRadius, 1);
    return true;
  }

  /** One step of the damped spring towards rest, the short way round. */
  private stepHome(delta: number): void {
    const { frequency, damping } = SOLAR_SCENE.grip.spring;
    shortestTurn(this.turn, offset);
    if (offset.length() < SETTLED && this.spin.length() < SETTLED) {
      this.goHome();
      return;
    }
    pull
      .copy(offset)
      .multiplyScalar(-frequency * frequency)
      .addScaledVector(this.spin, -2 * damping * frequency);
    this.spin.addScaledVector(pull, delta);
    turnBy(this.turn, sample.copy(this.spin).multiplyScalar(delta));
    this.changed = true;
  }

  private goHome(): void {
    this.turn.identity();
    this.spin.set(0, 0, 0);
    this.resting = true;
    this.changed = true;
  }
}
