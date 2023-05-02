import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const scene = new THREE.Scene();
const setcolor = "#000000";
scene.background = new THREE.Color(setcolor);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000.0);
camera.position.set(40, 40, 45);

const controls = new OrbitControls(camera, renderer.domElement);
controls.listenToKeyEvents(window);

function window_onsize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onresize = window_onsize;

// ================ Light setting ====================

const ambientLight = new THREE.AmbientLight(0xaaaaaa);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff);
dirLight.position.set(1, 1, 1);
dirLight.castShadow = true;
scene.add(dirLight);

const lightBack = new THREE.PointLight(0x0fffff, 1);
lightBack.position.set(0, -3, -1);
scene.add(lightBack);

// # ===========Creating Bound Box ============

const groundGeo = new THREE.PlaneGeometry(20, 20, 1, 1);
const groundMat = new THREE.MeshPhongMaterial({ color: 0xa0adaf, shininess: 155 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI * 0.5;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(20, 20);
// grid.material.opacity = 1.0;
// grid.material.transparent = true;
grid.position.set(0, 0.002, 0);
scene.add(grid);

// ===================== MAIN =====================

class SoftBodyObject {
  
}

const loadBunny = fetch("src/bunny.json")
  .then((response) => {
    return response.json();
  })
  .then((data) => {
    // console.log(data);
    const bunnyGeo = new THREE.BufferGeometry();
    const bunnyVert = new Float32Array(data.verts);
    bunnyGeo.setIndex(data.tetSurfaceTriIds);
    bunnyGeo.setAttribute("position", new THREE.BufferAttribute(bunnyVert, 3));
    bunnyGeo.computeVertexNormals();
    // bunnyGeo.computeTangents();
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const bunny = new THREE.Mesh(bunnyGeo, material);
    // bunny.scale.set(10, 10, 10);
    // bunny.position.set(-10, 0, 0);
    scene.add(bunny);
    // console.log(bunny.geometry);
  });

function main() {
    let prevTime = 0;
    renderer.setAnimationLoop(animate);
    
    function animate(timestamp: number) {
      let timediff = (timestamp - prevTime) / 1000;
      renderer.render(scene, camera);
      prevTime = timestamp;
    }
  }
  
document.onload = async () => {
  await loadBunny;
}
main();
// 'verts'          : vertex positions in three units.
// 'tetIds'         : the indices of vertices that form tetrahedrons in four units.
// 'tetEdgeIds'     : the indices of vertices that form edges in two units.
// 'tetSurfaceTriIds' : the indices of vertices that form triangles of surface in three units.
