"use client";

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import dynamic from 'next/dynamic';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Timer, HandMetal, SkipForward, Award } from "lucide-react";

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
  const sceneContainerRef = useRef(null);

  // Initialize dimensions on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const width = sceneContainerRef.current?.clientWidth || window.innerWidth;
      const height = 600; // Fixed height for consistency
      setDimensions({ width, height });
    }
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (typeof window === 'undefined' || !sceneContainerRef.current) return;
    jointsRef.current = []; 

    sceneRef.current = new THREE.Scene();
    cameraRef.current = new THREE.PerspectiveCamera(75, dimensions.width / dimensions.height, 0.1, 1000);
    cameraRef.current.position.set(0, 0, 3);
    cameraRef.current.lookAt(0, 0, 0);

    rendererRef.current = new THREE.WebGLRenderer({ alpha: true });
    rendererRef.current.setSize(dimensions.width, dimensions.height);
    
    if (sceneContainerRef.current) {
      sceneContainerRef.current.appendChild(rendererRef.current.domElement);
    }

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
      if (!sceneContainerRef.current) return;
      const width = sceneContainerRef.current.clientWidth;
      const height = 600; // Keep fixed height
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
      if (sceneContainerRef.current && rendererRef.current?.domElement) {
        sceneContainerRef.current.removeChild(rendererRef.current.domElement);
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
            jointsRef.current.forEach((joint, i) => {
              if (landmarks[i]) {
                const newX = -(landmarks[i].x - landmarks[0].x);
                const newY = -(landmarks[i].y - landmarks[0].y);
                const newZ = 0.6 + (landmarks[i].z - landmarks[0].z);
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
    for (let t = 0; t <= 1; t += 0.05) {
      jointsRef.current.forEach((joint, i) => {
        joint.position.lerpVectors(oldPositions[i], newPositions[i], t);
      });
      updateBones();
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  };

  // -------------------
  // CHANGED: Always return an object that has a `different` array
  // -------------------
  const compareHands = (hand1, hand2, threshold) => {
    if (
      !hand1 || 
      !hand2 || 
      !hand1.keypoints3D || 
      !hand2.keypoints3D
    ) {
      console.error("Invalid hand data.");
      return { similar: false, different: [] };
    }

    let totalDifference = 0;
    let different = [];
    let maxDifference = 0;
    let maxDifferenceJoint = null;
    const numKeypoints = hand1.keypoints3D.length;

    if (numKeypoints !== hand2.keypoints3D.length) {
      console.error("Mismatch in keypoint count.");
      return { similar: false, different: [] };
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
      return { similar: false, different: [] };
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
        // ignoring z for 2D angle check, as in the original code
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
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsTweening(false);
        setRandomLetter();
        startTimer();
        return;
      }

      // If not similar, highlight the "different" joints in red
      const redMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      different.forEach(index => {
        jointsRef.current[index].material = redMaterial;
      });
  
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset materials
      different.forEach(index => {
        jointsRef.current[index].material = new THREE.MeshNormalMaterial();
      });
      
      // Make sure we only keep the first 21 spheres if something reinitialized
      jointsRef.current = jointsRef.current.slice(0, 21);

      // Perform the tween to show the correct shape
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
    <Card className="w-full bg-gradient-to-b from-gray-900 to-gray-800 text-white overflow-hidden">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" ref={containerRef}>
          {/* Left Panel - Stats */}
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <HandMetal className="w-6 h-6 text-blue-400" />
                  <h3 className="text-xl font-bold">Current Letter</h3>
                </div>
                <span className="text-3xl font-bold text-blue-400">{currentLetter}</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <Timer className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-gray-300">Time Left</span>
                    </div>
                    <span className="text-sm font-medium">{timeLeft}s</span>
                  </div>
                  <Progress value={(timeLeft / 10) * 100} className="h-2" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-gray-300">Score</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-400">{score}</span>
                </div>
              </div>
            </div>

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                clearInterval(timerIntervalRef.current);
                stopTrackingAndTween().then(() => {
                  setRandomLetter();
                  startTimer();
                });
              }}
            >
              <SkipForward className="w-4 h-4 mr-2" />
              Skip Letter
            </Button>
          </div>

          {/* Center Panel - THREE.js Scene */}
          <div className="lg:col-span-2">
            <div 
              ref={sceneContainerRef}
              className="relative w-full h-[600px] bg-gray-900/50 rounded-lg overflow-hidden backdrop-blur-sm"
            >
              <video 
                ref={videoRef}
                className="absolute top-4 right-4 w-48 h-36 rounded-lg border border-gray-600 bg-black"
                hidden={!isLoaded}
              />
              {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-xl text-white/80">Loading camera...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
