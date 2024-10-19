// Setup basic scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true }); // Enable alpha for transparency
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set the background color of the scene
renderer.setClearColor(0x87CEEB, 1); // Sky blue color

// Textures
const grassTexture = new THREE.TextureLoader().load('Textures/grass.png'); // Replace with your grass texture path
const cobblestoneTexture = new THREE.TextureLoader().load('Textures/stone.png');
const dirtTexture = new THREE.TextureLoader().load('Textures/dirt.png');

// Inventory system (Array to store collected blocks)
const inventory = [];

// Block-breaking crosshair logic
const crosshair = document.createElement('div');
crosshair.style.width = '20px';
crosshair.style.height = '20px';
crosshair.style.position = 'absolute';
crosshair.style.top = '50%';
crosshair.style.left = '50%';
crosshair.style.transform = 'translate(-50%, -50%)';
crosshair.style.border = '2px solid black';
document.body.appendChild(crosshair);

// Block parameters and world generation settings
const blockSize = 1;
const renderDistance = 4; // Adjust render distance for performance
const chunkSize = 16;
const chunkHeight = 5;
const noiseScale = 0.1;
const simplex = new SimplexNoise();

// Function to create a block
function createBlock(x, y, z, texture) {
    const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x * blockSize, y * blockSize, z * blockSize);
    block.userData = { isBlock: true }; // Tag the object as a block
    scene.add(block);
}

// Generate world using Simplex noise
function generateChunk(xOffset, zOffset) {
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            const worldX = x + xOffset;
            const worldZ = z + zOffset;
            const height = Math.floor(simplex.noise2D(worldX * noiseScale, worldZ * noiseScale) * chunkHeight);
            for (let y = 0; y <= height; y++) {
                const texture = (y === height) ? grassTexture : dirtTexture; // Grass on top, dirt below
                createBlock(worldX, y, worldZ, texture);
            }
        }
    }
}

// Generate initial chunks around the player
generateChunk(0, 0);

// Player controls
const playerSpeed = 0.1;
const jumpForce = 0.2; // Jumping force
let velocity = new THREE.Vector3(0, 0, 0);
let isJumping = false;
const keys = {};
let mousePressed = false;
let selectedBlock = null;

// Capture key presses
window.addEventListener('keydown', (event) => {
    keys[event.code] = true;
});
window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

// Handle left mouse button down (for breaking blocks)
window.addEventListener('mousedown', (event) => {
    if (event.button === 0) { // Left mouse button
        mousePressed = true;
        selectedBlock = getBlockUnderCursor();
    }
});

// Handle left mouse button up
window.addEventListener('mouseup', (event) => {
    if (event.button === 0 && selectedBlock) { // Left mouse button
        inventory.push(selectedBlock.material.map); // Add block to inventory
        scene.remove(selectedBlock); // Remove the block from the scene
        selectedBlock = null;
        mousePressed = false;
    }
});

// Raycasting logic to get the block under the cursor
function getBlockUnderCursor() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    return intersects.length > 0 ? intersects[0].object : null;
}

// Mouse movement for camera control (lock pointer)
let pitch = 0;
let yaw = 0;
const lookSensitivity = 0.1;
document.body.addEventListener('click', () => {
    document.body.requestPointerLock();
});
document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement) {
        yaw -= event.movementX * lookSensitivity;
        pitch -= event.movementY * lookSensitivity;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        camera.rotation.order = 'YXZ';
        camera.rotation.set(pitch, yaw, 0);
    }
});

// Player movement logic
function updatePlayer() {
    velocity.set(0, 0, 0);

    if (keys['KeyW']) velocity.z = -playerSpeed;
    if (keys['KeyS']) velocity.z = playerSpeed;
    if (keys['KeyA']) velocity.x = -playerSpeed;
    if (keys['KeyD']) velocity.x = playerSpeed;

    if (keys['Space'] && !isJumping) {
        isJumping = true;
        velocity.y = jumpForce;
    }

    if (camera.position.y > 1.5) {
        velocity.y -= 0.01; // Gravity
    } else {
        isJumping = false;
        camera.position.y = 1.5;
        velocity.y = 0;
    }

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0; // Ignore vertical movement
    direction.normalize();

    camera.position.x += direction.x * -velocity.z;
    camera.position.z += direction.z * -velocity.z;
    camera.position.y += velocity.y;

    // Prevent player from phasing through blocks
    const groundHeight = Math.floor(simplex.noise2D(camera.position.x * noiseScale, camera.position.z * noiseScale) * chunkHeight);
    if (camera.position.y < groundHeight + 1.5) {
        camera.position.y = groundHeight + 1.5;
    }
}

// Handle window resizing
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});

// Render loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer(); // Update player movement
    renderer.render(scene, camera);
}

// Start the render loop
animate();
