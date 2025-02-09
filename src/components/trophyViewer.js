'use client';

import { useEffect, useRef, useState } from 'react';

export default function TrophyViewer({ modelUrl }) {
  const containerRef = useRef();
  const sceneRef = useRef(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!containerRef.current || !modelUrl) return;

    // Ensure no existing scene
    if (sceneRef.current) {
      containerRef.current.innerHTML = '';
      sceneRef.current = null;
    }

    let cleanup = () => {};
    let hasUnmounted = false;
    setIsModelLoading(true);
    setError('');

    const initScene = async () => {
      try {
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
        
        if (hasUnmounted) return;

        // Scene setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(0xf5f5f5);

        // Camera setup with closer default position
        const camera = new THREE.PerspectiveCamera(
          60, // Slightly narrower FOV for better focus
          containerRef.current.clientWidth / containerRef.current.clientHeight,
          0.1,
          1000
        );
        camera.position.set(0, 0, 3); // Move camera closer

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ 
          antialias: true,
          powerPreference: "high-performance"
        });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2; // Slightly brighter overall
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Clear container before adding new renderer
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderer.domElement);

        // Enhanced lighting setup
        // Ambient light for base illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        // Main directional light (key light)
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(5, 5, 5);
        mainLight.castShadow = true;
        scene.add(mainLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        fillLight.position.set(-5, 3, -5);
        scene.add(fillLight);

        // Rim light for highlights
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
        rimLight.position.set(0, -5, 0);
        scene.add(rimLight);

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 2;
        controls.maxDistance = 6;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 2;
        controls.target.set(0, 0, 0);

        // Loading manager
        const manager = new THREE.LoadingManager();
        manager.onError = (url) => {
          console.error('Error loading:', url);
          if (!hasUnmounted) {
            setError('Failed to load 3D model. Please try again.');
            setIsModelLoading(false);
          }
        };

        // Model loading
        const loader = new GLTFLoader(manager);
        
        loader.load(
          modelUrl,
          (gltf) => {
            if (hasUnmounted) return;
            
            // Center and scale the model
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // Calculate scale to make model fill view consistently
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 2; // Desired size in world units
            const scale = targetSize / maxDim;
            
            gltf.scene.scale.multiplyScalar(scale);
            gltf.scene.position.sub(center.multiplyScalar(scale));
            
            // Adjust final position
            gltf.scene.position.y += 0.2; // Slight vertical offset
            
            // Enable shadows for the model
            gltf.scene.traverse((node) => {
              if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                // Enhance material properties if they exist
                if (node.material) {
                  node.material.roughness = 0.7; // Less shiny
                  node.material.metalness = 0.8; // More metallic look
                }
              }
            });
            
            scene.add(gltf.scene);
            setIsModelLoading(false);
          },
          undefined,
          (error) => {
            console.error('Error loading model:', error);
            if (!hasUnmounted) {
              setIsModelLoading(false);
              setError('Failed to load 3D model');
            }
          }
        );

        // Animation loop
        let animationFrameId;
        function animate() {
          if (hasUnmounted) return;
          animationFrameId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        }
        animate();

        // Resize handler
        function handleResize() {
          if (!containerRef.current) return;
          
          camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }

        window.addEventListener('resize', handleResize);

        // Cleanup
        cleanup = () => {
          hasUnmounted = true;
          window.removeEventListener('resize', handleResize);
          
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
          
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          
          if (controls) {
            controls.dispose();
          }
          
          scene.traverse((object) => {
            if (object.geometry) {
              object.geometry.dispose();
            }
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          });
          
          renderer.dispose();
          sceneRef.current = null;
        };
      } catch (error) {
        console.error('Failed to initialize 3D viewer:', error);
        if (!hasUnmounted) {
          setIsModelLoading(false);
          setError('Failed to initialize 3D viewer');
        }
      }
    };

    initScene();
    return () => cleanup();
  }, [modelUrl]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {isModelLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50">
          <div className="text-gray-600">Loading 3D Model...</div>
        </div>
      )}
      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-100 text-red-500 p-2 rounded text-sm">
          {error}
        </div>
      )}
    </div>
  );
}