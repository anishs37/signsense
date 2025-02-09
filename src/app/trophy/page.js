'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function TrophyViewer() {
  const containerRef = useRef();
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState('');

  // Hardcoded trophy data with MongoDB GLB URL
  const trophyData = {
    modelUrls: {
      glb: "https://assets.meshy.ai/f7e56d50-f988-46de-84dd-ca5c8fee835e/tasks/0194e90f-6fb0-7946-854d-f6c5602a5615/output/model.glb?Expires=4892659200&Signature=b9a1hbFithx38TaTSwWFQSSwJEEvKzUwLBaZhZJ-qfq~ccTGn5zNWzItN-h04SRL7yxcC05bgnRzuaYFIvSz3AQZ1nQcOcQ0~V7thVqCLYMetpk3bKlhEwTGutlmn0frjK2wOZl6CMjn9w3w2sV~KjLNDWFrKg7xrsaZ~ca1qbDi8W3mNQdxx2bqZkKLLfNjtRmw5-Jkq~kf5i2EzCHq7w2HK7uXB0aDXBDRYow7oZaQlLvqi5xRzUopFyzQrY9lgWCZEMihcQVtJQdEWhNAUQvXhdVuHBGZka8leAb4E8ruWdsYg96AqD--g1fnrckL3bKiS4EyAVILzSGw3llIOA__&Key-Pair-Id=KL5I0C8H7HX83"
    },
    description: "Your ASL Learning Achievement Trophy"
  };

  useEffect(() => {
    if (!containerRef.current) return;

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

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf5f5f5);

        const camera = new THREE.PerspectiveCamera(
          75,
          containerRef.current.clientWidth / containerRef.current.clientHeight,
          0.1,
          1000
        );
        camera.position.z = 5;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        containerRef.current.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 2;
        controls.maxDistance = 10;

        const manager = new THREE.LoadingManager();
        manager.onError = (url) => {
          console.error('Error loading:', url);
          if (!hasUnmounted) {
            setError('Failed to load 3D model. Please try again.');
            setIsModelLoading(false);
          }
        };

        const loader = new GLTFLoader(manager);
        
        const modelUrl = `/api/proxy?url=${encodeURIComponent(trophyData.modelUrls.glb)}`;

        loader.load(
        modelUrl,
        (gltf) => {
            if (hasUnmounted) return;
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

        let animationFrameId;
        function animate() {
          animationFrameId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        }
        animate();

        function handleResize() {
          if (!containerRef.current) return;
          
          camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }

        window.addEventListener('resize', handleResize);

        cleanup = () => {
          window.removeEventListener('resize', handleResize);
          if (containerRef.current && renderer.domElement) {
            containerRef.current.removeChild(renderer.domElement);
          }
          cancelAnimationFrame(animationFrameId);
          renderer.dispose();
          hasUnmounted = true;
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
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Your ASL Learning Trophy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-lg">
            {trophyData.description}
          </div>
          <div className="h-96 relative bg-gray-100 rounded-lg overflow-hidden">
            <div ref={containerRef} className="w-full h-full" />
            {isModelLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50">
                <div className="text-gray-600">Loading 3D Model...</div>
              </div>
            )}
          </div>
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}