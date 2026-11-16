import * as THREE from "three";

// Cámara de persecución suave que se abre un poco a alta velocidad.
export const CAMERA = {
  distance: 6.5,
  height: 2.8,
  lookAhead: 4,
  baseFov: 62,
  fastFov: 76,
  /** Rapidez con la que la cámara alcanza su objetivo (1/s). */
  follow: 6,
  /**
   * En vertical el kart tiene que ocupar cerca de un tercio del ancho.
   * Más cerca y más baja que antes; el campo de visión apenas crece.
   */
  portraitExtraFov: 4,
  portraitHeight: 2.45,
  portraitDistance: 4.2,
  /**
   * Circuitos con relieve (Ánimas): más baja y más cerca. En vertical el kart queda en el tercio
   * inferior y el horizonte en el superior, con la calzada delante.
   */
  reliefDistance: 5.2,
  reliefHeight: 2.2,
  reliefPortraitDistance: 6.5,
  reliefPortraitHeight: 3.2,
  reliefPortraitLookAhead: 8,
  reliefPortraitLookLift: 0.9,
};

/** Máxima velocidad de alabeo de la cámara (°/s) y salto vertical por fotograma a 60 fps (m). */
export const ROLL_RATE_MAX = 25;
export const CAM_Y_STEP_MAX = 0.15;
/** Anchura (m) de la transición del suelo: dentro de ella la cámara se apoya sin quiebro. */
const FLOOR_BLEND = 0.4;

/**
 * Máximo suave entre `y` y el suelo: igual a `max(y, floor)` fuera de la banda de `FLOOR_BLEND` m
 * y con transición cuadrática dentro, así el suelo no empuja la cámara de golpe.
 */
export function softFloor(y: number, floor: number): number {
  const d = y - floor;
  if (d >= FLOOR_BLEND) return y;
  if (d <= -FLOOR_BLEND) return floor;
  const t = (d + FLOOR_BLEND) / (2 * FLOOR_BLEND);
  return floor + (d + FLOOR_BLEND) * t * 0.5;
}

export interface CameraCue {
  /** Circuito con peralte y saltos. Sin esto, la cámara es la de siempre. */
  relief: boolean;
  /** Peralte bajo el kart, en grados. */
  bankDeg: number;
  airborne: boolean;
  /** Altura de la calzada bajo el kart. */
  groundY: number;
  /** Salto L en el aire: el campo de visión suma 4°. */
  bigJump: boolean;
  /** Altura de la calzada en un punto del mundo. */
  floorAt: (x: number, z: number) => number;
  /** Normal de la calzada bajo el kart (peralte y pendiente), no el arriba del coche. */
  normal?: { x: number; y: number; z: number };
}

export class ChaseCamera {
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private initialized = false;
  private camY = 0;
  private lookY = 0;
  private dip = 0;
  private wasAir = false;
  private rollDeg = 0;
  private readonly smoothedNormal = new THREE.Vector3(0, 1, 0);
  private readonly worldUp = new THREE.Vector3();
  private readonly invQuat = new THREE.Quaternion();

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  /** Coloca la cámara de golpe la próxima vez (al reaparecer o empezar). */
  snap() {
    this.initialized = false;
    this.dip = 0;
    this.wasAir = false;
  }

  /** `speedRatio` = velocidad / velocidad punta (puede pasar de 1 con turbo). */
  update(x: number, y: number, z: number, heading: number, speedRatio: number, dt: number, cue?: CameraCue) {
    if (cue?.relief) {
      this.updateRelief(x, y, z, heading, speedRatio, dt, cue);
      return;
    }
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const portrait = this.camera.aspect < 1;
    const dist = (portrait ? CAMERA.portraitDistance : CAMERA.distance) + speedRatio * (portrait ? 0.35 : 1.2);
    const height = portrait ? CAMERA.portraitHeight : CAMERA.height;
    const targetPos = new THREE.Vector3(x - fx * dist, y + height, z - fz * dist);
    const targetLook = new THREE.Vector3(x + fx * CAMERA.lookAhead, y + (portrait ? 0.28 : 0.8), z + fz * CAMERA.lookAhead);

    if (!this.initialized) {
      this.pos.copy(targetPos);
      this.look.copy(targetLook);
      this.initialized = true;
    }
    const k = 1 - Math.exp(-CAMERA.follow * dt);
    this.pos.lerp(targetPos, k);
    this.look.lerp(targetLook, Math.min(1, k * 2));

    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);

