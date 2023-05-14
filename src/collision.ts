import * as vec from "./util/vector";

import { SoftBodyObject, ParsedObjData } from "./softBody";
import { RigidSphere } from "./rigidSphere";

// ===================== COLLISION ====================

export function checkCollision1(obj1: SoftBodyObject, obj2: SoftBodyObject) {
  if (obj2 === obj1) return false;
  for (let i = 0; i < obj2.vert_num; i++) {
    for (let j = 0; j < obj1.tet_num; j++) {
      let p = new Float32Array(4);

      for (let k = 0; k < 4; k++) {
        p[k] = obj1.tet_ids[4 * j + k];
      }

      for (let k = 0; k < 3; k++) {
        vec.sub(vec.seg, k, obj1.positions, p[k], obj1.positions, p[3]);
      }
      vec.sub(vec.tmp, 0, obj2.positions, i, obj1.positions, p[3]);
      vec.setMat(vec.seg, 0, vec.seg, 1, vec.seg, 2);
      let det = vec.invMat();
      if (det == 0.0) continue;
      vec.applyMat(vec.tmp, 0);

      let isInTet = true;
      let w = vec.toArr(vec.tmp, 0);
      if (1 - w[0] - w[1] - w[2] < 0) isInTet = false;
      w.forEach((val) => {
        if (val < 0) isInTet = false;
      });
      if (isInTet) return true;
    }
  }
  return false;
}

export function solveCollision1(obj1: SoftBodyObject, obj2: SoftBodyObject) {
  if (obj2 === obj1) return;
  for (let i = 0; i < obj2.vert_num; i++) {
    let closeIds = obj1.spatial_hash.query(obj2.positions, i, obj1.hash_space);
    // let closeIds_naive = Array.from(Array(obj1.edge_num).keys());

    closeIds.forEach((constId) => {
      if (!obj1.is_surface_vert[constId]) return;
      else {
        obj1.vert_tets[constId].forEach((j) => {
          if (!obj1.is_surface_tet[j]) return;
          let cnt = 0;
          let s = new Float32Array(4);
          let p = new Float32Array(4);

          for (let k = 0; k < 4; k++) {
            p[k] = obj1.tet_ids[4 * j + k];
            if (obj1.is_surface_vert[p[k]]) s[cnt++] = p[k];
          }

          for (let k = 0; k < 3; k++) {
            vec.sub(vec.seg, k, obj1.positions, p[k], obj1.positions, p[3]);
          }
          vec.sub(vec.tmp, 0, obj2.positions, i, obj1.positions, p[3]);
          vec.setMat(vec.seg, 0, vec.seg, 1, vec.seg, 2);
          let det = vec.invMat();
          if (det === 0) return;
          vec.applyMat(vec.tmp, 0);

          for (let k = 0; k < 3; k++) {
            if (vec.tmp[k] < 0) return;
          }
          if (vec.tmp[0] + vec.tmp[1] + vec.tmp[2] > 1) return;

          vec.sub(vec.seg, 0, obj1.positions, s[0], obj2.positions, i);
          vec.sub(vec.seg, 1, obj1.positions, s[1], obj1.positions, s[0]);
          vec.sub(vec.seg, 2, obj1.positions, s[2], obj1.positions, s[1]);
          vec.cross(vec.tmp, 0, vec.seg, 2, vec.seg, 1);
          vec.normalize(vec.tmp, 0);
          var mag = vec.dot(vec.tmp, 0, vec.seg, 0);
          vec.scale(vec.tmp, 0, mag);

          let m1 = 0,
            m2 = 1 / obj2.inv_masses[i];
          for (let k = 0; k < 4; k++) {
            m1 += 1 / obj1.inv_masses[k];
          }

          for (let k = 0; k < 4; k++) {
            vec.subi(obj1.positions, p[k], vec.tmp, 0, m2 / 4 / (m1 + m2));
          }
          vec.addi(obj2.positions, i, vec.tmp, 0, m1 / (m1 + m2));
          return;
        });
      }
    });
  }
}

// ===================== COLLISION ====================

export function checkCollision2(soft: SoftBodyObject, rigid: RigidSphere) {
  for (let i = 0; i < soft.vert_num; i++) {
    vec.setVec(vec.tmp, 0, rigid.position);
    vec.subi(vec.tmp, 0, soft.positions, i);
    let gap = vec.norm(vec.tmp, 0) - rigid.radius;
    if (gap < 0) return true;
  }
  return false;
}

export function solveCollision2(soft: SoftBodyObject, rigid: RigidSphere, dt: number) {
  for (let i = 0; i < soft.vert_num; i++) {
    vec.setVec(vec.tmp, 0, rigid.position);
    vec.subi(vec.tmp, 0, soft.positions, i);
    let gap = vec.norm(vec.tmp, 0) - rigid.radius;
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
