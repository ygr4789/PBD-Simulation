import * as dat from "dat.gui";
import * as Stats from "stats.js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { SoftBodyObject, ParsedMsh } from "./softBody";
import { RigidSphereObject } from "./rigidSphere";
import { checkCollision, solveCollision } from "./collision";
import { cursorPoint, grabbedMesh, grabbedVertId, useMouseInteration } from "./interaction";
import { captureCanvas, recordCanvas, zipFileSaver } from "./util/record";

import { plotPoint, cleanAll, plotLine, emphasizePoint } from "./util/debug";

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
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// ================ Creating Ground ================

const bound = 5.0;

const groundGeo = new THREE.PlaneGeometry(2 * bound, 2 * bound, 1, 1);
const groundMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 155, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI * 0.5;
ground.receiveShadow = true;
const grid = new THREE.GridHelper(2 * bound, 2 * bound, 0xffffff, 0xaaaaaa);
(grid.material as THREE.Material).opacity = 1.0;
(grid.material as THREE.Material).transparent = true;
grid.position.set(0, 0.002, 0);

scene.add(grid);
grid.visible = false;
scene.add(ground);

// ===================== DATA =====================

const tetrahedronData = require("./models/data/Tetrahedron.json");
// Dummy data, used for debugging
const bunnyData = require("./models/data/Bunny.json");
const eggData = require("./models/data/Egg_.json");
const bearData = require("./models/data/Bear_.json");
const heartData = require("./models/data/Heart_.json");
let dataList: Array<ParsedMsh> = [bunnyData, eggData, bearData, heartData];
let currentData: ParsedMsh = bunnyData;

// ===================== CONTROL =====================

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const burstModeStorage = new zipFileSaver();

const controls = {
  debug: () => {
    console.log(currentData);
  },
  toggleVisibility: () => {
    dirLight.visible = !dirLight.visible;
    grid.visible = !grid.visible;
    renderer.shadowMap.enabled = !renderer.shadowMap.enabled;
    objects.forEach((object) => {
      if (object instanceof SoftBodyObject) {
        object.edges.visible = !dirLight.visible;
      }
    });
  },
  burstShot: () => {
    if (controls.isburstMode) {
      burstModeStorage.save();
      burstModeStorage.flush();
    }
    controls.isburstMode = !controls.isburstMode;
  },
  isburstMode: false,
  capImage: () => {
    renderer.render(scene, camera);
    captureCanvas(canvas);
  },
  capVideo: () => {
    recordCanvas(canvas, controls.recordingTime * 1000);
  },
  recordingTime: 5,
  toggleUpdating: () => {
    isPlaying = !isPlaying;
  },
  addObj: () => {
    let height = 1.5;
    let object;
    switch (controls.selectedObjectType) {
      case 0:
        object = new SoftBodyObject(currentData, scene);
        object.edges.visible = !dirLight.visible;
        break;
      default:
        object = new RigidSphereObject(controls.radius, scene);
        break;
    }
    while (true) {
      let detectedCollisoin = false;
      object.initLocation(bound * (0.5 - Math.random()), height, bound * (0.5 - Math.random()));
      for (let other of objects) {
        if (checkCollision(object, other)) detectedCollisoin = true;
      }
      if (!detectedCollisoin) {
        objects.push(object);
        break;
      }
      height += 1.5;
    }
  },
  reset: () => {
    while (objects.length > 0) {
      let object = objects.pop()!;
      object.remove(scene);
    }
  },
  selectedObjectType: 0,
  selectedData: 0,
  numSubSteps: 10,
  timeStepSize: 13,
  collisionCheck: false,
  gravity: 10,
  invStiffness: 1,
  radius: 0.5,
};

// ===================== GUI =====================

function initGUI() {
  const gui = new dat.GUI();

  const folder0 = gui.addFolder("Scene");
  folder0.add(controls, "toggleVisibility").name("Light On / Off");
  folder0.add(controls, "capImage").name("Capture Image");
  folder0.add(controls, "capVideo").name("Capture Video");
  folder0.add(controls, "recordingTime", 1, 60).step(1).name("Video Length (s)");
  // folder0.add(controls, "burstShot").name("Burst Mode On / Off");

  const folder1 = gui.addFolder("Control");
  // folder1.add(controls, "debug").name("Debug");
  folder1.add(controls, "toggleUpdating").name("Run / Pause");
  folder1.add(controls, "addObj").name("Add Object");
  folder1.add(controls, "reset").name("Reset");
  folder1
    .add(controls, "selectedObjectType", {
      SoftBody: 0,
      RigidBody: 1,
    })
    .name("Object Type")
    .onChange((id) => {
      controls.selectedObjectType = parseInt(id);
    });
  folder1
    .add(controls, "selectedData", {
      Bunny: 0,
      Egg: 1,
      Bear: 2,
      Heart: 3,
    })
    .name("Shape")
    .onChange((id) => {
      controls.selectedData = parseInt(id);
      currentData = dataList[id];
    });
  folder1.add(controls, "radius", 0.1, 1).step(0.1).name("Radius");

  const folder2 = gui.addFolder("Simulation");
  folder2.add(controls, "numSubSteps", 1, 50).step(1).name("Sub Step");
  folder2.add(controls, "timeStepSize", 1, 100).step(1).name("Time Step (ms)");
  folder2.add(controls, "collisionCheck").name("Collision Check");

  const folder3 = gui.addFolder("Parameters");
  folder3.add(controls, "gravity", 0.0, 10.0).step(0.1).name("Gravity");
  folder3.add(controls, "invStiffness", 0.0, 5.0).step(0.1).name("Inverse Stiffness");
}

// ===================== MAIN =====================

const objects: Array<SoftBodyObject | RigidSphereObject> = [];
let isPlaying: Boolean = false;

function main() {
  // let prevTime = new Date().getTime();

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  animate();
  function animate() {
    // let currTime = new Date().getTime();
    // let timediff = (currTime - prevTime) / 1000;
    // prevTime = currTime;
    requestAnimationFrame(animate);
    stats.begin();
    if (isPlaying) updateStates(controls.timeStepSize / 1000);
    renderer.render(scene, camera);
    if (controls.isburstMode) {
      burstModeStorage.store(canvas);
    }
    stats.end();
  }
}

function updateStates(dt: number) {
  for (let object of objects) {
    object.applyStates(dt, controls.gravity);
    if (grabbedMesh === object.mesh) object.grabInteract(dt, cursorPoint, grabbedVertId);
  }
  for (let n = 0; n < controls.numSubSteps; n++) {
    for (let object of objects) {
      if (object instanceof SoftBodyObject) {
        object.solveVolumeConstraints(dt);
        object.solveLengthConstraints(dt, controls.invStiffness * controls.numSubSteps);
      }
    }
    for (let object of objects) {
      if (controls.collisionCheck) {
        if (object instanceof SoftBodyObject) {
          object.spatial_hash.update();
        }
        for (let other of objects) {
          solveCollision(object, other, dt);
        }
      }
    }
    for (let object of objects) {
      object.handleBoundaries();
    }
  }
  for (let object of objects) {
    if (object instanceof SoftBodyObject) {
      object.updateVelocities(dt);
    }
    object.renderUpdate();
  }
}

function preventDefault() {
  document.oncontextmenu = () => false;
  document.onselectstart = () => false;
}

window.onload = () => {
  preventDefault();
  useMouseInteration(camera, orbitControl, objects);
  initGUI();
  main();
};
