import * as THREE from "three";
import { Material, Mesh, Scene, Line } from "three";

let debugPoints: Array<Mesh> = [];
let debugLines: Array<Line> = [];

export function plotPoint(scene: THREE.Scene, v: THREE.Vector3) {
  const sphereGeo = new THREE.SphereGeometry(0.03);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  const sphere = new Mesh(sphereGeo, sphereMat);
  sphere.position.copy(v);
  debugPoints.push(sphere);
  scene.add(sphere);
}

export function plotLine(scene: THREE.Scene, v1: THREE.Vector3, v2: THREE.Vector3) {
  const points = [];
  points.push(v1);
  points.push(v2);
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const line = new THREE.Line(lineGeo, lineMat);
  debugLines.push(line);
  scene.add(line);
}

export function emphasizePoint(scene: THREE.Scene, v: THREE.Vector3, color = 0xff0000) {
  const sphereGeo = new THREE.SphereGeometry(0.05);
  const sphereMat = new THREE.MeshBasicMaterial({ color });
  const sphere = new Mesh(sphereGeo, sphereMat);
  sphere.position.copy(v);
  debugPoints.push(sphere);
  scene.add(sphere);
}

export function cleanAll() {
  for (let point of debugPoints) {
    point.geometry.dispose();
    (point.material as Material).dispose();
    point.removeFromParent();
  }
  debugPoints = [];
  for (let line of debugLines) {
    line.geometry.dispose();
    (line.material as Material).dispose();
    line.removeFromParent();
  }
  debugLines = [];
}
