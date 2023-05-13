import * as THREE from "three";
import * as vec from "./util/vector";
import { SpatialHash } from "./util/hash";

const hashSpace = 0.05;
const hashSize = 5000;

export type ParsedObjData = {
  name: String;
  verts: Array<number>; // vertex positions in three units.
  tetIds: Array<number>; // the indices of vertices that form tetrahedrons in four units.
  tetEdgeIds: Array<number>; // the indices of vertices that form edges in two units.
  tetSurfaceTriIds: Array<number>; // the indices of vertices that form triangles of surface in three units.
};

// ===================== BOUNDARY =====================

const bound = 5.0;
const bound_num = 5;
// prettier-ignore
const boundPosition = new Float32Array([
  0.0, 0.0, 0.0, // grond
  bound, 0.0, 0.0, // maxX
  -bound, 0.0, 0.0, // minX
  0.0, 0.0, bound, // maxZ
  0.0, 0.0, -bound, // minZ
]);
// prettier-ignore
const boundNormal = new Float32Array([
  0.0, 1.0, 0.0, // grond
  -1.0, 0.0, 0.0, // maxX
  1.0, 0.0, 0.0, // minX
  0.0, 0.0, -1.0, // maxZ
  0.0, 0.0, 1.0, // minZ
]);

// ===================== SOFTBODY =====================

export class SoftBodyObject {
  init_positions: Float32Array;
  prev_positions: Float32Array;
  positions: Float32Array;
  velocities: Float32Array;
  inv_masses: Float32Array;

  surface_ids: Uint16Array;
  tet_ids: Uint16Array;
  edge_ids: Uint16Array;
  init_tet_volumes: Float32Array;
  init_edge_lengths: Float32Array;

  vert_num: number;
  tet_num: number;
  edge_num: number;

  geometry: THREE.BufferGeometry;
  material: THREE.MeshPhongMaterial;
  mesh: THREE.Mesh;

  edge_geometry: THREE.BufferGeometry;
  edges: THREE.LineSegments;

  spatial_hash: SpatialHash;
  hash_space: number;
  is_surface_vert: Array<boolean>;
  is_surface_tet: Array<boolean>;
  vert_tets: Array<Array<number>>;

