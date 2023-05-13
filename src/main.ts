import * as dat from "dat.gui";
import * as Stats from "stats.js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as vec from "./vector";
import { saveAs } from "file-saver";

import { SoftBodyObject, ParsedObjData } from "./softBody";
import { RigidSphere } from "./rigidSphere";
import { checkCollision1, checkCollision2, solveCollision1, solveCollision2 } from "./collision";

import { plotPoint, cleanAll, plotLine, emphasizePoint } from "./debug";

import "./style/style.css";

const scene = new THREE.Scene();
const setcolor = 0xa0a0e0;
scene.background = new THREE.Color(setcolor);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
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

// ===================== INTERATION =====================

let cursorPoint = new THREE.Vector3();
let grabbedMesh: THREE.Object3D | null = null;
let grabbedVertId = -1;

function useMouseInteration() {
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
    const intersects = raycaster.intersectObjects([...softbodies, ...spheres].map((obj) => obj.mesh));
    if (intersects.length === 0) grabbedMesh = null;
    else {
      let grabbedPoint = intersects[0].point;
      grabbedMesh = intersects[0].object;
      planeNormal.copy(camera.position).normalize();
      plane.setFromNormalAndCoplanarPoint(planeNormal, grabbedPoint);
      orbitControl.enabled = false;

      let closestDist = Number.MAX_VALUE;
      for (let soft of softbodies) {
        if (soft.mesh !== grabbedMesh) continue;
        vec.setVec(vec.tmp, 0, grabbedPoint);
        for (let i = 0; i < soft.vert_num; i++) {
          let dist = vec.dist(vec.tmp, 0, soft.positions, i);
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

const tetrahedronData = require("./models/data/Tetrahedron.json");
// Dummy data, used for debugging
const bunnyData = require("./models/data/Bunny.json");
const eggData = require("./models/data/Egg_.json");
const bearData = require("./models/data/Bear_.json");
const heartData = require("./models/data/Heart_.json");
let dataList: Array<ParsedObjData> = [bunnyData, eggData, bearData, heartData];
let currentData: ParsedObjData = bunnyData;

// ===================== CONTROL =====================

const saveScreen = () => {
  var canvas = document.querySelector("canvas") as HTMLCanvasElement;
  var a = document.createElement("a");
  a.href = canvas!.toDataURL("image/png").replace("image/png", "image/octet-stream");
  a.download = `output.png`;
  document.body.appendChild(a);
  a.click();
};

const controls = {
  debug: () => {},
  toggle: () => {
    isPlaying = !isPlaying;
  },
  add: () => {
    let height = 1.5;
    let cnt = 0;
    switch (controls.selectedModel) {
      case 0:
        const soft = new SoftBodyObject(currentData, scene);
        while (true) {
          let detectedCollisoin = false;
          soft.initLocation(bound * (0.5 - Math.random()), height, bound * (0.5 - Math.random()));
          for (let other of softbodies) {
            if (checkCollision1(soft, other)) detectedCollisoin = true;
          }
          for (let other of spheres) {
            if (checkCollision2(soft, other)) detectedCollisoin = true;
          }
          if (!detectedCollisoin) {
            softbodies.push(soft);
            break;
          }
          if(++cnt > 5) height += 1.5;
        }
        break;
      case 1:
        const sphere = new RigidSphere(controls.radius, scene);
        while (true) {
          let detectedCollisoin = false;
          sphere.initLocation(bound * (0.5 - Math.random()), height, bound * (0.5 - Math.random()));
          for (let other of softbodies) {
            if (checkCollision2(other, sphere)) detectedCollisoin = true;
          }
          for (let other of spheres) {
            let dist = sphere.position.distanceTo(other.position);
            let minDist = sphere.radius + other.radius;
            if (dist < minDist) detectedCollisoin = true;
          }
          if (!detectedCollisoin) {
            spheres.push(sphere);
            break;
          }
          if(++cnt > 5) height += 1.5;
        }
        break;
    }
  },
  reset: () => {
    for (let soft of softbodies) {
      soft.mesh.geometry.dispose();
      soft.edges.geometry.dispose();
      (soft.mesh.material as THREE.Material).dispose();
      (soft.edges.material as THREE.Material).dispose();
      scene.remove(soft.mesh);
      scene.remove(soft.edges);
    }
    softbodies = [];

    for (let sphere of spheres) {
      sphere.mesh.geometry.dispose();
      (sphere.mesh.material as THREE.Material).dispose();
      scene.remove(sphere.mesh);
    }
    spheres = [];
  },
  selectedModel: 0,
  selectedData: 0,
  numSubSteps: 10,
  timeStepSize: 13,
  collisionCheck: false,
  gravity: 10,
  invStiffness: 5,
  radius: 0.5,
};

// ===================== GUI =====================

function initGUI() {
  const gui = new dat.GUI();

  const folder1 = gui.addFolder("Control");
  // folder1.add(controls, "debug").name("Debug");
  folder1.add(controls, "toggle").name("Run / Pause");
  folder1.add(controls, "add").name("Add Object");
  folder1.add(controls, "reset").name("Reset");
  folder1
    .add(controls, "selectedModel", {
      SoftBody: 0,
      RigidBody: 1,
    })
    .onChange((id) => {
      controls.selectedModel = parseInt(id);
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
  folder3.add(controls, "invStiffness", 0.0, 10.0).step(0.1).name("Inverse Stiffness");
}

// ===================== MAIN =====================

let softbodies: Array<SoftBodyObject> = [];
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
    stats.begin();
    if (isPlaying) updateStates(controls.timeStepSize / 1000);
    renderer.render(scene, camera);
    stats.end();
  }
}

function updateStates(dt: number) {
  for (let object of [...softbodies, ...spheres]) {
    object.applyStates(dt, controls.gravity);
    if (grabbedMesh === object.mesh) object.grabInteract(dt, cursorPoint, grabbedVertId);
  }
  for (let n = 0; n < controls.numSubSteps; n++) {
    for (let soft of softbodies) {
      soft.solveTetConstraints(dt);
      soft.solveEdgeConstraints(dt, controls.invStiffness);
      if (controls.collisionCheck) {
        soft.spatial_hash.update();
        for (let other of softbodies) solveCollision1(soft, other);
        for (let sphere of spheres) solveCollision2(soft, sphere, dt);
      }
    }
  }
  for (let sphere of spheres) {
    sphere.handleCollision(spheres);
  }
  for (let soft of softbodies) {
    soft.updateStates(dt);
  }
  for (let object of [...softbodies, ...spheres]) {
    object.handleBoundaries();
    object.renderUpdate();
  }
}

function preventDefault() {
  document.oncontextmenu = () => false;
  document.onselectstart = () => false;
}

window.onload = () => {
  preventDefault();
  useMouseInteration();
  initGUI();
  main();
};
