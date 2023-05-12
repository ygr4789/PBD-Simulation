import * as dat from "dat.gui";
import * as Stats from "stats.js";
import * as THREE from "three";
import * as glm from "gl-matrix";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SpatialHash } from "./hash";
import * as vec from "./vector";

import { plotPoint, cleanAll, plotLine, emphasizePoint } from "./debug";

import "./style/style.css";

const scene = new THREE.Scene();
const setcolor = 0xa0a0e0;
scene.background = new THREE.Color(setcolor);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
// renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000.0);
camera.position.set(1, 1, 2);

const orbitControl = new OrbitControls(camera, renderer.domElement);
orbitControl.listenToKeyEvents(window);

function window_onsize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onresize = window_onsize;

// ================ Light setting ================

const ambientLight = new THREE.AmbientLight(0x9090a0, 1.0);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(30, 30, 0);
dirLight.castShadow = true;
scene.add(dirLight);

// ================ Creating Ground ================

const bound = 5.0;

const groundGeo = new THREE.PlaneGeometry(2 * bound, 2 * bound, 1, 1);
const groundMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 155, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI * 0.5;
ground.receiveShadow = true;
const grid = new THREE.GridHelper(2 * bound, 2 * bound);
(grid.material as THREE.Material).opacity = 1.0;
(grid.material as THREE.Material).transparent = true;
grid.position.set(0, 0.002, 0);

// scene.add(grid);
scene.add(ground);

// ===================== BOUNDARY =====================

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

class SoftBodyObject {
  prev_positions: Float32Array;
  positions: Float32Array;
  velocities: Float32Array;
  inv_masses: Float32Array;

  surface_ids: Uint16Array;
  tet_ids: Uint16Array;
  edge_idss: Uint16Array;
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
  is_surface: Array<boolean>;
  vert_tets: Array<Array<number>>;

