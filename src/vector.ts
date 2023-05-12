import * as THREE from "three";

export const tmp = new Float32Array(96);
export const seg = new Float32Array(96);

export function set(rd: Float32Array, i: number, x: number, y: number, z: number) {
  rd[3 * i] = x;
  rd[3 * i + 1] = y;
  rd[3 * i + 2] = z;
}

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

export function sub(rd: Float32Array, i0: number, rs1: Float32Array, i1: number, rs2: Float32Array, i2: number) {
  rd[3 * i0] = rs1[3 * i1] - rs2[3 * i2];
  rd[3 * i0 + 1] = rs1[3 * i1 + 1] - rs2[3 * i2 + 1];
  rd[3 * i0 + 2] = rs1[3 * i1 + 2] - rs2[3 * i2 + 2];
}
export function subi(rd: Float32Array, i0: number, rs: Float32Array, i1: number) {
  rd[3 * i0] -= rs[3 * i1];
  rd[3 * i0 + 1] -= rs[3 * i1 + 1];
  rd[3 * i0 + 2] -= rs[3 * i1 + 2];
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

export function printPoint(rd1: Float32Array, i1: number, rd2: Float32Array | undefined = undefined, i2: number = 0, rd3: Float32Array | undefined = undefined, i3: number = 0) {
  if (rd2 === undefined) console.log(i1, [rd1[3 * i1], rd1[3 * i1 + 1], rd1[3 * i1 + 2]]);
  if (rd2 !== undefined && rd3 === undefined) console.log([rd1[3 * i1], rd1[3 * i1 + 1], rd1[3 * i1 + 2]], [rd2[3 * i2], rd2[3 * i2 + 1], rd2[3 * i2 + 2]]);
  if (rd2 !== undefined && rd3 !== undefined) console.log([rd1[3 * i1], rd1[3 * i1 + 1], rd1[3 * i1 + 2]], [rd2[3 * i2], rd2[3 * i2 + 1], rd2[3 * i2 + 2]], [rd3[3 * i3], rd3[3 * i3 + 1], rd3[3 * i3 + 2]]);
}

export function toArr(rd: Float32Array, i: number) {
  return new Float32Array([rd[3 * i], rd[3 * i + 1], rd[3 * i + 2]]);
}
export function toVec(rd: Float32Array, i: number) {
  return new THREE.Vector3(rd[3 * i], rd[3 * i + 1], rd[3 * i + 2]);
}
export function setByVec(rd: Float32Array, i: number, v: THREE.Vector3) {
  rd[3 * i] = v.x;
  rd[3 * i + 1] = v.y;
  rd[3 * i + 2] = v.z;
}