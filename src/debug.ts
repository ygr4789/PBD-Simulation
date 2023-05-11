import * as THREE from "three";
import { Material, Mesh, Scene } from "three";

let debugPoints: Array<Mesh> = [];

export function plotPoint(scene: THREE.Scene, v: THREE.Vector3) {
  const sphereGeo = new THREE.SphereGeometry(0.03);
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0x0000ff });
  const sphere = new Mesh(sphereGeo, sphereMat);
  sphere.position.copy(v);
  debugPoints.push(sphere)
  scene.add(sphere);
}

export function emphasizePoint(scene: THREE.Scene, v: THREE.Vector3) {
  const sphereGeo = new THREE.SphereGeometry(0.05);
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const sphere = new Mesh(sphereGeo, sphereMat);
  sphere.position.copy(v);
  debugPoints.push(sphere)
  scene.add(sphere);
}

export function cleanPoint() {
  for (let point of debugPoints) {
    point.geometry.dispose();
    (point.material as Material).dispose();
    point.removeFromParent();
  }
  debugPoints = [];
}