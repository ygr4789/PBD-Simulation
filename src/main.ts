import * as dat from "dat.gui";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

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

const controls = new OrbitControls(camera, renderer.domElement);
controls.listenToKeyEvents(window);

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

const groundGeo = new THREE.PlaneGeometry(20, 20, 1, 1);
const groundMat = new THREE.MeshPhongMaterial({ color: 0xa0adaf, shininess: 155 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI * 0.5;
// ground.receiveShadow = true;
const grid = new THREE.GridHelper(20, 20);
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
let bunnyData: parsedData;

async function loadBunny() {
  await fetch("src/bunny.json")
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      bunnyData = data;
    });
}

// ===================== CLASS =====================

class SoftBodyObject {
  init_positions: Array<number>;
  positions: Array<THREE.Vector3>;
  velocities: Array<THREE.Vector3>;
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
    // this.init_positions
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

    // ===================== GENERATE CONSTRAINS =====================

    this.tet_constrains = [];
    this.init_tet_volumes = [];
    for (let i = 0; i < file.tetIds.length; i += 4) {
      this.tet_constrains.push([...file.tetIds.slice(i, i + 4)]);
      const [x0, x1, x2, x3] = [...this.tet_constrains[i / 4]].map((tetId) => this.positions[tetId]);
      const x01 = new THREE.Vector3().subVectors(x1, x0);
      const x02 = new THREE.Vector3().subVectors(x2, x0);
      const x03 = new THREE.Vector3().subVectors(x3, x0);
      this.init_tet_volumes.push(new THREE.Vector3().crossVectors(x01, x02).dot(x03) / 6);
    }

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
    const gravity = -0.1;

    let prev_positions = this.positions.map((v) => v.clone());
    for (let i = 0; i < this.positions.length; i++) {
      this.velocities[i].add(new THREE.Vector3(0, gravity * dt, 0));
      this.positions[i].add(this.velocities[i].clone().multiplyScalar(dt));
    }

    for (let i = 0; i < this.positions.length; i++) {
      if (this.positions[i].y < 0.0) {
        this.positions[i].setY(0.0);
      }
    }

    for (let i = 0; i < this.tet_constrains.length; i++) {
      const [x0, x1, x2, x3] = [...this.tet_constrains[i]].map((tetId) => this.positions[tetId]);
      const x01 = new THREE.Vector3().subVectors(x1, x0);
      const x02 = new THREE.Vector3().subVectors(x2, x0);
      const x03 = new THREE.Vector3().subVectors(x3, x0);
      const x12 = new THREE.Vector3().subVectors(x1, x2);
      const x13 = new THREE.Vector3().subVectors(x1, x3);
      const volume = new THREE.Vector3().crossVectors(x01, x02).dot(x03) / 6;
      const init_volume = this.init_tet_volumes[i];
      const grad_x0_c = new THREE.Vector3().crossVectors(x13, x12);
      const grad_x1_c = new THREE.Vector3().crossVectors(x02, x03);
      const grad_x2_c = new THREE.Vector3().crossVectors(x03, x01);
      const grad_x3_c = new THREE.Vector3().crossVectors(x01, x02);
      const denom = [grad_x0_c, grad_x1_c, grad_x2_c, grad_x3_c].reduce((prev, cur) => {
        return prev + cur.length() ** 2;
      }, 0);
      const lambda = (-6 * (volume - init_volume)) / denom;
      x0.add(grad_x0_c.multiplyScalar(lambda));
      x1.add(grad_x1_c.multiplyScalar(lambda));
      x2.add(grad_x2_c.multiplyScalar(lambda));
      x3.add(grad_x3_c.multiplyScalar(lambda));
    }

    for (let i = 0; i < this.edge_constrains.length; i++) {
      const [x0, x1] = [...this.edge_constrains[i]].map((edgeId) => this.positions[edgeId]);
      const x01 = new THREE.Vector3().subVectors(x1, x0);
      const l = x01.length();
      const l0 = this.init_edge_lengths[i];
      x01.normalize();
      x0.add(x01.clone().multiplyScalar(0.5 * (l - l0)));
      x1.add(x01.clone().multiplyScalar(-0.5 * (l - l0)));
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
}

// ===================== COMMIT =====================

// ===================== MAIN =====================

let bunny: SoftBodyObject;
let isPlay = false;

function main() {
  let prevTime = 0;
  renderer.setAnimationLoop(animate);

  function animate(timestamp: number) {
    let timediff = (timestamp - prevTime) / 1000;
    if (isPlay) updateStates(timediff);
    renderer.render(scene, camera);
    prevTime = timestamp;
  }
  function updateStates(dt: number) {
    bunny.update(dt);
  }
}

function init_gui() {
  let controls = {
    debug: () => {
      console.log(1);
    },
    run: () => {
      isPlay = !isPlay;
    },
  };

  var gui = new dat.GUI();
  gui.add(controls, "debug");
  gui.add(controls, "run");
}

window.onload = async () => {
  await loadBunny();
  bunny = new SoftBodyObject(bunnyData, scene);
  init_gui();
  main();
  // test();
};
