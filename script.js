// Setup basic scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set the background color of the scene
renderer.setClearColor(0x87CEEB, 1); // Sky blue color

// Textures
const grassTexture = new THREE.TextureLoader().load('textures/grass.png');
const treeTexture = new THREE.TextureLoader().load('textures/tree.png');

// Inventory
const inventory = [];
let inventoryVisible = false;

// Generate a simple block world using Perlin noise
let blockSize = 1;
let renderDistance = 16; // Initial render distance
const worldWidth = 64;
const worldHeight = 64;
const noiseScale = 0.1;
const simplex = new SimplexNoise();

// Function to create a block
function createBlock(x, y, z, texture) {
    const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x * blockSize, y * blockSize, z * blockSize);
    scene.add(block);
}

// Function to create a tree
function createTree(x, y, z) {
    const trunkGeometry = new THREE.BoxGeometry(blockSize / 2, blockSize, blockSize / 2);
    const trunkMaterial = new THREE.MeshBasicMaterial({ map: treeTexture });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(x * blockSize, y * blockSize + blockSize / 2, z * blockSize);
    scene.add(trunk);

    const leavesGeometry = new THREE.SphereGeometry(blockSize, 8, 8);
    const leavesMaterial = new THREE.MeshBasicMaterial({ color: 0x228B22 });
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.position.set(x * blockSize, y * blockSize + blockSize + blockSize / 2, z * blockSize);
    scene.add(leaves);
}

// Function to generate the world
function generateWorld() {
    for (let x = -renderDistance; x <= renderDistance; x++) {
        for (let z = -renderDistance; z <= renderDistance; z++) {
            const height = Math.floor(simplex.noise2D(x * noiseScale, z * noiseScale) * 5);
            for (let y = 0; y <= height; y++) {
                createBlock(x, y, z, grassTexture);
            }
            if (Math.random() < 0.2) {
                createTree(x, height + 1, z);
            }
        }
    }
}

// Initial call to generate the world
generateWorld();

// Position the camera to be just above the ground
camera.position.set(25, 1.5, 25);

// Player controls
const playerSpeed = 0.1;
const jumpForce = 0.2;
let velocity = new THREE.Vector3(0, 0, 0);
let isJumping = false;
const keys = {};
let mousePressed = false;
let selectedBlock = null;

// Lock the pointer
function lockPointer() {
    document.body.requestPointerLock();
}

// Lock the pointer on mouse click
document.body.addEventListener('click', lockPointer);

// Handle mouse movement for looking around
let pitch = 0; // Up and down rotation (X-axis)
let yaw = 0; // Left and right rotation (Y-axis)
const lookSensitivity = 0.1; // Sensitivity for vertical look

// Crosshair element
const crosshair = document.createElement('div');
crosshair.style.position = 'absolute';
crosshair.style.width = '10px';
crosshair.style.height = '10px';
crosshair.style.backgroundColor = 'white';
crosshair.style.transform = 'translate(-50%, -50%)'; // Center the crosshair
crosshair.style.left = '50%';
crosshair.style.top = '50%';
crosshair.style.pointerEvents = 'none'; // Prevent pointer events
document.body.appendChild(crosshair);

// Mouse movement event listener
document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement) {
        yaw -= event.movementX * lookSensitivity; // Left/right
        pitch -= event.movementY * lookSensitivity; // Up/down

        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch)); // Clamp pitch

        camera.rotation.order = "YXZ"; // Yaw (Y) first, then pitch (X)
        camera.rotation.set(pitch, yaw, 0); // Keep Z-axis (roll) locked at 0
    }
});

// Handle movement
function updatePlayer() {
    velocity.set(0, 0, 0);

    if (keys['KeyS']) {
        velocity.z = playerSpeed;
    } else if (keys['KeyW']) {
        velocity.z = -playerSpeed;
    }

    if (keys['KeyA']) {
        velocity.x = -playerSpeed;
    } else if (keys['KeyD']) {
        velocity.x = playerSpeed;
    }

    if (keys['Space'] && !isJumping) {
        isJumping = true;
        velocity.y = jumpForce;
    }

    if (camera.position.y > 1.5) {
        velocity.y -= 0.01; // Gravity effect
    } else {
        isJumping = false;
        camera.position.y = 1.5; // Reset position
        velocity.y = 0; // Reset vertical velocity
    }

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0; // Ignore vertical direction for horizontal movement
    direction.normalize();

    camera.position.x += direction.x * -velocity.z;
    camera.position.z += direction.z * -velocity.z;
    camera.position.y += velocity.y;

    camera.position.x = Math.max(0, Math.min(camera.position.x, worldWidth - 1));
    camera.position.z = Math.max(0, Math.min(camera.position.z, worldHeight - 1));

    const groundHeight = Math.floor(simplex.noise2D(camera.position.x * noiseScale, camera.position.z * noiseScale) * 5);
    if (camera.position.y < groundHeight + 1.5) {
        camera.position.y = groundHeight + 1.5;
    }
}

// Toggle inventory with 'E' key
window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyE') {
        inventoryVisible = !inventoryVisible;
        console.log('Inventory:', inventory);
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});

// Render distance slider event (add if you have an HTML input element)
const renderDistanceInput = document.getElementById('renderDistance');
const renderDistanceValue = document.getElementById('renderDistanceValue');

if (renderDistanceInput) {
    renderDistanceInput.addEventListener('input', (event) => {
        renderDistance = parseInt(event.target.value);
        renderDistanceValue.textContent = renderDistance;
        regenerateWorld();
    });
}

// Function to regenerate the world based on the render distance
function regenerateWorld() {
    while (scene.children.length) {
        scene.remove(scene.children[0]);
    }
    generateWorld();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer();
    renderer.render(scene, camera);
}

// Start animation
animate();
