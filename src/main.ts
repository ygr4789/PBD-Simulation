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
import {
  boundX,
  boundZ,
  cycle_num,
  pre_dec_color,
  pre_dec_frame,
  pre_dec_shape,
  pre_dec_theta,
  pre_dec_Y,
  pre_dec_Z,
} from "./util/consts";

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

const camera = new THREE.OrthographicCamera(
  -boundZ * 2,
  boundZ * 2,
  boundZ * 2 * (window.innerHeight / window.innerWidth),
  -boundZ * 2 * (window.innerHeight / window.innerWidth),
  -100.0,
  100.0
);
camera.position.set(1.3, 1.3, 0.3);
camera.lookAt(0, 1.3, 0);

function window_onsize() {
  camera.left = -boundZ * 2;
  camera.right = boundZ * 2;
  camera.top = boundZ * 2 * (window.innerHeight / window.innerWidth);
  camera.bottom = -boundZ * 2 * (window.innerHeight / window.innerWidth);
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

const groundGeo = new THREE.PlaneGeometry(2 * boundX, 2 * boundZ, 1, 1);
const groundMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 155, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI * 0.5;
ground.receiveShadow = true;
const grid = new THREE.GridHelper(2 * boundX, 2 * boundZ, 0xffffff, 0xaaaaaa);
(grid.material as THREE.Material).opacity = 1.0;
(grid.material as THREE.Material).transparent = true;
grid.position.set(0, 0.002, 0);

scene.add(grid);
grid.visible = false;
scene.add(ground);

// ===================== DATA =====================

const iMino = require("./models/tetris/data/i_.json");
const jMino = require("./models/tetris/data/j_.json");
const lMino = require("./models/tetris/data/l_.json");
const oMino = require("./models/tetris/data/o_.json");
const tMino = require("./models/tetris/data/t_.json");
const sMino = require("./models/tetris/data/s_.json");
const zMino = require("./models/tetris/data/z_.json");
let dataList: Array<ParsedMsh> = [iMino, jMino, lMino, oMino, tMino, sMino, zMino];
let currentData: ParsedMsh = iMino;

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
      burstModeStorage.close();
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
    console.log(frameCount);
    let object;
    let order = objects.length % cycle_num;
    object = new SoftBodyObject(dataList[pre_dec_shape[order]], scene);
    object.edges.visible = !dirLight.visible;
    object.initLocation(0, pre_dec_Y[order], pre_dec_Z[order], pre_dec_theta[order]);
    objects.push(object);
  },
  reset: () => {
    while (objects.length > 0) {
      let object = objects.pop()!;
      object.remove(scene);
    }
  },
  selectedObjectType: 0,
  selectedData: 0,
  numSubSteps: 1,
  numDevideSteps: 4,
  timeStepSize: 13,
  collisionCheck: true,
  gravity: 1.5,
  invStiffness: 0.05,
  radius: 0.5,
};

// ===================== GUI =====================

function initGUI() {
  const gui = new dat.GUI();
  
  gui.add(controls, "toggleUpdating").name("Run / Pause");
  gui.add(controls, "burstShot").name("Generate Sequrntial Image On / Off");
  // const folder0 = gui.addFolder("Scene");
  // folder0.add(controls, "toggleVisibility").name("Light On / Off");
  // folder0.add(controls, "capImage").name("Capture Image");
  // folder0.add(controls, "capVideo").name("Capture Video");
  // folder0.add(controls, "recordingTime", 1, 60).step(1).name("Video Length (s)");
  // folder0.add(controls, "burstShot").name("Burst Mode On / Off");

  // const folder1 = gui.addFolder("Control");
  // folder1.add(controls, "debug").name("Debug");
  // folder1.add(controls, "toggleUpdating").name("Run / Pause");
  // folder1.add(controls, "addObj").name("Add Object");
  // folder1.add(controls, "reset").name("Reset");
  // folder1
  //   .add(controls, "selectedObjectType", {
  //     SoftBody: 0,
  //     RigidBody: 1,
  //   })
  //   .name("Object Type")
  //   .onChange((id) => {
  //     controls.selectedObjectType = parseInt(id);
  //   });
  // folder1
  //   .add(controls, "selectedData", {
  //     I: 0,
  //     L: 1,
  //     J: 2,
  //     O: 3,
  //     T: 4,
  //     S: 5,
  //     Z: 6,
  //   })
  //   .name("Shape")
  //   .onChange((id) => {
  //     controls.selectedData = parseInt(id);
  //     currentData = dataList[id];
  //   });
  // folder1.add(controls, "radius", 0.1, 1).step(0.1).name("Radius");

  // const folder2 = gui.addFolder("Simulation");
  // folder2.add(controls, "numSubSteps", 1, 50).step(1).name("Sub Step");
  // folder2.add(controls, "numDevideSteps", 1, 50).step(1).name("Devide Step");
  // folder2.add(controls, "timeStepSize", 1, 100).step(1).name("Time Step (ms)");
  // folder2.add(controls, "collisionCheck").name("Collision Check");

  // const folder3 = gui.addFolder("Parameters");
  // folder3.add(controls, "gravity", 0.0, 10.0).step(0.1).name("Gravity");
  // folder3.add(controls, "invStiffness", 0.0, 5.0).step(0.1).name("Inverse Stiffness");
}

// ===================== MAIN =====================

const objects: Array<SoftBodyObject | RigidSphereObject> = [];
let isPlaying: Boolean = false;
let frameCount = 0;

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
    if (isPlaying) {
      let order = objects.length % cycle_num;
      if (frameCount === pre_dec_frame[order]) {
        controls.addObj();
        (objects[order].mesh.material as THREE.MeshPhongMaterial).color = pre_dec_color[order];
      }
      frameCount++;
      for (let i = 0; i < controls.numDevideSteps; i++) {
        updateStates(controls.timeStepSize / controls.numDevideSteps / 1000);
      }
    }
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
  }
  for (let n = 0; n < controls.numSubSteps; n++) {
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
  // useMouseInteration(camera, orbitControl, objects);
  useMouseInteration(camera, objects);
  initGUI();
  main();
};