  constructor(file: parsedData, _scene: THREE.Scene) {
    this.prev_positions = new Float32Array(file.verts);
    this.positions = new Float32Array(file.verts);
    this.velocities = new Float32Array(file.verts.length);
    this.vert_num = file.verts.length / 3;

    this.tet_ids = new Uint16Array(file.tetIds);
    this.surface_ids = new Uint16Array(file.tetSurfaceTriIds);
    this.edge_idss = new Uint16Array(file.tetEdgeIds);
    this.tet_num = this.tet_ids.length / 4;
    this.edge_num = this.edge_idss.length / 2;

    this.spatial_hash = new SpatialHash(this.positions, hashSpacing, hashSize);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setIndex(new THREE.BufferAttribute(this.surface_ids, 1));
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));

    const color = new THREE.Color(Math.random(), Math.random(), Math.random());
    this.material = new THREE.MeshPhongMaterial({ color });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.geometry.computeVertexNormals();
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    _scene.add(this.mesh);

    this.edge_geometry = new THREE.BufferGeometry();
    this.edge_geometry.setIndex(new THREE.BufferAttribute(this.edge_idss, 1));
    this.edge_geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));

    this.edges = new THREE.LineSegments(this.edge_geometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    // _scene.add(this.edges);

    this.is_surface = new Array(this.vert_num);
    for (let id of file.tetSurfaceTriIds) this.is_surface[id] = true;

    // constraints
    this.vert_tets = new Array(this.vert_num);
    this.inv_masses = new Float32Array(this.vert_num);
    for (let i = 0; i < this.vert_num; i++) this.vert_tets[i] = new Array();
    this.init_tet_volumes = new Float32Array(this.tet_num);

    for (let i = 0; i < this.tet_num; i++) {
      let x = new Float32Array(4);
      for (let j = 0; j < 4; j++) {
        x[j] = this.tet_ids[4 * i + j];
        this.vert_tets[x[j]].push(i);
      }

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
        x[j] = this.edge_idss[2 * i + j];
      }
      this.init_edge_lengths[i] = vec.dist(this.positions, x[0], this.positions, x[1]);
    }
  }

  renderUpdate() {
    this.geometry.computeVertexNormals();
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeBoundingSphere();

    this.edge_geometry.computeVertexNormals();
    this.edge_geometry.attributes.position.needsUpdate = true;
    this.edge_geometry.computeBoundingSphere();
  }

  applyStates(dt: number) {
    this.positions.forEach((value, i) => {
      this.prev_positions[i] = value;
    });
    for (let i = 0; i < this.vert_num; i++) {
      this.velocities[3 * i + 1] -= controls.gravity * dt;
    }
    for (let i = 0; i < this.vert_num; i++) {
      for (let k = 0; k < boundPositions.length; k++) {
        vec.sub(vec.tmp, 0, this.positions, i, boundPosition, k);
        let gap = vec.dot(vec.tmp, 0, boundNormal, k);
        if (gap < 0) {
          vec.scale(this.velocities, i, 1 - controls.friction);
        }
      }
    }
    this.velocities.forEach((value, i) => {
      this.positions[i] += value * dt;
    });
  }
  grabInteract() {
    vec.setVec(this.positions, grabbedVertId, cursorPoint);
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
  solveEdgeConstraints(dt: number) {
    for (let i = 0; i < this.edge_num; i++) {
      let x = new Uint16Array(2);
      let w = new Float32Array(2);
      for (let j = 0; j < 2; j++) {
        x[j] = this.edge_idss[2 * i + j];
        w[j] = this.inv_masses[x[j]];
      }

      vec.sub(vec.tmp, 0, this.positions, x[1], this.positions, x[0]);
      let L = vec.norm(vec.tmp, 0);
      let L0 = this.init_edge_lengths[i];
      vec.scale(vec.tmp, 0, 1 / L);
      const alpha = controls.invStiffness / dt ** 2;
      let denom = w[0] + w[1] + alpha;
      if (denom === 0.0) continue;
      let lambda = (L - L0) / denom;

      vec.addi(this.positions, x[0], vec.tmp, 0, lambda * w[0]);
      vec.addi(this.positions, x[1], vec.tmp, 0, -lambda * w[1]);
    }

    for (let i = 0; i < this.vert_num; i++) {
      for (let k = 0; k < boundPositions.length; k++) {
        vec.sub(vec.tmp, 0, this.positions, i, boundPosition, k);
        let gap = vec.dot(vec.tmp, 0, boundNormal, k);
        if (gap < 0) {
          vec.addi(this.positions, i, boundNormal, k, -gap);
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

  move(x: number, y: number, z: number) {
    for (let i = 0; i < this.vert_num; i++) {
      this.positions[3 * i] += x;
      this.positions[3 * i + 1] += y;
      this.positions[3 * i + 2] += z;
    }
  }
}

// ===================== RIGIDSPHERE =====================

class RigidSphere {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  softDrive: THREE.Vector3;
  invMass: number;
  mesh: THREE.Mesh;
  radius: number;

  constructor(_scene: THREE.Scene) {
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.softDrive = new THREE.Vector3();
    this.radius = controls.radius;
    this.invMass = (4 * Math.PI) / 3 / this.radius ** 3;

    const color = new THREE.Color(Math.random(), Math.random(), Math.random());
    const sphereGeo = new THREE.SphereGeometry(this.radius);
    const sphereMat = new THREE.MeshPhongMaterial({ color });
    this.mesh = new THREE.Mesh(sphereGeo, sphereMat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    _scene.add(this.mesh);
  }

  renderUpdate() {
    this.mesh.position.copy(this.position);
  }

  update(dt: number) {
    const restitution = 0.5;

    this.velocity.add(new THREE.Vector3(0, -controls.gravity * dt, 0));
    this.velocity.add(this.softDrive.clone().multiplyScalar(dt));
    if (grabbedMesh === this.mesh) {
      const prevPosition = this.position.clone();
      this.grabInteract();
      this.velocity.copy(
        this.position
          .clone()
          .sub(prevPosition)
          .multiplyScalar(1 / dt)
      );
    } else this.position.add(this.velocity.clone().multiplyScalar(dt));

    for (let k = 0; k < boundPositions.length; k++) {
      const gap = this.position.clone().sub(boundPositions[k]).dot(boundNormals[k]) - this.radius;
      const proj = this.velocity.dot(boundNormals[k]);
      if (gap < 0.01 && proj < 0) {
        this.velocity.add(boundNormals[k].clone().multiplyScalar(-proj * (1 + restitution)));
      }
    }

    for (let other of spheres) {
      if (other === this) continue;
      const dir = this.position.clone().sub(other.position);
      const gap = dir.length() - this.radius - other.radius;
      const relProj = dir.dot(this.velocity.clone().sub(other.velocity));
      dir.normalize();
      if (gap < 0.01 && relProj < 0) {
        this.velocity.add(dir.clone().multiplyScalar(-relProj * restitution));
        other.velocity.add(dir.clone().multiplyScalar(relProj * restitution));
        this.position.add(dir.clone().multiplyScalar(-gap));
      }
    }

    for (let k = 0; k < boundPositions.length; k++) {
      const gap = this.position.clone().sub(boundPositions[k]).dot(boundNormals[k]) - this.radius;
      if (gap < 0) {
        this.position.add(boundNormals[k].clone().multiplyScalar(-gap));
      }
    }

    this.renderUpdate();
  }

  reset() {
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.renderUpdate();
  }

  grabInteract() {
    this.position.copy(cursorPoint);
  }

  move(x: number, y: number, z: number) {
    this.position.add(new THREE.Vector3(x, y, z));
    this.renderUpdate();
  }
}

// ===================== COLLISION ====================

function solveCollision1(obj1: SoftBodyObject, obj2: SoftBodyObject) {
  if (obj2 === obj1) return;
  for (let i = 0; i < obj2.vert_num; i++) {
    if (obj2.is_surface[i]) continue;

    let closeIds = obj1.spatial_hash.query(obj2.positions, i, hashSpacing);

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

// ===================== MOUSE =====================

let cursorPoint = new THREE.Vector3();
let grabbedMesh: THREE.Object3D | null = null;
let grabbedVertId = -1;

function mouseTrack() {
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
    const intersects = raycaster.intersectObjects([...objects, ...spheres].map((obj) => obj.mesh));
    if (intersects.length === 0) grabbedMesh = null;
    else {
      let grabbedPoint = intersects[0].point;
      grabbedMesh = intersects[0].object;
      planeNormal.copy(camera.position).normalize();
      plane.setFromNormalAndCoplanarPoint(planeNormal, grabbedPoint);
      orbitControl.enabled = false;

      let closestDist = Number.MAX_VALUE;
      for (let object of objects) {
        if (object.mesh !== grabbedMesh) continue;
        vec.setVec(vec.tmp, 0, grabbedPoint);
        for (let i = 0; i < object.vert_num; i++) {
          let dist = vec.dist(vec.tmp, 0, object.positions, i);
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
    orbitControl.enabled = true;
  });
}

// ===================== DATA =====================

type parsedData = {
  name: String;
  verts: Array<number>; // vertex positions in three units.
  tetIds: Array<number>; // the indices of vertices that form tetrahedrons in four units.
  tetEdgeIds: Array<number>; // the indices of vertices that form edges in two units.
  tetSurfaceTriIds: Array<number>; // the indices of vertices that form triangles of surface in three units.
};

const tetrahedronData = require("./models/data/Tetrahedron.json");
// Dummy data used for debugging
const bunnyData = require("./models/data/Bunny.json");
const eggData = require("./models/data/Egg_.json");
const bearData = require("./models/data/Bear_.json");
const heartData = require("./models/data/Heart_.json");
let dataList = [bunnyData, eggData, bearData, heartData];
let currentData = bunnyData;

// ===================== MAIN =====================

let objects: Array<SoftBodyObject> = [];
let spheres: Array<RigidSphere> = [];
let isPlaying: Boolean = false;

function main() {
  let prevTime = new Date().getTime();

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  animate();
  function animate() {
    let currTime = new Date().getTime();
    let timediff = (currTime - prevTime) / 1000;
    prevTime = currTime;
    requestAnimationFrame(animate);
    // setTimeout(animate, controls.timeStepSize);
    stats.begin();
    if (isPlaying) updateStates(controls.timeStepSize / 1000);
    // if (isPlaying) updateStates(timediff);
    renderer.render(scene, camera);
    stats.end();
  }
}

function updateStates(dt: number) {
  for (let object of objects) {
    object.applyStates(dt);
    if (grabbedMesh === object.mesh) object.grabInteract();
  }
  for (let n = 0; n < controls.numSubSteps; n++) {
    for (let object of objects) {
      object.solveTetConstraints(dt);
      object.solveEdgeConstraints(dt);
      if (controls.collisionCheck) {
        object.spatial_hash.update();
        for (let other of objects) solveCollision1(object, other);
        // for (let sphere of spheres) solveCollision2(object, sphere, dt);
      }
    }
  }
  for (let object of objects) {
    object.updateStates(dt);
    object.renderUpdate();
  }
  for (let sphere of spheres) {
    sphere.update(dt);
  }
}

const hashSpacing = 0.05;
const hashSize = 5000;
const controls = {
  debug: () => {
    updateStates(controls.timeStepSize / 1000);
    renderer.render(scene, camera);
  },
  toggle: () => {
    isPlaying = !isPlaying;
  },
  add: () => {
    switch (controls.selectedObject) {
      case 0:
        const object = new SoftBodyObject(currentData, scene);
        object.move(5 * (0.5 - Math.random()), 1.5, 5 * (0.5 - Math.random()));
        objects.push(object);
        break;
      case 1:
        const sphere = new RigidSphere(scene);
        sphere.move(5 * (0.5 - Math.random()), 1.5, 5 * (0.5 - Math.random()));
        spheres.push(sphere);
        break;
    }
  },
  reset: () => {
    for (let object of objects) {
      object.mesh.geometry.dispose();
      object.edges.geometry.dispose();
      (object.mesh.material as THREE.Material).dispose();
      (object.edges.material as THREE.Material).dispose();
      scene.remove(object.mesh);
      scene.remove(object.edges);
    }
    objects = [];

    for (let sphere of spheres) {
      sphere.mesh.geometry.dispose();
      (sphere.mesh.material as THREE.Material).dispose();
      scene.remove(sphere.mesh);
    }
    spheres = [];
  },
  selectedObject: 0,
  selectedData: 0,
  numSubSteps: 10,
  timeStepSize: 13,
  collisionCheck: false,
  gravity: 10,
  invStiffness: 5,
  friction: 0.9,
  radius: 0.5,
};

function initGUI() {
  const gui = new dat.GUI();

  const folder1 = gui.addFolder("Control");
  folder1.add(controls, "debug").name("Debug");
  folder1.add(controls, "toggle").name("Run / Pause");
  folder1.add(controls, "add").name("Add Object");
  folder1.add(controls, "reset").name("Reset");
  folder1
    .add(controls, "selectedObject", {
      SoftBody: 0,
      RigidBody: 1,
    })
    .onChange((id) => {
      controls.selectedObject = parseInt(id);
    });
  folder1
    .add(controls, "selectedData", {
      Bunny: 0,
      Egg: 1,
      Bear: 2,
      Heart: 3,
    })
    .onChange((id) => {
      controls.selectedData = parseInt(id);
      currentData = dataList[id];
    });
  folder1.add(controls, "radius", 0.1, 1).step(0.1).name("Radius");

  const folder2 = gui.addFolder("Simulation");
  folder2.add(controls, "numSubSteps", 1, 50).name("Sub Step");
  folder2.add(controls, "timeStepSize", 1, 100).name("Time Step (ms)");
  folder2.add(controls, "collisionCheck").name("Collision Check");

  const folder3 = gui.addFolder("Parameters");
  folder3.add(controls, "gravity", 0.0, 10.0).step(0.1).name("Gravity");
  folder3.add(controls, "friction", 0.0, 2.0).step(0.01).name("Friction");
  folder3.add(controls, "invStiffness", 0.0, 10.0).step(0.1).name("Inverse Stiffness");
}

function preventDefault() {
  document.oncontextmenu = () => false;
  document.onselectstart = () => false;
}

window.onload = () => {
  preventDefault();
  mouseTrack();
  initGUI();
  main();
};
