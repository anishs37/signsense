// HTML element references
const videoElement = document.getElementsByClassName("input_video")[0];

// Three.js essentials
const scene = new THREE.Scene();
const camera3j = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Camera initial position
let angle = 1.57;
let radius = 2;
camera3j.position.set(
  radius * Math.cos(angle),
  0,
  radius * Math.sin(angle)
);
camera3j.lookAt(0, 0, 0);

// Create a hand-like structure using spheres and cylinders
const obj = new THREE.Object3D();
const joints = [];
const bones = [];
const sphereGeometry = new THREE.SphereGeometry(0.015, 32, 16);
const cylinderGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1, 16);
const material = new THREE.MeshNormalMaterial();
const boneMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

// Create the 21 spheres (joints)
for (let i = 0; i < 21; i++) {
  const sphere = new THREE.Mesh(sphereGeometry, material);
  obj.add(sphere);
  joints.push(sphere);
}

// Create bones connecting the joints
const boneConnections = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0,17]
];

boneConnections.forEach(([start, end]) => {
  const bone = new THREE.Mesh(cylinderGeometry, boneMaterial);
  obj.add(bone);
  bones.push({ bone, start, end });
});

scene.add(obj);

// MediaPipe Hands + camera
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 1280,
  height: 720,
});
camera.start();

function onResults(d) {
  if (d.multiHandLandmarks.length === 0) {
    joints.forEach((joint) => (joint.visible = false));
    bones.forEach(({ bone }) => (bone.visible = false));
    return;
  }

  const landmarks = d.multiHandLandmarks[0];
  const wrist = landmarks[0];

  // Update joint positions
  joints.forEach((joint, i) => {
    const lm = landmarks[i];
    joint.position.set(-(lm.x - wrist.x), -(lm.y - wrist.y), 0.6 + (lm.z - wrist.z));
    joint.visible = true;
  });

  // Update bones positions and rotations
  bones.forEach(({ bone, start, end }) => {
    const startJoint = joints[start].position;
    const endJoint = joints[end].position;
    
    const direction = new THREE.Vector3().subVectors(endJoint, startJoint);
    const midPoint = new THREE.Vector3().addVectors(startJoint, endJoint).multiplyScalar(0.5);
    const length = direction.length();
    
    bone.position.copy(midPoint);
    bone.scale.set(1, length, 1); // Scale the bone based on joint distance
    
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    );
    bone.setRotationFromQuaternion(quaternion);
    
    bone.visible = true;
  });
}

hands.onResults(onResults);

// Animate render loop
function animate() {
  requestAnimationFrame(animate);
  camera3j.lookAt(0, 0, 0);
  renderer.render(scene, camera3j);
}
animate();
