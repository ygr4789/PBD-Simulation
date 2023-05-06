import * as dat from "dat.gui";
import * as Stats from "stats.js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import "./style/style.css";

const scene = new THREE.Scene();
const setcolor = 0x000000;
// const setcolor = 0xbbbbbb;
scene.background = new THREE.Color(setcolor);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
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

// const ambientLight = new THREE.AmbientLight(0xaaaaaa);
// scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff);
dirLight.position.set(1, 1, 1);
// dirLight.castShadow = true;
scene.add(dirLight);

const lightBack = new THREE.PointLight(0x0fffff, 1);
lightBack.position.set(0, -3, -1);
scene.add(lightBack);

// ================ Creating Ground ================

const bound = 10.0;

const groundGeo = new THREE.PlaneGeometry(2 * bound, 2 * bound, 1, 1);
const groundMat = new THREE.MeshPhongMaterial({ color: 0xa0adaf, shininess: 155 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI * 0.5;
// ground.receiveShadow = true;
const grid = new THREE.GridHelper(2 * bound, 2 * bound);
(grid.material as THREE.Material).opacity = 1.0;
(grid.material as THREE.Material).transparent = true;
grid.position.set(0, 0.002, 0);

scene.add(grid);
scene.add(ground);

// ===================== INIT =====================

type parsedData = {
  name: String;
  verts: Array<number>; // vertex positions in three units.
  tetIds: Array<number>; // the indices of vertices that form tetrahedrons in four units.
  tetEdgeIds: Array<number>; // the indices of vertices that form edges in two units.
  tetSurfaceTriIds: Array<number>; // the indices of vertices that form triangles of surface in three units.
};
const bunnyData = require("./assets/bunny.json");
// const bunnyData = require("./assets/test.json");

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

// ===================== CLASS =====================

class SoftBodyObject {
  init_positions: Array<number>;
  positions: Array<THREE.Vector3>;
  velocities: Array<THREE.Vector3>;
  invMasses: Array<number>;

  vertices: Float32Array;
  indices: Uint16Array;
  edgeindices: Uint16Array;

  geometry: THREE.BufferGeometry;
  mesh: THREE.Mesh;
  edge_geometry: THREE.BufferGeometry;
  edges: THREE.LineSegments;

  tet_constrains: Array<Array<number>>;
  init_tet_volumes: Array<number>;
  edge_constrains: Array<Array<number>>;
  init_edge_lengths: Array<number>;

  constructor(file: parsedData, _scene: THREE.Scene) {
    this.init_positions = file.verts;
    this.positions = [];
    this.velocities = [];

    for (let i = 0; i < this.init_positions.length; i += 3) {
      this.positions.push(new THREE.Vector3(...this.init_positions.slice(i, i + 3)));
      this.velocities.push(new THREE.Vector3(0, 0, 0));
    }

    this.vertices = new Float32Array(this.init_positions);
    this.indices = new Uint16Array(file.tetSurfaceTriIds);
    this.edgeindices = new Uint16Array(file.tetEdgeIds);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.vertices, 3));

    this.mesh = new THREE.Mesh(this.geometry, new THREE.MeshPhongMaterial({ color: 0x00f00f, flatShading: true }));
    this.mesh.geometry.computeVertexNormals();
    _scene.add(this.mesh);

    this.edge_geometry = new THREE.BufferGeometry();
    this.edge_geometry.setIndex(new THREE.BufferAttribute(this.edgeindices, 1));
    this.edge_geometry.setAttribute("position", new THREE.BufferAttribute(this.vertices, 3));

    this.edges = new THREE.LineSegments(this.edge_geometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    _scene.add(this.edges);

    // Constrains

    this.tet_constrains = [];
    this.init_tet_volumes = [];
    this.invMasses = new Array(this.positions.length).fill(0);
    for (let i = 0; i < file.tetIds.length; i += 4) {
      this.tet_constrains.push([...file.tetIds.slice(i, i + 4)]);
      const [x0, x1, x2, x3] = [...this.tet_constrains[i / 4]].map((tetId) => this.positions[tetId]);
      const x01 = new THREE.Vector3().subVectors(x1, x0);
      const x02 = new THREE.Vector3().subVectors(x2, x0);
      const x03 = new THREE.Vector3().subVectors(x3, x0);
      this.init_tet_volumes.push(new THREE.Vector3().crossVectors(x01, x02).dot(x03) / 6);
      this.tet_constrains[i / 4].forEach((tetId) => {
        this.invMasses[tetId] += this.init_tet_volumes[i / 4] / 4;
      });
    }
    this.invMasses.forEach((val, i, arr) => {
      arr[i] = 1 / val;
    });

    this.edge_constrains = [];
    this.init_edge_lengths = [];
    for (let i = 0; i < file.tetEdgeIds.length; i += 2) {
      this.edge_constrains.push([...file.tetEdgeIds.slice(i, i + 2)]);
      const [x0, x1] = [...this.edge_constrains[i / 2]].map((tetId) => this.positions[tetId]);
      this.init_edge_lengths.push(x0.distanceTo(x1));
    }
  }

  renderUpdate() {
    for (let i = 0; i < this.positions.length; i++) {
      this.vertices[i * 3] = this.positions[i].x;
      this.vertices[i * 3 + 1] = this.positions[i].y;
      this.vertices[i * 3 + 2] = this.positions[i].z;
    }

    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();

    this.edges.geometry.computeVertexNormals();
    this.edges.geometry.attributes.position.needsUpdate = true;
    this.edges.geometry.computeBoundingSphere();
  }

  update(dt: number) {
    const gravity = -9.8;
    const alpha = controls.invStiffness / dt / dt;

    let prev_positions = this.positions.map((v) => v.clone());
    for (let i = 0; i < this.positions.length; i++) {
      this.velocities[i].add(new THREE.Vector3(0, gravity * dt, 0));
    }
    if (grabbed === this.mesh) this.grabInteract(dt);

    for (let i = 0; i < this.positions.length; i++) {
      this.positions[i].add(this.velocities[i].clone().multiplyScalar(dt));
    }

    for (let i = 0; i < this.tet_constrains.length; i++) {
      const [x0, x1, x2, x3] = [...this.tet_constrains[i]].map((tetId) => this.positions[tetId]);
      const w = [...this.tet_constrains[i]].map((tetId) => this.invMasses[tetId]);
      const x01 = new THREE.Vector3().subVectors(x1, x0);
      const x02 = new THREE.Vector3().subVectors(x2, x0);
      const x03 = new THREE.Vector3().subVectors(x3, x0);
      const x12 = new THREE.Vector3().subVectors(x1, x2);
      const x13 = new THREE.Vector3().subVectors(x1, x3);
      const grad_x0_c = new THREE.Vector3().crossVectors(x13, x12);
      const grad_x1_c = new THREE.Vector3().crossVectors(x02, x03);
      const grad_x2_c = new THREE.Vector3().crossVectors(x03, x01);
      const grad_x3_c = new THREE.Vector3().crossVectors(x01, x02);
      const denom =
        [grad_x0_c, grad_x1_c, grad_x2_c, grad_x3_c].reduce((prev, curr, k) => {
          return prev + w[k] * curr.length() ** 2;
        }, 0) + alpha;
      const volume = new THREE.Vector3().crossVectors(x01, x02).dot(x03) / 6;
      const init_volume = this.init_tet_volumes[i];
      const lambda = (-6 * (volume - init_volume)) / denom;
      x0.add(grad_x0_c.multiplyScalar(lambda * w[0]));
      x1.add(grad_x1_c.multiplyScalar(lambda * w[1]));
      x2.add(grad_x2_c.multiplyScalar(lambda * w[2]));
      x3.add(grad_x3_c.multiplyScalar(lambda * w[3]));
    }

    for (let i = 0; i < this.edge_constrains.length; i++) {
      const [x0, x1] = [...this.edge_constrains[i]].map((edgeId) => this.positions[edgeId]);
      const [w0, w1] = [...this.edge_constrains[i]].map((edgeId) => this.invMasses[edgeId]);
      const x01 = new THREE.Vector3().subVectors(x1, x0);
      const l = x01.length();
      const l0 = this.init_edge_lengths[i];
      x01.normalize();
      const denom = w0 + w1 + alpha;
      const lambda = (l - l0) / denom;
      x0.add(x01.clone().multiplyScalar(lambda * w0));
      x1.add(x01.clone().multiplyScalar(-lambda * w1));
    }
    
    for (let i = 0; i < this.positions.length; i++) {
      for (let k = 0; k < boundPositions.length; k++) {
        const gap = new THREE.Vector3().subVectors(this.positions[i], boundPositions[k]).dot(boundNormals[k]);
        if (gap < 0) {
          this.positions[i].add(boundNormals[k].clone().multiplyScalar(-gap));
          prev_positions[i].copy(this.positions[i]);
        }
      }
    }

    for (let i = 0; i < this.positions.length; i++) {
      this.velocities[i] = new THREE.Vector3().subVectors(this.positions[i], prev_positions[i]).multiplyScalar(1.0 / dt);
    }

    this.renderUpdate();
  }

  reset() {
    // Bunny Reset
    this.positions = [];
    this.velocities = [];

    for (let i = 0; i < this.vertices.length / 3; i++) {
      this.positions.push(new THREE.Vector3(this.init_positions[3 * i], this.init_positions[3 * i + 1], this.init_positions[3 * i + 2]));
      this.velocities.push(new THREE.Vector3(0, 0, 0));
    }

    this.renderUpdate();
  }

  grabInteract(dt: number) {
    const interaction = 1000;

    let closestId = -1;
    let closestDist = 1e9;
    for (let i = 0; i < this.positions.length; i++) {
      let dist = this.positions[i].distanceTo(grabbedPoint);
      if (closestDist > dist) {
        closestDist = dist;
        closestId = i;
      }
    }

    const grabDir = new THREE.Vector3().subVectors(currentPoint, this.positions[closestId]).normalize();
    this.velocities[closestId].add(grabDir.multiplyScalar(interaction * dt));
  }

  move(x: number, y: number, z: number) {
    for (let p of this.positions) {
      p.add(new THREE.Vector3(x, y, z));
    }
    this.renderUpdate();
  }
}

// ===================== MOUSE =====================

let grabbedPoint = new THREE.Vector3();
let currentPoint = new THREE.Vector3();
let grabbed: THREE.Object3D | null = null;

function mouseTrack() {
  const mouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const planeNormal = new THREE.Vector3();
  const plane = new THREE.Plane();

  window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    planeNormal.copy(camera.position).normalize();
    plane.setFromNormalAndCoplanarPoint(planeNormal, grabbedPoint);
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, currentPoint);
  });

  window.addEventListener("mousedown", () => {
    const intersects = raycaster.intersectObjects(objects.map((obj) => obj.mesh));
    if (intersects.length === 0) grabbed = null;
    else {
      grabbedPoint.copy(intersects[0].point);
      grabbed = intersects[0].object;
      orbitControl.enabled = false;
    }
  });

  window.addEventListener("mouseup", () => {
    grabbed = null;
    orbitControl.enabled = true;
  });
}

// ===================== MAIN =====================

let objects: Array<SoftBodyObject> = [];
let isPlaying: Boolean = false;

function main() {
  let prevTime = 0;
  renderer.setAnimationLoop(animate);

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  function animate(timestamp: number) {
    let timediff = (timestamp - prevTime) / 1000;
    stats.begin();
    if (isPlaying) updateStates(timediff);
    renderer.render(scene, camera);
    stats.end();
    prevTime = timestamp;
  }
  function updateStates(dt: number) {
    for (let object of objects) {
      object.update(dt);
    }
  }
}

const controls = {
  debug: () => {
    console.log(scene.children);
  },
  toggle: () => {
    isPlaying = !isPlaying;
  },
  add: () => {
    const object = new SoftBodyObject(bunnyData, scene);
    object.move(5 * (0.5 - Math.random()), 1, 5 * (0.5 - Math.random()));
    objects.push(object);
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
  },
  invStiffness: 0,
};

function initGUI() {
  const gui = new dat.GUI();
  gui.add(controls, "debug");
  gui.add(controls, "toggle").name("Pause / Unpause");
  gui.add(controls, "add");
  gui.add(controls, "reset");
  gui.add(controls, "invStiffness", 0.0, 1.0).step(0.01);
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
