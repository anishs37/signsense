// HTML elements
const videoElement = document.getElementsByClassName("input_video")[0];
const letterDisplay = document.createElement("div");
const skipButton = document.createElement("button");
const scoreDisplay = document.createElement("div");
const timerDisplay = document.createElement("div");
const container = document.createElement("div");

// UI Container moved to the left
container.style.position = "absolute";
container.style.top = "10px";
container.style.left = "10px";
container.style.zIndex = "100";
document.body.appendChild(container);

letterDisplay.style.fontSize = "24px";
container.appendChild(letterDisplay);

skipButton.innerText = "Skip";
skipButton.style.display = "block";
skipButton.style.marginTop = "10px";
container.appendChild(skipButton);

scoreDisplay.innerText = "Score: 0";
scoreDisplay.style.marginTop = "10px";
container.appendChild(scoreDisplay);

timerDisplay.style.marginTop = "10px";
container.appendChild(timerDisplay);

// Timer setup
let timeLeft = 10;
let timerInterval;
let isTweening = false;

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (isTweening) return;
        timerDisplay.innerText = `Time Left: ${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            stopTrackingAndTween().then(() => {
                setRandomLetter();
                startTimer();
            });
        }
        timeLeft--;
    }, 1000);
}
startTimer();

// Three.js setup
const scene = new THREE.Scene();
const camera3j = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
camera3j.position.set(0, 0, 2);
camera3j.lookAt(0, 0, 0);

const obj = new THREE.Object3D();
const joints = [], bones = [];
const sphereGeometry = new THREE.SphereGeometry(0.015, 32, 16);
const cylinderGeometry = new THREE.CylinderGeometry(0.01, 0.01, 1, 16);
const material = new THREE.MeshNormalMaterial();
const boneMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

for (let i = 0; i < 21; i++) {
    const sphere = new THREE.Mesh(sphereGeometry, material);
    obj.add(sphere);
    joints.push(sphere);
}

const boneConnections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
];

boneConnections.forEach(([start, end]) => {
    const bone = new THREE.Mesh(cylinderGeometry, boneMaterial);
    obj.add(bone);
    bones.push({ bone, start, end });
});

scene.add(obj);

// MediaPipe Hands
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

const camera = new Camera(videoElement, {
    onFrame: async () => await hands.send({ image: videoElement }),
    width: 1280,
    height: 720
});
camera.start();

// Prevent hand tracking from overriding tween animations
hands.onResults((d) => {
    if (isTweening || !d.multiHandLandmarks.length) return;

    const landmarks = d.multiHandLandmarks[0];
    joints.forEach((joint, i) => {
        if (landmarks[i]) {
            joint.position.set(
                -(landmarks[i].x - landmarks[0].x), 
                -(landmarks[i].y - landmarks[0].y), 
                0.6 + (landmarks[i].z - landmarks[0].z)
            );
            joint.visible = true;
        }
    });

    updateBones();
});

// Function to update bone positions, scaling, and rotation
function updateBones() {
    bones.forEach(({ bone, start, end }) => {
        const startJoint = joints[start].position;
        const endJoint = joints[end].position;
        const direction = new THREE.Vector3().subVectors(endJoint, startJoint);
        const midPoint = new THREE.Vector3().addVectors(startJoint, endJoint).multiplyScalar(0.5);
        const length = direction.length();

        bone.position.copy(midPoint);
        bone.scale.set(1, length, 1);

        const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.clone().normalize()
        );
        bone.setRotationFromQuaternion(quaternion);
    });
}

// Tween Animation Function (Now includes bones)
async function tweenUpdate(oldPositions, newPositions) {
    isTweening = true;
    console.log("Tween animation started...");

    for (let t = 0; t <= 1; t += 0.05) {
        joints.forEach((joint, i) => {
            joint.position.lerpVectors(oldPositions[i], newPositions[i], t);
        });

        updateBones(); // Ensure bones update in sync

        await new Promise(resolve => setTimeout(resolve, 30));
    }

    console.log("Tween animation complete.");
}

function compareHands(hand1, hand2, threshold) {
  if (!hand1 || !hand2 || !hand1.keypoints3D || !hand2.keypoints3D) {
      console.error("Invalid hand data.");
      return { similar: false };
  }

  let totalDifference = 0;
  let different = [];
  let maxDifference = 0;
  let maxDifferenceJoint = null;
  const numKeypoints = hand1.keypoints3D.length;

  if (numKeypoints !== hand2.keypoints3D.length) {
      console.error("Mismatch in keypoint count.");
      return { similar: false };
  }

  // Get the wrist (joint 0) and a reference joint (index finger MCP, joint 5)
  const wrist1 = hand1.keypoints3D[0];
  const wrist2 = hand2.keypoints3D[0];

  const refJoint1 = hand1.keypoints3D[5]; // Reference joint for scaling
  const refJoint2 = hand2.keypoints3D[5];

  // Compute scale factor (distance from wrist to reference joint)
  const scale1 = Math.sqrt(
      Math.pow(refJoint1.x - wrist1.x, 2) +
      Math.pow(refJoint1.y - wrist1.y, 2) +
      Math.pow(refJoint1.z - wrist1.z, 2)
  );

  const scale2 = Math.sqrt(
      Math.pow(refJoint2.x - wrist2.x, 2) +
      Math.pow(refJoint2.y - wrist2.y, 2) +
      Math.pow(refJoint2.z - wrist2.z, 2)
  );

  if (scale1 === 0 || scale2 === 0) {
      console.error("Scaling error: Reference joint distance is zero.");
      return { similar: false };
  }

  for (let i = 0; i < numKeypoints; i++) {
      let kp1 = hand1.keypoints3D[i];
      let kp2 = hand2.keypoints3D[i];

      // Normalize positions relative to the wrist
      let normalizedKp1 = {
          x: (kp1.x - wrist1.x) / scale1,
          y: (kp1.y - wrist1.y) / scale1,
          z: (kp1.z - wrist1.z) / scale1
      };

      let normalizedKp2 = {
          x: (kp2.x - wrist2.x) / scale2,
          y: (kp2.y - wrist2.y) / scale2,
          z: (kp2.z - wrist2.z) / scale2
      };

      // Compute Euclidean distance between the corresponding keypoints
      let distance = Math.sqrt(
          Math.pow(normalizedKp1.x - normalizedKp2.x, 2) +
          Math.pow(normalizedKp1.y - normalizedKp2.y, 2)
      );

      totalDifference += distance;

      if (distance > maxDifference) {
          maxDifference = distance;
          maxDifferenceJoint = i; // Index of the joint with the maximum difference
      }

      if (distance > threshold) {
          different.push(i);
      }
  }

  let avgDifference = totalDifference / numKeypoints;
  let similar = maxDifference <= threshold;

  return { similar, maxDifferenceJoint, maxDifference, different };
}


// Transition to new letter
async function stopTrackingAndTween() {
  isTweening = true;
  timerDisplay.innerText = "Checking...";

  const letterBeingChecked = currentLetter; // Lock the letter in place

  const currentHandData = { keypoints3D: joints.map(joint => ({
      x: -joint.position.x,
      y: -joint.position.y,
      z: joint.position.z - 0.6
  }))};

  try {
      const response = await fetch(`public/assets/alphabet/${letterBeingChecked}.json`);
      if (!response.ok) throw new Error("JSON not found");
      const storedData = await response.json();

      const { similar, different } = compareHands(currentHandData, storedData[0], 0.4);

      if (similar) {
          alert(`Yay! You got ${letterBeingChecked} correct 🎉`);

          // Wait before changing the letter
          setTimeout(() => {
              setRandomLetter();
              letterDisplay.innerText = `Letter: ${currentLetter}`;
              timerDisplay.innerText = `Time Left: 10s`; // Reset timer UI
              startTimer();
          }, 1000);

          isTweening = false;
          return;
      }

      // Show incorrect feedback
      const redMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      different.forEach(index => {
          joints[index].material = redMaterial;
      });

      setTimeout(() => {
          different.forEach(index => {
              joints[index].material = new THREE.MeshNormalMaterial();
          });

          performTweenAnimation(storedData[0], letterBeingChecked); // Pass locked letter
      }, 1000);
  } catch (error) {
      console.error("Error loading JSON:", error);
      isTweening = false;
  }
}



// Function to handle tween animation after incorrect attempt
async function performTweenAnimation(storedData, letterBeingChecked) {
  timerDisplay.innerText = `Showing Correct Letter: ${letterBeingChecked}`;
  letterDisplay.innerText = `The correct letter was: ${letterBeingChecked}`;

  const oldPositions = joints.map(joint => joint.position.clone());
  const newPositions = storedData.keypoints3D.map(lm => new THREE.Vector3(
      -(lm.x - storedData.keypoints3D[0].x),
      -(lm.y - storedData.keypoints3D[0].y),
      0.6 + (lm.z - storedData.keypoints3D[0].z)
  ));

  await tweenUpdate(oldPositions, newPositions);

  setTimeout(() => {
      setRandomLetter();
      letterDisplay.innerText = `Letter: ${currentLetter}`; 
      startTimer();
      isTweening = false;
  }, 3000);
}





// Letter Selection & Evaluation
let currentLetter = "A";
function setRandomLetter() {
    const alphabet = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");
    currentLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
    letterDisplay.innerText = `Letter: ${currentLetter}`;
    timeLeft = 10;
}
setRandomLetter();

skipButton.addEventListener("click", () => {
    clearInterval(timerInterval);
    stopTrackingAndTween().then(() => {
        setRandomLetter();
        startTimer();
    });
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera3j);
}
animate();
