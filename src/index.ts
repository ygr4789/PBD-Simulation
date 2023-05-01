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

const boundRange = 20;

const bound_material = new THREE.MeshStandardMaterial();
bound_material.color = new THREE.Color(0x444488);
bound_material.transparent = true;
bound_material.opacity = 0.1;
bound_material.side = THREE.BackSide;

const edge_material = new THREE.LineBasicMaterial();
edge_material.color = new THREE.Color(0xfffffff);

const bound = new THREE.Mesh(new THREE.BoxGeometry(boundRange * 2, boundRange * 2, boundRange * 2), bound_material);
const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(boundRange * 2, boundRange * 2, boundRange * 2)));

scene.add(bound);
scene.add(edges);

// ===================== MAIN =====================

let mouseTracker: THREE.Mesh;

function create_mouse_tracking_ball() {
  const sphereGeo = new THREE.SphereGeometry(1);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0xffea00,
  });
  const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
  mouseTracker = sphereMesh;
  scene.add(mouseTracker);

  // const mouse = new THREE.Vector2();
  // const intersectionPoint = new THREE.Vector3();
  // const planeNormal = new THREE.Vector3();
  // const plane = new THREE.Plane();
  // const raycaster = new THREE.Raycaster();

  // window.addEventListener("mousemove", function (e) {
  //   mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  //   mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  //   planeNormal.copy(camera.position).normalize();
  //   plane.setFromNormalAndCoplanarPoint(planeNormal, scene.position);
  //   raycaster.setFromCamera(mouse, camera);
  //   raycaster.ray.intersectPlane(plane, intersectionPoint);
  //   mouseTracker.position.copy(intersectionPoint);
  // });
  console.log(mouseTracker.geometry);
}
create_mouse_tracking_ball();
//

fetch("src/bunny.json")
  .then((response) => {
    return response.json();
  })
  .then((data) => {
    // console.log(data);
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(data.verts);
    geometry.setIndex(data.tetSurfaceTriIds);
    geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
    geometry.computeTangents();
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial( { color: 0xff0000 } );
    const mesh = new THREE.Mesh(geometry, material)
    mesh.scale.set(10, 10, 10);
    mesh.position.set(-10, 0, 0);
    scene.add(mesh);
    console.log(mesh.geometry);
  });

async function main() {
  let prevTime = 0;
  renderer.setAnimationLoop(animate);

  function animate(timestamp: number) {
    let timediff = (timestamp - prevTime) / 1000;
    renderer.render(scene, camera);
    prevTime = timestamp;
  }
}

// 'verts'          : vertex positions in three units.
// 'tetIds'         : the indices of vertices that form tetrahedrons in four units.
// 'tetEdgeIds'     : the indices of vertices that form edges in two units.
// 'tetSurfaceTriIds' : the indices of vertices that form triangles of surface in three units.

main();