  constructor(file: ParsedObjData, scene_: THREE.Scene) {
    this.init_positions = new Float32Array(file.verts);
    this.prev_positions = new Float32Array(file.verts);
    this.positions = new Float32Array(file.verts);
    this.velocities = new Float32Array(file.verts.length);
    this.vert_num = file.verts.length / 3;

    this.tet_ids = new Uint16Array(file.tetIds);
    this.surface_ids = new Uint16Array(file.tetSurfaceTriIds);
    this.edge_ids = new Uint16Array(file.tetEdgeIds);
    this.tet_num = this.tet_ids.length / 4;
    this.edge_num = this.edge_ids.length / 2;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setIndex(new THREE.BufferAttribute(this.surface_ids, 1));
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));

    const color = new THREE.Color(Math.random(), Math.random(), Math.random());
    this.material = new THREE.MeshPhongMaterial({ color });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.geometry.computeVertexNormals();
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    scene_.add(this.mesh);

    this.edge_geometry = new THREE.BufferGeometry();
    this.edge_geometry.setIndex(new THREE.BufferAttribute(this.edge_ids, 1));
    this.edge_geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));

    this.edges = new THREE.LineSegments(this.edge_geometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    // scene_.add(this.edges);

    
    // Calculate Constrains
    this.vert_tets = new Array(this.vert_num);
    this.inv_masses = new Float32Array(this.vert_num);
    for (let i = 0; i < this.vert_num; i++) this.vert_tets[i] = new Array();
    this.init_tet_volumes = new Float32Array(this.tet_num);
    
    this.is_surface_vert = new Array(this.vert_num);
    this.is_surface_vert.fill(false);
    for (let id of file.tetSurfaceTriIds) this.is_surface_vert[id] = true;

    this.hash_space = hashSpace;
    this.is_surface_tet = new Array(this.tet_num);
    this.is_surface_tet.fill(false);
    for (let i = 0; i < this.tet_num; i++) {
      let x = new Float32Array(4);
      let cnt = 0;
      for (let j = 0; j < 4; j++) {
        x[j] = this.tet_ids[4 * i + j];
        this.vert_tets[x[j]].push(i);
        if(this.is_surface_vert[x[j]]) cnt++;
      }
      if(cnt === 3) this.is_surface_tet[i] = true;

      for (let j = 0; j < 4; j++) {
        vec.sub(vec.seg, j, this.positions, x[(j + 1) % 4], this.positions, x[j % 4]);
      }

      vec.cross(vec.tmp, 0, vec.seg, 0, vec.seg, 1);
      this.init_tet_volumes[i] = vec.dot(vec.tmp, 0, vec.seg, 2) / 6;

      for (let j = 0; j < 4; j++) {
        this.inv_masses[x[j]] += this.init_tet_volumes[i] / 4;
      }
    }
    this.inv_masses.forEach((val, i, arr) => {
      arr[i] = 1 / val;
    });

    this.init_edge_lengths = new Float32Array(this.edge_num);
    for (let i = 0; i < this.edge_num; i++) {
      let x = new Float32Array(2);
      for (let j = 0; j < 2; j++) {
        x[j] = this.edge_ids[2 * i + j];
      }
      this.init_edge_lengths[i] = vec.dist(this.positions, x[0], this.positions, x[1]);
    }
    this.spatial_hash = new SpatialHash(this.positions, this.hash_space, hashSize);
  }

  renderUpdate() {
    this.geometry.computeVertexNormals();
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeBoundingSphere();

    this.edge_geometry.computeVertexNormals();
    this.edge_geometry.attributes.position.needsUpdate = true;
    this.edge_geometry.computeBoundingSphere();
  }

  applyStates(dt: number, gravity: number) {
    this.positions.forEach((value, i) => {
      this.prev_positions[i] = value;
    });
    for (let i = 0; i < this.vert_num; i++) {
      this.velocities[3 * i + 1] -= gravity * dt;
    }
    this.velocities.forEach((value, i) => {
      this.positions[i] += value * dt;
    });
  }
  grabInteract(dt: number, target: THREE.Vector3, id: number) {
    vec.setVec(this.positions, id, target);
  }
  solveTetConstraints(dt: number) {
    for (let i = 0; i < this.tet_num; i++) {
      let x = new Uint16Array(4);
      let w = new Float32Array(4);
      for (let j = 0; j < 4; j++) {
        x[j] = this.tet_ids[4 * i + j];
        w[j] = this.inv_masses[x[j]];
      }

      for (let j = 0; j < 4; j++) {
        vec.sub(vec.seg, j, this.positions, x[(j + 1) % 4], this.positions, x[j % 4]);
      }
      vec.cross(vec.tmp, 0, vec.seg, 0, vec.seg, 1);
      let V = vec.dot(vec.tmp, 0, vec.seg, 2) / 6;
      let V0 = this.init_tet_volumes[i];

      let denom = 0;
      let dir = new Float32Array([1.0, -1.0, 1.0, -1.0]);
      for (let j = 0; j < 4; j++) {
        vec.cross(vec.tmp, j, vec.seg, (j + 1) % 4, vec.seg, (j + 2) % 4);
        vec.scale(vec.tmp, j, dir[j]);
        denom += vec.normSquare(vec.tmp, j) * w[j];
      }
      if (denom == 0.0) continue;

      let lambda = (6.0 * (V - V0)) / denom;
      for (let j = 0; j < 4; j++) {
        vec.addi(this.positions, x[j], vec.tmp, j, lambda * w[j]);
      }
    }
  }
  solveEdgeConstraints(dt: number, alpha: number) {
    for (let i = 0; i < this.edge_num; i++) {
      let x = new Uint16Array(2);
      let w = new Float32Array(2);
      for (let j = 0; j < 2; j++) {
        x[j] = this.edge_ids[2 * i + j];
        w[j] = this.inv_masses[x[j]];
      }

      vec.sub(vec.tmp, 0, this.positions, x[1], this.positions, x[0]);
      let L = vec.norm(vec.tmp, 0);
      let L0 = this.init_edge_lengths[i];
      vec.scale(vec.tmp, 0, 1 / L);
      let alpha_ = alpha / dt ** 2;
      let denom = w[0] + w[1] + alpha_;
      if (denom === 0.0) continue;
      let lambda = (L - L0) / denom;

      vec.addi(this.positions, x[0], vec.tmp, 0, lambda * w[0]);
      vec.addi(this.positions, x[1], vec.tmp, 0, -lambda * w[1]);
    }
  }

  handleBoundaries() {
    for (let i = 0; i < this.vert_num; i++) {
      for (let k = 0; k < bound_num; k++) {
        vec.sub(vec.tmp, 0, this.positions, i, boundPosition, k);
        let gap = vec.dot(vec.tmp, 0, boundNormal, k);
        if (gap < 0) {
          vec.addi(this.positions, i, boundNormal, k, -gap);
        }
        if (gap < 0.01) {
          for (let j = 0; j < 3; j++) {
            this.velocities[i * 3 + j] *= -0.5 * boundNormal[j];
          }
        }
      }
    }
  }

  updateStates(dt: number) {
    for (let i = 0; i < this.vert_num; i++) {
      vec.sub(this.velocities, i, this.positions, i, this.prev_positions, i);
      vec.scale(this.velocities, i, 1.0 / dt);
    }
  }

  initLocation(x: number, y: number, z: number) {
    for (let i = 0; i < this.vert_num; i++) {
      this.positions[3 * i] = this.init_positions[3 * i] + x;
      this.positions[3 * i + 1] = this.init_positions[3 * i + 1] + y;
      this.positions[3 * i + 2] = this.init_positions[3 * i + 2] + z;
    }
  }
}
