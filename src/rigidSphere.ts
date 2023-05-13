import * as THREE from "three";

// ===================== BOUNDARY =====================

const bound = 5.0;
const bound_num = 5;

const boundPositions = [
  new THREE.Vector3(0.0, 0.0, 0.0), // grond
  new THREE.Vector3(bound, 0.0, 0.0), // maxX
  new THREE.Vector3(-bound, 0.0, 0.0), // minX
  new THREE.Vector3(0.0, 0.0, bound), // maxZ
  new THREE.Vector3(0.0, 0.0, -bound), // minZ
];
const boundNormals = [
  new THREE.Vector3(0.0, 1.0, 0.0), // grond
  new THREE.Vector3(-1.0, 0.0, 0.0), // maxX
  new THREE.Vector3(1.0, 0.0, 0.0), // minX
  new THREE.Vector3(0.0, 0.0, -1.0), // maxZ
  new THREE.Vector3(0.0, 0.0, 1.0), // minZ
];

// ===================== RIGIDSPHERE =====================

export class RigidSphere {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  invMass: number;
  mesh: THREE.Mesh;
  radius: number;

  constructor(radius_: number, scene_: THREE.Scene) {
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.radius = radius_;
    this.invMass = (4 * Math.PI) / this.radius ** 3;

    const color = new THREE.Color(Math.random(), Math.random(), Math.random());
    const sphereGeo = new THREE.SphereGeometry(this.radius);
    const sphereMat = new THREE.MeshPhongMaterial({ color });
    this.mesh = new THREE.Mesh(sphereGeo, sphereMat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene_.add(this.mesh);
  }

  renderUpdate() {
    this.mesh.position.copy(this.position);
  }

  applyStates(dt: number, gravity: number) {
    this.velocity.add(new THREE.Vector3(0, -gravity * dt, 0));
    this.position.add(this.velocity.clone().multiplyScalar(dt));
  }
  handleCollision(spheres: Array<RigidSphere>) {
    const restitution = 0.5;
    for (let other of spheres) {
      if (other === this) continue;
      const dir = this.position.clone().sub(other.position);
      const gap = dir.length() - this.radius - other.radius;
      const relProj = dir.dot(this.velocity.clone().sub(other.velocity));
      dir.normalize();
      if (gap < 0.01 && relProj < 0) {
        this.velocity.add(dir.clone().multiplyScalar(-relProj * restitution));
        other.velocity.add(dir.clone().multiplyScalar(relProj * restitution));
      }
      if (gap < 0) {
        this.position.add(dir.clone().multiplyScalar(-gap));
      }
    }
  }
  handleBoundaries() {
    const restitution = 0.5;
    for (let k = 0; k < boundPositions.length; k++) {
      const gap = this.position.clone().sub(boundPositions[k]).dot(boundNormals[k]) - this.radius;
      const proj = this.velocity.dot(boundNormals[k]);
      if (gap < 0.01 && proj < 0) {
        this.velocity.add(boundNormals[k].clone().multiplyScalar(-proj * (1 + restitution)));
      }
      if (gap < 0) {
        this.position.add(boundNormals[k].clone().multiplyScalar(-gap));
      }
    }
  }

  reset() {
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.renderUpdate();
  }

  grabInteract(dt: number, target: THREE.Vector3, id: number) {
    const prevPosition = this.position.clone();
    this.position.copy(target);
    this.velocity.copy(
      this.position
        .clone()
        .sub(prevPosition)
        .multiplyScalar(1 / dt)
    );
  }

  move(x: number, y: number, z: number) {
    this.position.add(new THREE.Vector3(x, y, z));
    this.renderUpdate();
  }
}