import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import * as vec from "./util/vector";
import { SoftBodyObject } from "./softBody";
import { RigidSphere } from "./rigidSphere";

// ================ MOUSE INTERACTION ================

export let cursorPoint = new THREE.Vector3();
export let grabbedMesh: THREE.Object3D | null = null;
export let grabbedVertId = -1;

export function useMouseInteration(
  camera: THREE.Camera,
  control: OrbitControls,
  softbodies: Array<SoftBodyObject>,
  spheres: Array<RigidSphere>
) {
  const mouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const planeNormal = new THREE.Vector3();
  const plane = new THREE.Plane();

  window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, cursorPoint);
  });

  window.addEventListener("mousedown", () => {
    const intersects = raycaster.intersectObjects([...softbodies, ...spheres].map((obj) => obj.mesh));
    if (intersects.length === 0) grabbedMesh = null;
    else {
      let grabbedPoint = intersects[0].point;
      grabbedMesh = intersects[0].object;
      planeNormal.copy(camera.position).normalize();
      plane.setFromNormalAndCoplanarPoint(planeNormal, grabbedPoint);
      control.enabled = false;

      let closestDist = Number.MAX_VALUE;
      for (let soft of softbodies) {
        if (soft.mesh !== grabbedMesh) continue;
        vec.setVec(vec.tmp, 0, grabbedPoint);
        for (let i = 0; i < soft.vert_num; i++) {
          let dist = vec.dist(vec.tmp, 0, soft.positions, i);
          if (closestDist > dist) {
            closestDist = dist;
            grabbedVertId = i;
          }
        }
      }
    }
  });

  window.addEventListener("mouseup", () => {
    grabbedMesh = null;
    control.enabled = true;
  });
}
