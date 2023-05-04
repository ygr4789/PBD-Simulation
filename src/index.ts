import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const scene = new THREE.Scene();
const setcolor = 0xbbbbbb;
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

// ===================== MAIN =====================

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
    constructor(file: parsedData, _scene: THREE.Scene) {
        // this.init_positions
        this.init_positions = file.verts;
        this.positions = [];
        this.velocities = [];

        for (let i = 0; i < this.init_positions.length / 3; i++) {
            this.positions.push(new THREE.Vector3(this.init_positions[3 * i], this.init_positions[3 * i + 1], this.init_positions[3 * i + 2]));
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

    update() {
        // Dummy Velocity (Going Up)
        for (let i = 0; i < this.positions.length; i++) this.velocities[i] = new THREE.Vector3(0.0, 0.01, 0.0);

        // Dummy Position Update
        for (let i = 0; i < this.positions.length; i++) {
            this.positions[i].add(this.velocities[i]);
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

let bunny: SoftBodyObject;

function main() {
    let prevTime = 0;
    renderer.setAnimationLoop(animate);

    function animate(timestamp: number) {
        let timediff = (timestamp - prevTime) / 1000;
        if (timestamp > 5000) return;
        updateStates(timediff);
        renderer.render(scene, camera);
        prevTime = timestamp;
    }
    function updateStates(dt: number) {
        bunny.update();
    }
}

window.onload = async () => {
    await loadBunny();
    bunny = new SoftBodyObject(bunnyData, scene);
    main();
};
