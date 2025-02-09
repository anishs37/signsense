"use client";

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import dynamic from 'next/dynamic';

// Import MediaPipe components
const Camera = dynamic(
  () => import('@mediapipe/camera_utils/camera_utils').then((mod) => mod.Camera),
  { ssr: false }
);

const Hands = dynamic(
  () => import('@mediapipe/hands/hands').then((mod) => mod.Hands),
  { ssr: false }
);

export default function CameraLesson() {
  const [currentLetter, setCurrentLetter] = useState('A');
  const [timeLeft, setTimeLeft] = useState(10);
  const [score, setScore] = useState(0);
  const [isTweening, setIsTweening] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  
  const jointsRef = useRef([]);
  const bonesRef = useRef([]);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const videoRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const animationRef = useRef(null);
  const handsRef = useRef(null);
  const cameraInstanceRef = useRef(null);
  const containerRef = useRef(null);

  // Initialize dimensions on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (typeof window === 'undefined') return;
    jointsRef.current = []; 

    sceneRef.current = new THREE.Scene();
    cameraRef.current = new THREE.PerspectiveCamera(75, dimensions.width / dimensions.height, 0.1, 1000);
    rendererRef.current = new THREE.WebGLRenderer({ alpha: true });
    rendererRef.current.setSize(dimensions.width, dimensions.height);
    
    if (containerRef.current) {
      containerRef.current.appendChild(rendererRef.current.domElement);
    }

    cameraRef.current.position.set(0, 0, 2);
    cameraRef.current.lookAt(0, 0, 0);

    const obj = new THREE.Object3D();
    const sphereGeometry = new THREE.SphereGeometry(0.015, 32, 16);
    const cylinderGeometry = new THREE.CylinderGeometry(0.01, 0.01, 1, 16);
    const material = new THREE.MeshNormalMaterial();
    const boneMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Create joints
    for (let i = 0; i < 21; i++) {
      const sphere = new THREE.Mesh(sphereGeometry, material);
      obj.add(sphere);
      jointsRef.current.push(sphere);
    }

    // Create bones
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
      bonesRef.current.push({ bone, start, end });
    });

    sceneRef.current.add(obj);

    // Handle window resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setDimensions({ width, height });
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && rendererRef.current?.domElement) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [dimensions.width, dimensions.height]);

  // Initialize MediaPipe Hands
  useEffect(() => {
    if (typeof window === 'undefined' || !Camera || !Hands || !videoRef.current) return;

    const initializeMediaPipe = async () => {
      try {
        const HandsModule = await import('@mediapipe/hands/hands');
        handsRef.current = new HandsModule.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        await handsRef.current.initialize();

        handsRef.current.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        handsRef.current.onResults((results) => {
            if (!isTweening && results.multiHandLandmarks?.[0]) {
              const landmarks = results.multiHandLandmarks[0];
              
              // Add debug logging
              
              console.log(jointsRef.current.length)
              jointsRef.current.forEach((joint, i) => {
                if (landmarks[i]) {
                  // Store the calculated position for debugging
                  const newX = -(landmarks[i].x - landmarks[0].x);
                  const newY = -(landmarks[i].y - landmarks[0].y);
                  const newZ = 0.6 + (landmarks[i].z - landmarks[0].z);
                  
                  // Set the position
                  joint.position.set(newX, newY, newZ);
                  joint.visible = true;
                }
              });
              updateBones();
            }
          });

        const CameraModule = await import('@mediapipe/camera_utils/camera_utils');
        cameraInstanceRef.current = new CameraModule.Camera(videoRef.current, {
          onFrame: async () => {
            await handsRef.current.send({ image: videoRef.current });
          },
          width: 1280,
          height: 720
        });

        await cameraInstanceRef.current.start();
        startTimer();
        setIsLoaded(true);
      } catch (error) {
        console.error('Error initializing MediaPipe:', error);
      }
    };

    initializeMediaPipe();

    return () => {
      if (cameraInstanceRef.current) {
        cameraInstanceRef.current.stop();
      }
      if (handsRef.current) {
        handsRef.current.close();
      }
      clearInterval(timerIntervalRef.current);
    };
  }, [isTweening]);

  // Animation loop
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    const animate = () => {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const updateBones = () => {
    bonesRef.current.forEach(({ bone, start, end }) => {
      const startJoint = jointsRef.current[start].position;
      const endJoint = jointsRef.current[end].position;
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
  };

  const tweenUpdate = async (oldPositions, newPositions) => {
    setIsTweening(true);
    console.log("Tween animation started...");

    for (let t = 0; t <= 1; t += 0.05) {
      jointsRef.current.forEach((joint, i) => {
        joint.position.lerpVectors(oldPositions[i], newPositions[i], t);
      });

      updateBones();
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    console.log("Tween animation complete.");
  };

  const compareHands = (hand1, hand2, threshold) => {
    console.log(hand1.keypoints3D);
    console.log(hand1.keypoints3D.length);
    console.log(hand2.keypoints3D.length);
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

    const wrist1 = hand1.keypoints3D[0];
    const wrist2 = hand2.keypoints3D[0];
    const refJoint1 = hand1.keypoints3D[5];
    const refJoint2 = hand2.keypoints3D[5];

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

      let distance = Math.sqrt(
        Math.pow(normalizedKp1.x - normalizedKp2.x, 2) +
        Math.pow(normalizedKp1.y - normalizedKp2.y, 2)
      );

      totalDifference += distance;

      if (distance > maxDifference) {
        maxDifference = distance;
        maxDifferenceJoint = i;
      }

      if (distance > threshold) {
        different.push(i);
      }
    }

    let avgDifference = totalDifference / numKeypoints;
    let similar = maxDifference <= threshold;

    return { similar, maxDifferenceJoint, maxDifference, different };
  };

// Update the stopTrackingAndTween function
const stopTrackingAndTween = async () => {
    setIsTweening(true);
  
    const letterBeingChecked = currentLetter;
    const currentHandData = {
      keypoints3D: jointsRef.current.map(joint => ({
        x: -joint.position.x,
        y: -joint.position.y,
        z: joint.position.z - 0.6
      }))
    };
  
    try {
      const response = await fetch(`/assets/alphabet/${letterBeingChecked.toLowerCase()}.json`);
      if (!response.ok) throw new Error("JSON not found");
      const storedData = await response.json();
  
      const { similar, different } = compareHands(currentHandData, storedData[0], 0.4);
  
      if (similar) {
        alert(`Yay! You got ${letterBeingChecked} correct 🎉`);
        setScore(prev => prev + 1);
        
        // Wait before showing next letter
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsTweening(false);
        setRandomLetter();
        startTimer();
        return;
      }
  
      const redMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      different.forEach(index => {
        jointsRef.current[index].material = redMaterial;
      });
  
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      different.forEach(index => {
        jointsRef.current[index].material = new THREE.MeshNormalMaterial();
      });
      
      jointsRef.current = jointsRef.current.slice(0, 21);
      performTweenAnimation(storedData[0], letterBeingChecked);
    } catch (error) {
      console.error("Error loading JSON:", error);
      setIsTweening(false);
    }
  };
  
  const performTweenAnimation = async (storedData, letterBeingChecked) => {
    const oldPositions = jointsRef.current.map(joint => joint.position.clone());
    const newPositions = storedData.keypoints3D.map(lm => new THREE.Vector3(
      -(lm.x - storedData.keypoints3D[0].x),
      -(lm.y - storedData.keypoints3D[0].y),
      0.6 + (lm.z - storedData.keypoints3D[0].z)
    ));
  
    await tweenUpdate(oldPositions, newPositions);
    
    // Only change the letter after tween is complete
    setIsTweening(false);
    setRandomLetter();
    startTimer();
  };

  const startTimer = () => {
    clearInterval(timerIntervalRef.current);
    setTimeLeft(10);
    timerIntervalRef.current = setInterval(() => {
      if (isTweening) return;
      setTimeLeft((prev) => {
        if (prev <= 0) {
          handleTimeout();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeout = async () => {
    clearInterval(timerIntervalRef.current);
    await stopTrackingAndTween();
    setRandomLetter();
    startTimer();
  };

  const setRandomLetter = () => {
    const alphabet = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");
    setCurrentLetter(alphabet[Math.floor(Math.random() * alphabet.length)]);
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-screen bg-black text-white"
    >
      <video 
        ref={videoRef} 
        className="fixed top-4 right-4 w-48 h-36 border border-white" 
        hidden={!isLoaded}
      />
      <div className="fixed top-4 left-4 z-50 space-y-4">
        <div className="text-2xl">Letter: {currentLetter}</div>
        <button 
          className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600"
          onClick={() => {
            clearInterval(timerIntervalRef.current);
            stopTrackingAndTween().then(() => {
              setRandomLetter();
              startTimer();
            });
          }}
        >
          Skip
        </button>
        <div className="text-xl">Score: {score}</div>
        <div className="text-xl">Time Left: {timeLeft}s</div>
      </div>
      {!isLoaded && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="text-2xl">Loading...</div>
        </div>
      )}
    </div>
  );
}