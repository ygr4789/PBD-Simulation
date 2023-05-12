import * as THREE from "three";

export const tmp = new Float32Array(96);
export const seg = new Float32Array(96);
export const mat = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

export function add(rd: Float32Array, i0: number, rs1: Float32Array, i1: number, rs2: Float32Array, i2: number, scale = 1) {
  rd[3 * i0] = rs1[3 * i1] + rs2[3 * i2] * scale;
  rd[3 * i0 + 1] = rs1[3 * i1 + 1] + rs2[3 * i2 + 1] * scale;
  rd[3 * i0 + 2] = rs1[3 * i1 + 2] + rs2[3 * i2 + 2] * scale;
}
export function addi(rd: Float32Array, i0: number, rs: Float32Array, i1: number, scale = 1) {
  rd[3 * i0] += rs[3 * i1] * scale;
  rd[3 * i0 + 1] += rs[3 * i1 + 1] * scale;
  rd[3 * i0 + 2] += rs[3 * i1 + 2] * scale;
}

export function sub(rd: Float32Array, i0: number, rs1: Float32Array, i1: number, rs2: Float32Array, i2: number, scale = 1) {
  rd[3 * i0] = rs1[3 * i1] - rs2[3 * i2] * scale;
  rd[3 * i0 + 1] = rs1[3 * i1 + 1] - rs2[3 * i2 + 1] * scale;
  rd[3 * i0 + 2] = rs1[3 * i1 + 2] - rs2[3 * i2 + 2] * scale;
}
export function subi(rd: Float32Array, i0: number, rs: Float32Array, i1: number, scale = 1) {
  rd[3 * i0] -= rs[3 * i1] * scale;
  rd[3 * i0 + 1] -= rs[3 * i1 + 1] * scale;
  rd[3 * i0 + 2] -= rs[3 * i1 + 2] * scale;
}

export function mv(rd: Float32Array, i0: number, rs: Float32Array, i1: number) {
  rd[3 * i0] = rs[3 * i1];
  rd[3 * i0 + 1] = rs[3 * i1 + 1];
  rd[3 * i0 + 2] = rs[3 * i1 + 2];
}

export function cross(rd: Float32Array, i0: number, rs1: Float32Array, i1: number, rs2: Float32Array, i2: number) {
  rd[3 * i0] = rs1[3 * i1 + 1] * rs2[3 * i2 + 2] - rs1[3 * i1 + 2] * rs2[3 * i2 + 1];
  rd[3 * i0 + 1] = rs1[3 * i1 + 2] * rs2[3 * i2] - rs1[3 * i1] * rs2[3 * i2 + 2];
  rd[3 * i0 + 2] = rs1[3 * i1] * rs2[3 * i2 + 1] - rs1[3 * i1 + 1] * rs2[3 * i2];
}
export function crossi(rd: Float32Array, i0: number, rs: Float32Array, i1: number) {
  rd[3 * i0] = rd[3 * i0 + 1] * rs[3 * i1 + 2] - rd[3 * i0 + 2] * rs[3 * i1 + 1];
  rd[3 * i0 + 1] = rd[3 * i0 + 2] * rs[3 * i1] - rd[3 * i0] * rs[3 * i1 + 2];
  rd[3 * i0 + 2] = rd[3 * i0] * rs[3 * i1 + 1] - rd[3 * i0 + 1] * rs[3 * i1];
}

export function distSquare(rs1: Float32Array, i1: number, rs2: Float32Array, i2: number) {
  return (rs1[3 * i1] - rs2[3 * i2]) ** 2 + (rs1[3 * i1 + 1] - rs2[3 * i2 + 1]) ** 2 + (rs1[3 * i1 + 2] - rs2[3 * i2 + 2]) ** 2;
}
export function dist(rs1: Float32Array, i1: number, rs2: Float32Array, i2: number) {
  return Math.sqrt(distSquare(rs1, i1, rs2, i2));
}

export function dot(rs1: Float32Array, i1: number, rs2: Float32Array, i2: number) {
  return rs1[3 * i1] * rs2[3 * i2] + rs1[3 * i1 + 1] * rs2[3 * i2 + 1] + rs1[3 * i1 + 2] * rs2[3 * i2 + 2];
}

export function normSquare(rs: Float32Array, i: number) {
  return dot(rs, i, rs, i);
}
export function norm(rs: Float32Array, i: number) {
  return Math.sqrt(normSquare(rs, i));
}

export function scale(rd: Float32Array, i: number, s: number) {
  rd[3 * i] *= s;
  rd[3 * i + 1] *= s;
  rd[3 * i + 2] *= s;
}

export function normalize(rd: Float32Array, i: number) {
  scale(rd, i, 1 / norm(rd, i));
}

export function applyMat(rd: Float32Array, i: number) {
  let x = rd[3 * i + 0];
  let y = rd[3 * i + 1];
  let z = rd[3 * i + 2];
  rd[0] = x * mat[0] + y * mat[3] + z * mat[6];
  rd[1] = x * mat[1] + y * mat[4] + z * mat[7];
  rd[2] = x * mat[2] + y * mat[5] + z * mat[8];
}

export function setMat(e1: Float32Array, i1: number, e2: Float32Array, i2: number, e3: Float32Array, i3: number) {
  mat[0] = e1[3 * i1];
  mat[3] = e1[3 * i1 + 1];
  mat[6] = e1[3 * i1 + 2];
  mat[1] = e2[3 * i2];
  mat[4] = e2[3 * i2 + 1];
  mat[7] = e2[3 * i2 + 2];
  mat[2] = e3[3 * i3];
  mat[5] = e3[3 * i3 + 1];
  mat[8] = e3[3 * i3 + 2];
}

export function invMat() {
  let a00 = mat[0];
  let a01 = mat[1];
  let a02 = mat[2];
  let a10 = mat[3];
  let a11 = mat[4];
  let a12 = mat[5];
  let a20 = mat[6];
  let a21 = mat[7];
  let a22 = mat[8];
  let b01 = a22 * a11 - a12 * a21;
  let b11 = -a22 * a10 + a12 * a20;
  let b21 = a21 * a10 - a11 * a20;
  // Calculate the determinant
  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (!det) return 0.0;
  det = 1.0 / det;
  mat[0] = b01 * det;
  mat[1] = (-a22 * a01 + a02 * a21) * det;
  mat[2] = (a12 * a01 - a02 * a11) * det;
  mat[3] = b11 * det;
  mat[4] = (a22 * a00 - a02 * a20) * det;
  mat[5] = (-a12 * a00 + a02 * a10) * det;
  mat[6] = b21 * det;
  mat[7] = (-a21 * a00 + a01 * a20) * det;
  mat[8] = (a11 * a00 - a01 * a10) * det;
  return det;
}

export function toArr(rd: Float32Array, i: number) {
  return new Float32Array([rd[3 * i], rd[3 * i + 1], rd[3 * i + 2]]);
}
export function toVec(rd: Float32Array, i: number) {
  return new THREE.Vector3(rd[3 * i], rd[3 * i + 1], rd[3 * i + 2]);
}
export function setVec(rd: Float32Array, i: number, v: THREE.Vector3) {
  rd[3 * i] = v.x;
  rd[3 * i + 1] = v.y;
  rd[3 * i + 2] = v.z;
}
