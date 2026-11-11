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
};

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
}

export class ChaseCamera {
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private initialized = false;
  private camY = 0;
  private lookY = 0;
  private dip = 0;
  private wasAir = false;
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
    const dist = (portrait ? CAMERA.portraitDistance : CAMERA.distance) + speedRatio * (portrait ? 0.35 : 1.2);
    const height = portrait ? CAMERA.portraitHeight : CAMERA.height;
    // Detrás del kart y por encima de la calzada que hay bajo la propia cámara.
    const behindX = x - fx * dist;
    const behindZ = z - fz * dist;
    const underCam = cue.floorAt(behindX, behindZ);
    // En peralte se mira más lejos, para que el cielo y el horizonte entren en el encuadre.
    const banked = !cue.airborne && Math.abs(cue.bankDeg) > 15;
    const lookDist = banked ? 12 : CAMERA.lookAhead;
    const lookX = x + fx * lookDist;
    const lookZ = z + fz * lookDist;
    const underLook = cue.floorAt(lookX, lookZ);
    const kartCam = y + height;
    const camHeight = banked ? height + 1.05 : height;
    const desiredCam = cue.airborne ? Math.min(kartCam, underCam + height + 0.6) : Math.max(underCam + camHeight, underCam + 1.5);
    const desiredLook = cue.airborne ? Math.min(y + 0.35, underLook + 1) : banked ? y - 0.4 : y + (portrait ? 0.4 : 0.7);
    if (!this.initialized) {
      this.camY = desiredCam;
      this.lookY = desiredLook;
      this.pos.set(behindX, desiredCam, behindZ);
      this.look.set(lookX, desiredLook, lookZ);
      this.initialized = true;
    }
    if (this.wasAir && !cue.airborne) this.dip = -0.2;
    this.wasAir = cue.airborne;
    if (this.dip < 0) this.dip = Math.min(0, this.dip + (0.2 / 0.25) * dt);
    const kPos = 1 - Math.exp(-CAMERA.follow * dt);
    const kY = cue.airborne ? 1 - Math.pow(0.85, dt * 60) : 1 - Math.exp(-5 * dt);
    this.camY += (desiredCam - this.camY) * kY;
    this.lookY += (desiredLook - this.lookY) * kY;
    const targetPos = new THREE.Vector3(behindX, this.camY + this.dip, behindZ);
    const floor = cue.floorAt(targetPos.x, targetPos.z) + 1.5;
    if (targetPos.y < floor) targetPos.y = floor;
    const targetLook = new THREE.Vector3(x + fx * CAMERA.lookAhead, this.lookY, z + fz * CAMERA.lookAhead);
    this.pos.lerp(targetPos, kPos);
    this.look.lerp(targetLook, Math.min(1, kPos * 2));
    if (cue.floorAt(this.pos.x, this.pos.z) + 1.5 > this.pos.y) this.pos.y = cue.floorAt(this.pos.x, this.pos.z) + 1.5;

    this.camera.position.copy(this.pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.look);
    const roll = THREE.MathUtils.degToRad(Math.max(-12, Math.min(12, cue.bankDeg * 0.35)));
    this.camera.rotateZ(roll);
    // El peralte del kart no se suma: el horizonte (el arriba del mundo) no pasa de 12°.
    this.worldUp.set(0, 1, 0).applyQuaternion(this.invQuat.copy(this.camera.quaternion).invert());
    const tilt = Math.atan2(this.worldUp.x, this.worldUp.y);
    const maxTilt = THREE.MathUtils.degToRad(12);
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