    const fov =
      CAMERA.baseFov +
      (portrait ? CAMERA.portraitExtraFov : 0) +
      (CAMERA.fastFov - CAMERA.baseFov) * Math.min(1.4, Math.max(0, speedRatio));
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * k;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Peralte, saltos y un suelo que no se puede atravesar con la cámara. */
  private updateRelief(x: number, y: number, z: number, heading: number, speedRatio: number, dt: number, cue: CameraCue) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const portrait = this.camera.aspect < 1;
    const dist = (portrait ? CAMERA.reliefPortraitDistance : CAMERA.reliefDistance) + speedRatio * (portrait ? 0.35 : 1.2);
    const height = portrait ? CAMERA.reliefPortraitHeight : CAMERA.reliefHeight;
    const lookLift = portrait ? CAMERA.reliefPortraitLookLift : 0.8;
    const lookAhead = portrait ? CAMERA.reliefPortraitLookAhead : CAMERA.lookAhead;
    // ~0,1 por fotograma a 60 fps, igual para la normal y el alabeo.
    const kSmooth = 1 - Math.pow(0.9, dt * 60);
    const raw = cue.normal ?? { x: 0, y: 1, z: 0 };
    const targetN = this.worldUp.set(raw.x, raw.y, raw.z);
    if (targetN.lengthSq() < 1e-8) targetN.set(0, 1, 0);
    else targetN.normalize();
    if (!this.initialized) this.smoothedNormal.copy(targetN);
    else this.smoothedNormal.lerp(targetN, kSmooth).normalize();

    // En el suelo la cámara se apoya en la normal de la calzada (hacia el interior de la curva).
    // En el aire sigue el arriba del mundo, como hasta ahora.
    const n = cue.airborne ? this.worldUp.set(0, 1, 0) : this.smoothedNormal;
    const behindX = x - fx * dist + n.x * height;
    const behindZ = z - fz * dist + n.z * height;
    let camBase = y + n.y * height;
    const lookX = x + fx * lookAhead + n.x * lookLift;
    const lookZ = z + fz * lookAhead + n.z * lookLift;
    const lookBase = y + n.y * lookLift;
    const underCam = cue.floorAt(behindX, behindZ);
    const underLook = cue.floorAt(lookX, lookZ);
    if (!cue.airborne) camBase = softFloor(camBase, underCam + 0.15);
    const desiredCamY = cue.airborne ? Math.min(y + height, underCam + height + 0.6) : camBase;
    const desiredLookY = cue.airborne ? Math.min(y + 0.35, underLook + 0.8 + 0.6) : lookBase;
    if (!this.initialized) {
      this.camY = desiredCamY;
      this.lookY = desiredLookY;
      this.pos.set(behindX, desiredCamY, behindZ);
      this.look.set(lookX, desiredLookY, lookZ);
      this.rollDeg = cue.airborne ? 0 : THREE.MathUtils.clamp(cue.bankDeg * 0.8, -32, 32);
      this.initialized = true;
    }
    if (this.wasAir && !cue.airborne) this.dip = -0.2;
    this.wasAir = cue.airborne;
    if (this.dip < 0) this.dip = Math.min(0, this.dip + (0.2 / 0.25) * dt);
    const kPos = 1 - Math.exp(-CAMERA.follow * dt);
    const kY = cue.airborne ? 1 - Math.pow(0.85, dt * 60) : kPos;
    // Salto vertical limitado por fotograma (a 60 fps), también al subir o bajar de golpe.
    const yStep = CAM_Y_STEP_MAX * Math.max(1, dt * 60);
    this.camY += THREE.MathUtils.clamp((desiredCamY - this.camY) * kY, -yStep, yStep);
    this.lookY += (desiredLookY - this.lookY) * kY;
    const targetRoll = cue.airborne ? 0 : THREE.MathUtils.clamp(cue.bankDeg * 0.8, -32, 32);
    const rollStep = ROLL_RATE_MAX * dt;
    this.rollDeg += THREE.MathUtils.clamp((targetRoll - this.rollDeg) * kSmooth, -rollStep, rollStep);
    const targetPos = new THREE.Vector3(behindX, this.camY + this.dip, behindZ);
    targetPos.y = softFloor(targetPos.y, cue.floorAt(targetPos.x, targetPos.z) + 0.15);
    const targetLook = new THREE.Vector3(lookX, this.lookY, lookZ);
    this.pos.lerp(targetPos, kPos);
    this.look.lerp(targetLook, Math.min(1, kPos * 2));
    this.pos.y = softFloor(this.pos.y, cue.floorAt(this.pos.x, this.pos.z) + 0.15);

    this.camera.position.copy(this.pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.look);
    this.camera.rotateZ(THREE.MathUtils.degToRad(this.rollDeg));
    // El cabeceo de lookAt no puede llevar el horizonte más allá del tope.
    this.worldUp.set(0, 1, 0).applyQuaternion(this.invQuat.copy(this.camera.quaternion).invert());
    const tilt = Math.atan2(this.worldUp.x, this.worldUp.y);
    const maxTilt = THREE.MathUtils.degToRad(32);
    if (Math.abs(tilt) > maxTilt) this.camera.rotateZ(Math.sign(tilt) * maxTilt - tilt);

    const fov =
      CAMERA.baseFov +
      (portrait ? CAMERA.portraitExtraFov : 0) +
      (CAMERA.fastFov - CAMERA.baseFov) * Math.min(1.4, Math.max(0, speedRatio)) +
      (cue.bigJump ? 4 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * kPos;
      this.camera.updateProjectionMatrix();
    }
  }
}
