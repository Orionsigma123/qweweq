// Setup basic scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set the background color of the scene
renderer.setClearColor(0x87CEEB, 1);

// Textures
const grassTexture = new THREE.TextureLoader().load('textures/grass.png');
const dirtTexture = new THREE.TextureLoader().load('textures/dirt.png');
const stoneTexture = new THREE.TextureLoader().load('textures/stone.png');

// Inventory
const inventory = [];

// Store worlds data
const worlds = {};

// World settings
const chunkSize = 16; // Size of each chunk
const chunkHeight = 5; // Max height of blocks in a chunk
let renderDistance = 4; // Number of chunks to render around the player
let noiseScale = 0.1; // Adjust for terrain smoothness
let simplex = new SimplexNoise(); // Initialize SimplexNoise
const chunks = {}; // Object to store generated chunks

// Function to create a block
function createBlock(x, y, z, texture, type) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x, y, z);
    block.userData = { type }; // Add type to block for identification
    return block;
}

// Function to generate a chunk
function generateChunk(chunkX, chunkZ) {
    const chunk = new THREE.Group(); // Group to hold all blocks in this chunk
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            // Generate height based on Simplex noise
            const height = Math.floor(simplex.noise2D((chunkX * chunkSize + x) * noiseScale, (chunkZ * chunkSize + z) * noiseScale) * chunkHeight);

            for (let y = 0; y <= height; y++) {
                let texture = grassTexture; // Default texture for the top block
                let type = 'grass'; // Default block type

                if (y < height - 1) {
                    texture = dirtTexture; // Dirt for blocks below the surface
                    type = 'dirt';
                }
                if (y === height) {
                    texture = grassTexture; // Grass on top
                    type = 'grass';
                } else if (y < height - 1) {
                    texture = stoneTexture; // Stone for below dirt
                    type = 'stone';
                }
                
                const block = createBlock(chunkX * chunkSize + x, y, chunkZ * chunkSize + z, texture, type);
                chunk.add(block);
            }
        }
    }
    chunks[`${chunkX},${chunkZ}`] = chunk; // Store the chunk in the chunks object
    scene.add(chunk); // Add the chunk to the scene
}

// Function to update the visible chunks based on player's position
function updateChunks() {
    const playerChunkX = Math.floor(camera.position.x / chunkSize);
    const playerChunkZ = Math.floor(camera.position.z / chunkSize);

    // Determine which chunks to render
    const renderedChunks = new Set(); // Keep track of rendered chunks

    for (let x = -renderDistance; x <= renderDistance; x++) {
        for (let z = -renderDistance; z <= renderDistance; z++) {
            const chunkKey = `${playerChunkX + x},${playerChunkZ + z}`;
            if (!chunks[chunkKey]) {
                generateChunk(playerChunkX + x, playerChunkZ + z); // Generate chunk if it doesn't exist
            }
            renderedChunks.add(chunkKey); // Add to the set of rendered chunks
        }
    }

    // Remove chunks that are not in the rendered set
    for (const key in chunks) {
        if (!renderedChunks.has(key)) {
            scene.remove(chunks[key]); // Remove chunk from the scene
            delete chunks[key]; // Remove from chunks object
        }
    }
}

// Function to create a new world
function makeNewWorld() {
    // Clear existing chunks
    for (const key in chunks) {
        scene.remove(chunks[key]);
        delete chunks[key];
    }

    // Reset the inventory
    inventory.length = 0; // Clear the inventory

    // Regenerate the noise generator with a new seed
    simplex = new SimplexNoise(Math.random); // Create a new SimplexNoise instance

    // Regenerate the world
    updateChunks(); // Call to generate new chunks
    document.getElementById('message').textContent = "New world created!";
}

// Initial call to generate chunks based on the initial player position
updateChunks();

// Position the camera to be just above the ground
camera.position.set(25, 1.5, 25);

// Player controls
const playerSpeed = 0.1;
const jumpForce = 0.2;
let velocity = new THREE.Vector3(0, -0.01, 0); // Apply gravity
let isJumping = false;
const keys = {};
let mousePressed = false;
let selectedBlock = null;

