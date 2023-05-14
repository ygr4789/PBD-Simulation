import * as dat from "dat.gui";
import * as Stats from "stats.js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as vec from "./util/vector";
import { saveAs } from "file-saver";

import { SoftBodyObject, ParsedObjData } from "./softBody";
import { RigidSphere } from "./rigidSphere";
import { checkCollision1, checkCollision2, solveCollision1, solveCollision2 } from "./collision";
import { cursorPoint, grabbedMesh, grabbedVertId, useMouseInteration } from "./interaction";
import { record } from "./util/record";

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
let dataList: Array<ParsedObjData> = [bunnyData, eggData, bearData, heartData];
let currentData: ParsedObjData = bunnyData;

// ===================== CONTROL =====================

var canvas = document.querySelector("canvas") as HTMLCanvasElement;

const controls = {
  toggleVisibility: () => {
    dirLight.visible = !dirLight.visible;
    grid.visible = !grid.visible;
    renderer.shadowMap.enabled = !renderer.shadowMap.enabled;
    softbodies.forEach((soft) => {
      soft.edges.visible = !dirLight.visible;
    });
  },
  recImage: () => {
    canvas.toBlob((blob: Blob) => {
      saveAs(blob, (1).toString() + ".png");
    });
  },
  recVideo: () => {
    const recording = record(canvas, controls.recordingTime * 1000);
    // play it on another video element
    let video$ = document.createElement("video");
    recording.then((url: string) => video$.setAttribute("src", url));
    // download it
    let link$ = document.createElement("a");
    link$.setAttribute("download", "recordingVideo");
    recording.then((url: string) => {
      link$.setAttribute("href", url);
      link$.click();
    });
  },
  recordingTime: 5,
  toggleUpdating: () => {
    isPlaying = !isPlaying;
  },
  addObj: () => {
    let height = 1.5;
    let cnt = 0;
    switch (controls.selectedObjectType) {
      case 0:
        const soft = new SoftBodyObject(currentData, scene);
        soft.edges.visible = !dirLight.visible;
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
          if (++cnt > 5) height += 1.5;
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
          if (++cnt > 5) height += 1.5;
        }
        break;
    }
  },
  reset: () => {
    while (softbodies.length > 0) {
      let soft = softbodies.pop()!;
      soft.mesh.geometry.dispose();
      soft.edges.geometry.dispose();
      (soft.mesh.material as THREE.Material).dispose();
      (soft.edges.material as THREE.Material).dispose();
      scene.remove(soft.mesh);
      scene.remove(soft.edges);
    }
    while (spheres.length > 0) {
      let sphere = spheres.pop()!;
      sphere.mesh.geometry.dispose();
      (sphere.mesh.material as THREE.Material).dispose();
      scene.remove(sphere.mesh);
    }
  },
  selectedObjectType: 0,
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

  const folder0 = gui.addFolder("Record");
  folder0.add(controls, "toggleVisibility").name("Light On / Off");
  folder0.add(controls, "recImage").name("Capture Image");
  folder0.add(controls, "recVideo").name("Capture Video");
  folder0.add(controls, "recordingTime", 1, 60).step(1).name("Video Length (s)");

  const folder1 = gui.addFolder("Control");
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
  folder3.add(controls, "invStiffness", 0.0, 10.0).step(0.1).name("Inverse Stiffness");
}

// ===================== MAIN =====================

const softbodies: Array<SoftBodyObject> = [];
const spheres: Array<RigidSphere> = [];
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
  useMouseInteration(camera, orbitControl, softbodies, spheres);
  initGUI();
  main();
};
