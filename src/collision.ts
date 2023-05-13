import * as vec from "./vector";

import { SoftBodyObject, ParsedObjData } from "./softBody";
import { RigidSphere } from "./rigidSphere";

// ===================== COLLISION ====================

export function solveCollision1(obj1: SoftBodyObject, obj2: SoftBodyObject) {
  if (obj2 === obj1) return;
  for (let i = 0; i < obj2.vert_num; i++) {
    if (obj2.is_surface[i]) continue;

    let closeIds = obj1.spatial_hash.query(obj2.positions, i, obj1.hash_space);

    let constIds = closeIds.reduce((prev, curr) => {
      return [...prev, ...obj1.vert_tets[curr]];
    }, []);

    constIds.forEach((j) => {
      let cnt = 0;
      let s = new Float32Array(4);
      let p = new Float32Array(4);

      for (let k = 0; k < 4; k++) {
        p[k] = obj1.tet_ids[4 * j + k];
        if (obj1.is_surface[p[k]]) s[cnt++] = p[k];
      }
      if (cnt !== 3) return;

      for (let k = 0; k < 3; k++) {
        vec.sub(vec.seg, k, obj1.positions, p[k], obj1.positions, p[3]);
      }
      vec.sub(vec.tmp, 0, obj2.positions, i, obj1.positions, p[3]);
      vec.setMat(vec.seg, 0, vec.seg, 1, vec.seg, 2);
      let det = vec.invMat();
      if (det == 0.0) return;
      vec.applyMat(vec.tmp, 0);

      let isInTet = true;
      let w = vec.toArr(vec.tmp, 0);
      if (1 - w[0] - w[1] - w[2] < 0) isInTet = false;
      w.forEach((val) => {
        if (val < 0) isInTet = false;
      });
      if (!isInTet) return;

      vec.sub(vec.seg, 0, obj1.positions, s[0], obj2.positions, i);
      vec.sub(vec.seg, 1, obj1.positions, s[1], obj1.positions, s[0]);
      vec.sub(vec.seg, 2, obj1.positions, s[2], obj1.positions, s[1]);
      vec.cross(vec.tmp, 0, vec.seg, 2, vec.seg, 1);
      vec.normalize(vec.tmp, 0);
      var mag = vec.dot(vec.tmp, 0, vec.seg, 0);
      vec.scale(vec.tmp, 0, mag);
      for (let k = 0; k < 4; k++) {
        vec.subi(obj1.positions, p[k], vec.tmp, 0, 2);
      }
      vec.addi(obj2.positions, i, vec.tmp, 0, 2);
      return;
    });
  }
}

export function solveCollision2(soft: SoftBodyObject, rigid: RigidSphere, dt: number) {
  for (let i = 0; i < soft.vert_num; i++) {
    vec.setVec(vec.tmp, 0, rigid.position);
    vec.subi(vec.tmp, 0, soft.positions, i);
    let gap = vec.norm(vec.tmp, 0) - rigid.radius;
    // if(i === 0)console.log(gap);
    if (gap < 0) {
      console.log("detect");
      vec.normalize(vec.tmp, 0);
      vec.scale(vec.tmp, 0, gap);
      vec.mv(vec.tmp, 1, soft.positions, i);
      vec.addi(soft.positions, i, vec.tmp, 0);
      let dx = vec.dist(vec.tmp, 1, soft.positions, i);
      let I = dx / dt / soft.inv_masses[i];

      rigid.velocity.sub(vec.toVec(vec.tmp, 0).multiplyScalar(I * rigid.invMass));
    }
  }
}