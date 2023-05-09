import * as dat from "dat.gui";
import * as Stats from "stats.js";
import * as THREE from "three";
import { Vector3 } from "three";
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
dirLight.castShadow = true;
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

// ===================== SOFTBODY =====================

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

  isSurface: Array<boolean>;

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

    this.isSurface = new Array(this.vertices.length).fill(false);
    for (let id of file.tetSurfaceTriIds) this.isSurface[id] = true;

    // Constrains

    this.tet_constrains = [];
    this.init_tet_volumes = [];
    this.invMasses = new Array(this.positions.length).fill(0);
    for (let i = 0; i < file.tetIds.length; i += 4) {
      this.tet_constrains.push([...file.tetIds.slice(i, i + 4)]);
      const [x0, x1, x2, x3] = [...this.tet_constrains[i / 4]].map((tetId) => this.positions[tetId]);
      const x01 = x1.clone().sub(x0);
      const x02 = x2.clone().sub(x0);
      const x03 = x3.clone().sub(x0);
      this.init_tet_volumes.push(x01.clone().cross(x02).dot(x03) / 6);
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

    this.geometry.computeVertexNormals();
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeBoundingSphere();

    this.edge_geometry.computeVertexNormals();
    this.edge_geometry.attributes.position.needsUpdate = true;
    this.edge_geometry.computeBoundingSphere();
  }

  update(dt: number) {
    let prev_positions = this.positions.map((v) => v.clone());
    for (let i = 0; i < this.positions.length; i++) {
      this.velocities[i].add(new THREE.Vector3(0, -controls.gravity * dt, 0));
    }
    if (grabbed === this.mesh) this.grabInteract(dt);

    for (let i = 0; i < this.positions.length; i++) {
      for (let k = 0; k < boundPositions.length; k++) {
        const gap = new THREE.Vector3().subVectors(this.positions[i], boundPositions[k]).dot(boundNormals[k]);
        if (gap < 0.01) {
          this.velocities[i].multiplyScalar(1 - controls.friction);
        }
      }
    }

    for (let i = 0; i < this.positions.length; i++) {
      this.positions[i].add(this.velocities[i].clone().multiplyScalar(dt));
    }

    const alpha = controls.invStiffness / dt ** 2;
    for (let n = 0; n < controls.NumSubSteps; n++) {
      for (let i = 0; i < this.tet_constrains.length; i++) {
        const [x0, x1, x2, x3] = [...this.tet_constrains[i]].map((tetId) => this.positions[tetId]);
        const w = [...this.tet_constrains[i]].map((tetId) => this.invMasses[tetId]);
        const x01 = x1.clone().sub(x0);
        const x02 = x2.clone().sub(x0);
        const x03 = x3.clone().sub(x0);
        const x12 = x1.clone().sub(x2);
        const x13 = x1.clone().sub(x3);
        const volume = new THREE.Vector3().crossVectors(x01, x02).dot(x03) / 6;
        const init_volume = this.init_tet_volumes[i];
        const grad_x0_c = x13.clone().cross(x12);
        const grad_x1_c = x02.clone().cross(x03);
        const grad_x2_c = x03.clone().cross(x01);
        const grad_x3_c = x01.clone().cross(x02);
        const denom = [grad_x0_c, grad_x1_c, grad_x2_c, grad_x3_c].reduce((prev, curr, k) => {
          return prev + w[k] * curr.length() ** 2;
        }, 0);
        if (denom == 0.0) continue;
        const lambda = (-6.0 * (volume - init_volume)) / denom;
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
        if (denom == 0.0) continue;
        const lambda = (l - l0) / denom;
        x0.add(x01.clone().multiplyScalar(lambda * w0));
        x1.add(x01.clone().multiplyScalar(-lambda * w1));
      }

      for (let i = 0; i < this.positions.length; i++) {
        for (let k = 0; k < boundPositions.length; k++) {
          const gap = new THREE.Vector3().subVectors(this.positions[i], boundPositions[k]).dot(boundNormals[k]);
          if (gap < 0) {
            this.positions[i].add(boundNormals[k].clone().multiplyScalar(-gap));
            // prev_positions[i].copy(this.positions[i]);
          }
        }
      }
    }

    for (let otherObj of objects) {
      if (!controls.collisionCheck) break;
      if (otherObj === this) continue;
      for (let i = 0; i < this.positions.length; i++) {
        if (!this.isSurface[i]) continue;
        const q = this.positions[i];
        for (let j = 0; j < otherObj.tet_constrains.length; j++) {
          let isSurfaceTet = false;
          const [p0, p1, p2, p3] = [...otherObj.tet_constrains[j]].map((tetId) => {
            if (otherObj.isSurface[tetId]) isSurfaceTet = true;
            return otherObj.positions[tetId];
          });
          if (!isSurfaceTet) continue;

          const p0q = q.clone().sub(p0);
          const p01 = p1.clone().sub(p0);
          const p02 = p2.clone().sub(p0);
          const p03 = p3.clone().sub(p0);
          const M = new THREE.Matrix3();
          M.setFromMatrix4(new THREE.Matrix4().makeBasis(p01, p02, p03));
          if (M.determinant() === 0.0) break;
          M.invert();
          const w = p0q.clone().applyMatrix3(M);

          let isInTet = true;
          [1 - w.x - w.y - w.z, w.x, w.y, w.z].forEach((val) => {
            if (val < 0) isInTet = false;
          });
          if (!isInTet) continue;

          let sel = p0;
          [...otherObj.tet_constrains[j]].forEach((tetId) => {
            if (otherObj.isSurface[tetId]) {
              const p = otherObj.positions[tetId];
              const selDist = sel.distanceTo(q);
              const newDist = p.distanceTo(q);
              if (selDist > newDist) sel = p;
            }
          });
          console.log("Contacted");
          q.copy(sel);
          break;
        }
      }
    }

    for (let i = 0; i < this.positions.length; i++) {
      this.velocities[i].subVectors(this.positions[i], prev_positions[i]).multiplyScalar(1.0 / dt);
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
    const grabTension = 1;
    const grabDamping = 1;

    let closestId = -1;
    let closestDist = 1e9;
    for (let i = 0; i < this.positions.length; i++) {
      let dist = this.positions[i].distanceTo(grabbedPoint);
      if (closestDist > dist) {
        closestDist = dist;
        closestId = i;
      }
    }

    const grabDir = new THREE.Vector3();
    grabDir.subVectors(currentPoint, this.positions[closestId]);
    const grabLen = grabDir.length();
    grabDir.normalize();
    const projVel = this.velocities[closestId].dot(grabDir);
    const grabForce = grabLen * grabTension - projVel * grabDamping;
    this.velocities[closestId].add(grabDir.multiplyScalar(grabForce * this.invMasses[closestId] * dt));
  }

  move(x: number, y: number, z: number) {
    for (let p of this.positions) {
      p.add(new THREE.Vector3(x, y, z));
    }
    this.renderUpdate();
  }
}

