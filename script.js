// Setup basic scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.setClearColor(0x87CEEB, 1); // Sky blue color

// Textures
const grassTexture = new THREE.TextureLoader().load('textures/grass.png'); // Replace with your grass texture path
const dirtTexture = new THREE.TextureLoader().load('textures/dirt.png'); // Replace with your dirt texture path
const stoneTexture = new THREE.TextureLoader().load('textures/stone.png'); // Replace with your stone texture path

// Inventory
const inventory = [];

// Define chunk size
const chunkSize = 10; // Each chunk is 10x10 blocks
let renderDistance = 4; // Adjusted render distance (in chunks)
const noiseScale = 0.1; // Adjust for terrain smoothness
const simplex = new SimplexNoise();

// Function to create a block
function createBlock(x, y, z, texture) {
    const geometry = new THREE.BoxGeometry(1, 1, 1); // Each block is 1x1
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x, y, z);
    scene.add(block);
}

// Function to generate a single chunk
function generateChunk(chunkX, chunkZ) {
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            const worldX = chunkX * chunkSize + x; // Calculate world position
            const worldZ = chunkZ * chunkSize + z;
            const height = Math.floor(simplex.noise2D(worldX * noiseScale, worldZ * noiseScale) * 5);
            for (let y = 0; y <= height; y++) {
                createBlock(worldX, y, worldZ, grassTexture); // Use grass texture for blocks
            }
        }
    }
}

// Function to regenerate the world based on the render distance
function regenerateWorld() {
    while (scene.children.length) {
        scene.remove(scene.children[0]); // Clear all objects in the scene
    }
    
    const visibleChunks = Math.floor(renderDistance); // Calculate the number of chunks to display
    const startX = Math.floor(camera.position.x / chunkSize) - Math.floor(visibleChunks / 2);
    const startZ = Math.floor(camera.position.z / chunkSize) - Math.floor(visibleChunks / 2);

    for (let chunkX = startX; chunkX < startX + visibleChunks; chunkX++) {
        for (let chunkZ = startZ; chunkZ < startZ + visibleChunks; chunkZ++) {
            generateChunk(chunkX, chunkZ); // Generate visible chunks
        }
    }
}

// Initial call to generate the world
regenerateWorld();

// Position the camera to be just above the ground
camera.position.set(25, 1.5, 25); // Adjust height to be just above the blocks

// Player controls
const playerSpeed = 0.1;
const jumpForce = 0.2; // Jumping force
let velocity = new THREE.Vector3(0, 0, 0);
let isJumping = false;
const keys = {};
let mousePressed = false;

// Handle left mouse button down event
window.addEventListener('mousedown', (event) => {
    if (event.button === 0) { // Left mouse button
        mousePressed = true;
        const selectedBlock = getBlockUnderCursor(); // Get the block under the cursor
        if (selectedBlock) {
            // Add block to inventory and remove from scene
            inventory.push(selectedBlock.material.map); // Store the texture or block type
            scene.remove(selectedBlock); // Remove the block from the scene
        }
    }
});

// Function to get the block under the cursor
function getBlockUnderCursor() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    mouse.x = (window.innerWidth / 2 / window.innerWidth) * 2 - 1; // Centered on screen
    mouse.y = -(window.innerHeight / 2 / window.innerHeight) * 2 + 1; // Centered on screen

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    return intersects.length > 0 ? intersects[0].object : null; // Return the block if intersected
}

// Handle key events
window.addEventListener('keydown', (event) => {
    keys[event.code] = true;
});
window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

// Mouse movement for looking around
let pitch = 0; // Up and down rotation (X-axis)
let yaw = 0; // Left and right rotation (Y-axis)
const lookSensitivity = 0.1; // Sensitivity for vertical look

document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement) {
        yaw -= event.movementX * lookSensitivity; // Left/right
        pitch -= event.movementY * lookSensitivity; // Up/down

        // Clamp pitch to prevent flipping
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

        // Apply camera rotation using Euler angles
        camera.rotation.order = "YXZ"; // Yaw (Y) first, then pitch (X)
        camera.rotation.set(pitch, yaw, 0); // Keep Z-axis (roll) locked at 0
    }
});

// Handle movement
function updatePlayer() {
    velocity.set(0, 0, 0); // Reset velocity

    if (keys['KeyS']) { // Move backward
        velocity.z = playerSpeed; // Move forward
    } else if (keys['KeyW']) { // Move forward
        velocity.z = -playerSpeed; // Move backward
    }

    if (keys['KeyA']) { // Move left
        velocity.x = -playerSpeed;
    } else if (keys['KeyD']) { // Move right
        velocity.x = playerSpeed;
    }

    // Jumping logic
    if (keys['Space'] && !isJumping) {
        isJumping = true;
        velocity.y = jumpForce; // Initial jump velocity
    }

    // Apply gravity
    if (camera.position.y > 1.5) {
        velocity.y -= 0.01; // Gravity effect
    } else {
        isJumping = false; // Reset jumping when hitting the ground
        camera.position.y = 1.5; // Ensure the camera stays above ground
        velocity.y = 0; // Reset vertical velocity when on the ground
    }

    // Move the camera based on the direction it's facing
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction); // Get the direction the camera is facing
    direction.y = 0; // Ignore vertical direction for horizontal movement
    direction.normalize(); // Normalize direction to ensure consistent speed

    // Calculate the target position before applying movement
    const targetPosition = camera.position.clone().addScaledVector(direction, -velocity.z);
    targetPosition.x += direction.x * velocity.x;
    targetPosition.z += direction.z * velocity.x;

    // Check collision with ground (improved method)
    const groundHeight = Math.floor(simplex.noise2D(targetPosition.x * noiseScale, targetPosition.z * noiseScale) * 5);
    if (targetPosition.y < groundHeight + 1.5) {
        // Align player on top of the block
        camera.position.y = groundHeight + 1.5; // Place the camera on top of the ground
        isJumping = false; // Prevent jumping if on ground
        velocity.y = 0; // Reset vertical velocity
    } else {
        // If not colliding with ground, update the position
        camera.position.copy(targetPosition);
    }

    // Constrain camera within bounds
    camera.position.x = Math.max(0, Math.min(camera.position.x, chunkSize * renderDistance - 1)); 
    camera.position.z = Math.max(0, Math.min(camera.position.z, chunkSize * renderDistance - 1));
}

// Handle window resize
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});

// Render distance slider event
const renderDistanceInput = document.getElementById('renderDistance');
const renderDistanceValue = document.getElementById('renderDistanceValue');

renderDistanceInput.addEventListener('input', (event) => {
    renderDistance = event.target.value; // Update render distance based on slider
    renderDistanceValue.innerText = `Render Distance: ${renderDistance}`;
    regenerateWorld(); // Regenerate world with new render distance
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer(); // Update player movement
    renderer.render(scene, camera);
}

animate(); // Start the animation loop
