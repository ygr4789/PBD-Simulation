import * as vec from "./util/vector";

import { SoftBodyObject } from "./softBody";
import { RigidSphereObject } from "./rigidSphere";

const restitution = 0.1;

export function checkCollision(obj1: SoftBodyObject | RigidSphereObject, obj2: SoftBodyObject | RigidSphereObject) {
  if (obj1 === obj2) return false;
  if (obj1 instanceof SoftBodyObject && obj2 instanceof SoftBodyObject) {
    return checkSoftToSoftCollision(obj1, obj2);
  } else if (obj1 instanceof SoftBodyObject && obj2 instanceof RigidSphereObject) {
    return checkSoftToRigidCollision(obj1, obj2);
  } else if (obj1 instanceof RigidSphereObject && obj2 instanceof SoftBodyObject) {
    return checkSoftToRigidCollision(obj2, obj1);
  } else if (obj1 instanceof RigidSphereObject && obj2 instanceof RigidSphereObject) {
    return checkRigidToRigidCollision(obj1, obj2);
  }
  return false;
}

export function solveCollision(
  obj1: SoftBodyObject | RigidSphereObject,
  obj2: SoftBodyObject | RigidSphereObject,
  dt: number
) {
  if (obj1 === obj2) return;
  if (obj1 instanceof SoftBodyObject && obj2 instanceof SoftBodyObject) {
    solveSoftToSoftCollision(obj1, obj2);
  } else if (obj1 instanceof SoftBodyObject && obj2 instanceof RigidSphereObject) {
    solveSoftToRigidCollision(obj1, obj2, dt);
  } else if (obj1 instanceof RigidSphereObject && obj2 instanceof SoftBodyObject) {
    solveSoftToRigidCollision(obj2, obj1, dt);
  } else if (obj1 instanceof RigidSphereObject && obj2 instanceof RigidSphereObject) {
    solveRigidToRigidCollision(obj1, obj2);
  }
}

// ===================== CHECK COLLISION ====================

function checkRigidToRigidCollision(obj1: RigidSphereObject, obj2: RigidSphereObject) {
  let dist = obj1.position.distanceTo(obj2.position);
  let minDist = obj1.radius + obj2.radius;
  return dist < minDist;
}

function checkSoftToRigidCollision(soft: SoftBodyObject, rigid: RigidSphereObject) {
  for (let i = 0; i < soft.vert_num; i++) {
    vec.setVec(vec.tmp, 0, rigid.position);
    vec.subi(vec.tmp, 0, soft.positions, i);
    let gap = vec.norm(vec.tmp, 0) - rigid.radius;
    if (gap < 0) return true;
  }
  return false;
}

function checkSoftToSoftCollision(obj1: SoftBodyObject, obj2: SoftBodyObject) {
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

// ===================== SOLVE COLLISION ====================

function solveSoftToSoftCollision(obj1: SoftBodyObject, obj2: SoftBodyObject) {
  for (let i = 0; i < obj2.vert_num; i++) {
    let closeIds = obj1.spatial_hash.query(obj2.positions, i, obj1.hash_space);
    // let closeIds = Array.from(Array(obj1.edge_num).keys());

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
          vec.cross(vec.tmp, 3, vec.seg, 2, vec.seg, 1);
          let C = Math.abs(vec.dot(vec.tmp, 3, vec.seg, 0));

          if (vec.dot(vec.tmp, 3, vec.seg, 0) < 0) vec.scale(vec.tmp, 3, -1);
          let denom = vec.normSquare(vec.tmp, 3) * obj2.inv_masses[i];

          vec.sub(vec.seg, 1, obj1.positions, s[1], obj2.positions, i);
          vec.sub(vec.seg, 2, obj1.positions, s[2], obj2.positions, i);
          for (let k = 0; k < 3; k++) {
            vec.cross(vec.tmp, k, vec.seg, (k + 1) % 3, vec.seg, (k + 2) % 3);
            if (vec.dot(vec.tmp, k, vec.seg, k) > 0) vec.scale(vec.tmp, k, -1);
            denom += vec.normSquare(vec.tmp, k) * obj1.inv_masses[s[k]];
          }
          if (denom === 0.0) return;

          let lambda = C / denom;
          vec.addi(obj2.positions, i, vec.tmp, 3, lambda * obj2.inv_masses[i]);
          for (let k = 0; k < 3; k++) {
            vec.addi(obj1.positions, s[j], vec.tmp, j, lambda * obj1.inv_masses[s[j]]);
          }
          return;
        });
      }
    });
  }
}

function solveSoftToRigidCollision(soft: SoftBodyObject, rigid: RigidSphereObject, dt: number) {
  for (let i = 0; i < soft.vert_num; i++) {
    vec.setVec(vec.tmp, 0, rigid.position);
    vec.subi(vec.tmp, 0, soft.positions, i);
    let gap = vec.norm(vec.tmp, 0) - rigid.radius;
    if (gap < 0) {
      vec.normalize(vec.tmp, 0);
      vec.scale(vec.tmp, 0, gap);
      vec.mv(vec.tmp, 1, soft.positions, i);
      vec.addi(soft.positions, i, vec.tmp, 0);
      let dx = vec.dist(vec.tmp, 1, soft.positions, i);
      let I = dx / dt / soft.inv_masses[i];

      rigid.velocity.sub(vec.toVec(vec.tmp, 0).multiplyScalar(I * rigid.inv_mass));
    }
  }
}

function solveRigidToRigidCollision(obj1: RigidSphereObject, obj2: RigidSphereObject) {
  const dir = obj2.position.clone().sub(obj1.position);
  const gap = dir.length() - obj2.radius - obj1.radius;
  const relProj = dir.dot(obj2.velocity.clone().sub(obj1.velocity));
  dir.normalize();
  let w1 = obj1.inv_mass;
  let w2 = obj2.inv_mass;
  let lamba = (1 + restitution) / (w1 + w2);
  if (gap < 0.01 && relProj < 0) {
    obj1.velocity.add(dir.clone().multiplyScalar(relProj * lamba * w1));
    obj2.velocity.add(dir.clone().multiplyScalar(-relProj * lamba * w2));
  }
  if (gap < 0) {
    obj2.position.add(dir.clone().multiplyScalar(-gap));
  }
}