// Crosshair setup
const crosshairSize = 10; // Crosshair size in pixels
const crosshairColor = 'red'; // Crosshair color

// Create a crosshair element
const crosshair = document.createElement('div');
crosshair.style.position = 'absolute';
crosshair.style.width = `${crosshairSize}px`;
crosshair.style.height = `${crosshairSize}px`;
crosshair.style.backgroundColor = crosshairColor;
crosshair.style.border = `1px solid ${crosshairColor}`;
crosshair.style.transform = 'translate(-50%, -50%)';
crosshair.style.pointerEvents = 'none'; // Prevent mouse events on the crosshair
document.body.appendChild(crosshair);

// Update crosshair position
function updateCrosshair() {
    const screenPosition = new THREE.Vector3(0, 0, -5).applyMatrix4(camera.matrixWorld);
    const vector = screenPosition.project(camera);
    
    const x = (vector.x * .5 + .5) * window.innerWidth;
    const y = (-(vector.y * .5) + .5) * window.innerHeight;

    crosshair.style.left = `${x}px`;
    crosshair.style.top = `${y}px`;
}

// Function to lock the mouse pointer
function lockPointer() {
    document.body.requestPointerLock();
}

// Lock the pointer on mouse click
document.body.addEventListener('click', lockPointer);

// Mouse movement for looking around
let pitch = 0;
let yaw = 0;
const lookSensitivity = 0.1;

// Adjust the camera rotation logic to lock the Z-axis (roll)
document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement) {
        yaw -= event.movementX * lookSensitivity;
        pitch -= event.movementY * lookSensitivity;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        camera.rotation.order = "YXZ";
        camera.rotation.set(pitch, yaw, 0);
    }
});

// Function to check for collisions
function checkCollisions(newPosition) {
    const raycaster = new THREE.Raycaster(camera.position, newPosition.clone().sub(camera.position).normalize());

    raycaster.far = 1; // Check collision within a range of 1 unit
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const distance = intersects[0].distance;
        if (distance < 0.6) { // Adjust based on the player's height to climb blocks
            return true; // Block collision, stop movement
        }
    }
    return false;
}

// Function to detect if the player is grounded (standing on a block)
function isGrounded() {
    const downRay = new THREE.Raycaster(camera.position, new THREE.Vector3(0, -1, 0));
    downRay.far = 1.6; // Ray length slightly below the player to detect the ground

    const intersects = downRay.intersectObjects(scene.children, true);
    return intersects.length > 0; // If there's any object beneath the player
}

// Function to handle player movement based on head orientation
function updatePlayer() {
    velocity.set(0, -0.01, 0); // Apply gravity to always pull down slightly

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation);

    forward.y = 0; // Prevent vertical movement when moving forward/backward
    right.y = 0;   // Prevent vertical movement when strafing

    forward.normalize();
    right.normalize();

    if (keys['KeyW']) {
        velocity.add(forward.clone().multiplyScalar(playerSpeed));
    }
    if (keys['KeyS']) {
        velocity.add(forward.clone().multiplyScalar(-playerSpeed));
    }
    if (keys['KeyA']) {
        velocity.add(right.clone().multiplyScalar(-playerSpeed));
    }
    if (keys['KeyD']) {
        velocity.add(right.clone().multiplyScalar(playerSpeed));
    }

    // Jumping logic
    if (keys['Space'] && isGrounded()) {
        velocity.y = jumpForce;
    }

    const newPosition = camera.position.clone().add(velocity);

    // Check for collisions with blocks
    if (!checkCollisions(newPosition)) {
        camera.position.copy(newPosition);
    }

    updateCrosshair();
}

// Handle keyboard input
document.addEventListener('keydown', (event) => {
    keys[event.code] = true;
});

document.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

// Render loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer(); // Update player position
    updateChunks(); // Update visible chunks
    renderer.render(scene, camera);
}

// Start the animation loop
animate();
