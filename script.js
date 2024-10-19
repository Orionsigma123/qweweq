import * as THREE from 'three';
import SimplexNoise from 'simplex-noise';

// Scene, Camera, and Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Basic player settings
let player = {
  position: new THREE.Vector3(0, 50, 0),
  chunkX: 0,
  chunkZ: 0,
  renderDistance: 10  // in chunks
};

camera.position.set(player.position.x, player.position.y + 2, player.position.z);
camera.lookAt(player.position.x, player.position.y, player.position.z);

// Chunks and Noise
const CHUNK_SIZE = 16;  // Size of one chunk
const simplex = new SimplexNoise();
let chunks = new Map();  // Store the chunks

// Terrain Generation (Simplex Noise)
function generateTerrainChunk(chunkX, chunkZ) {
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE - 1, CHUNK_SIZE - 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x8b4513, wireframe: false });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE);

  // Apply Simplex Noise for terrain height
  for (let i = 0; i < geometry.vertices.length; i++) {
    let vertex = geometry.vertices[i];
    let x = vertex.x + chunkX * CHUNK_SIZE;
    let z = vertex.z + chunkZ * CHUNK_SIZE;
    let noiseValue = simplex.noise2D(x / 50, z / 50); // Noise scale
    vertex.y = noiseValue * 20; // Adjust height range
  }
  geometry.verticesNeedUpdate = true;

  return mesh;
}

// Generate chunks around player
function generateChunksAroundPlayer() {
  let playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
  let playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);

  for (let x = playerChunkX - player.renderDistance; x <= playerChunkX + player.renderDistance; x++) {
    for (let z = playerChunkZ - player.renderDistance; z <= playerChunkZ + player.renderDistance; z++) {
      let chunkKey = `${x},${z}`;

      if (!chunks.has(chunkKey)) {
        let chunkMesh = generateTerrainChunk(x, z);
        scene.add(chunkMesh);
        chunks.set(chunkKey, chunkMesh);
      }
    }
  }
}

// Remove chunks too far away from the player
function removeFarChunks() {
  let playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
  let playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);

  for (let [chunkKey, chunkMesh] of chunks) {
    let [chunkX, chunkZ] = chunkKey.split(',').map(Number);

    let distance = Math.max(Math.abs(chunkX - playerChunkX), Math.abs(chunkZ - playerChunkZ));

    if (distance > player.renderDistance + 1) { // Extra buffer
      scene.remove(chunkMesh);
      chunks.delete(chunkKey);
    }
  }
}

// Main loop
function animate() {
  requestAnimationFrame(animate);

  // Generate and remove chunks
  generateChunksAroundPlayer();
  removeFarChunks();

  renderer.render(scene, camera);
}

animate();

// Basic controls (WASD for movement)
document.addEventListener('keydown', (e) => {
  let moveSpeed = 1; // Adjust player speed

  switch (e.code) {
    case 'KeyW':
      player.position.x += Math.sin(camera.rotation.y) * moveSpeed;
      player.position.z += Math.cos(camera.rotation.y) * moveSpeed;
      break;
    case 'KeyS':
      player.position.x -= Math.sin(camera.rotation.y) * moveSpeed;
      player.position.z -= Math.cos(camera.rotation.y) * moveSpeed;
      break;
    case 'KeyA':
      player.position.x -= Math.sin(camera.rotation.y + Math.PI / 2) * moveSpeed;
      player.position.z -= Math.cos(camera.rotation.y + Math.PI / 2) * moveSpeed;
      break;
    case 'KeyD':
      player.position.x += Math.sin(camera.rotation.y + Math.PI / 2) * moveSpeed;
      player.position.z += Math.cos(camera.rotation.y + Math.PI / 2) * moveSpeed;
      break;
    case 'ArrowLeft':
      camera.rotation.y += 0.05;
      break;
    case 'ArrowRight':
      camera.rotation.y -= 0.05;
      break;
  }

  // Update camera position with player movement
  camera.position.set(player.position.x, player.position.y + 2, player.position.z);
});

// Resize the canvas when window is resized
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