// ===================== RIGIDSPHERE =====================

class RigidSphere {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  invMass: number;
  mesh: THREE.Mesh;
  radius: number;

  constructor(_scene: THREE.Scene) {
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.radius = 1;
    this.invMass = 10;

    const sphereGeo = new THREE.SphereGeometry(this.radius);
    const sphereMat = new THREE.MeshPhongMaterial({ color: 0x00f00f });
    this.mesh = new THREE.Mesh(sphereGeo, sphereMat);
    _scene.add(this.mesh);
  }

  renderUpdate() {
    this.mesh.position.copy(this.position);
  }

  update(dt: number) {
    // needs to implement
    const restitution = 0.5;

    this.velocity.add(new THREE.Vector3(0, -controls.gravity * dt, 0));
    if (grabbed === this.mesh) this.grabInteract(dt);

    this.position.add(this.velocity.clone().multiplyScalar(dt));

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

  grabInteract(dt: number) {
    const grabTension = 1;
    const grabDamping = 1;

    const grabDir = new THREE.Vector3();
    grabDir.subVectors(currentPoint, this.position);
    const grabLen = grabDir.length();
    grabDir.normalize();
    const projVel = this.velocity.dot(grabDir);
    const grabForce = grabLen * grabTension - projVel * grabDamping;
    this.velocity.add(grabDir.multiplyScalar(grabForce * this.invMass * dt));
  }

  move(x: number, y: number, z: number) {
    this.position.add(new THREE.Vector3(x, y, z));
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
    const intersects = raycaster.intersectObjects([...objects, ...spheres].map((obj) => obj.mesh));
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

// ===================== DATA =====================

type parsedData = {
  name: String;
  verts: Array<number>; // vertex positions in three units.
  tetIds: Array<number>; // the indices of vertices that form tetrahedrons in four units.
  tetEdgeIds: Array<number>; // the indices of vertices that form edges in two units.
  tetSurfaceTriIds: Array<number>; // the indices of vertices that form triangles of surface in three units.
};

const tetrahedronData = require("./models/data/Tetrahedron.json");
const bunnyData = require("./models/data/Bunny.json");
const eggData = require("./models/data/Egg_.json");
const bearData = require("./models/data/Bear_.json");
const heartData = require("./models/data/Heart_.json");
let dataList = [bunnyData, tetrahedronData, eggData, bearData, heartData];
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
    setTimeout(animate, controls.TimeStepSize);
    stats.begin();
    if (isPlaying) updateStates(timediff);
    renderer.render(scene, camera);
    stats.end();
  }
  function updateStates(dt: number) {
    for (let object of objects) {
      object.update(dt);
    }
    for (let sphere of spheres) {
      sphere.update(dt);
    }
  }
}

const controls = {
  debug: () => {
    // console.log(files);
  },
  toggle: () => {
    isPlaying = !isPlaying;
  },
  add: () => {
    if (!controls.addSphere) {
      const object = new SoftBodyObject(currentData, scene);
      object.move(5 * (0.5 - Math.random()), 1, 5 * (0.5 - Math.random()));
      objects.push(object);
    } else {
      const sphere = new RigidSphere(scene);
      sphere.move(5 * (0.5 - Math.random()), 5, 5 * (0.5 - Math.random()));
      spheres.push(sphere);
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
  gravity: 10,
  invStiffness: 50,
  friction: 0.9,
  NumSubSteps: 10,
  TimeStepSize: 10,
  collisionCheck: false,
  addSphere: false,
  data: 0,
};

function initGUI() {
  const gui = new dat.GUI();
  gui.add(controls, "debug");
  gui.add(controls, "toggle").name("Pause / Unpause");
  gui.add(controls, "add");
  gui.add(controls, "reset");
  gui.add(controls, "gravity", 0.0, 10.0).step(0.1);
  gui.add(controls, "friction", 0.0, 2.0).step(0.01);
  gui.add(controls, "invStiffness", 0.0, 100.0).step(0.1);
  gui.add(controls, "NumSubSteps", 1, 50);
  gui.add(controls, "TimeStepSize", 10, 1000);
  gui.add(controls, "collisionCheck");
  gui.add(controls, "addSphere");
  gui
    .add(controls, "data", {
      Tetrahedron: 1,
      Bunny: 0,
      Egg: 2,
      Bear: 3,
      Heart: 4,
    })
    .onChange((id) => {
      currentData = dataList[id];
    });
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
