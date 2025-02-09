'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Trophy, Share2, Star, Award } from 'lucide-react';
import dynamic from 'next/dynamic';

const TrophyViewer = dynamic(() => import('@/components/trophyViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-4">
        <Trophy className="w-20 h-20 text-blue-500 animate-bounce" />
        <p className="text-blue-600">Loading your trophy...</p>
      </div>
    </div>
  ),
});

export default function CelebrationPage({ params }) {
  const resolvedParams = React.use(params);
  const planId = resolvedParams.planId;
  
  const router = useRouter();
  const [trophyData, setTrophyData] = useState(null);
  const confettiInterval = useRef(null);
  const [showTrophy, setShowTrophy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrophyData = async () => {
      try {
        const response = await fetch(`/api/getTrophy?planId=${planId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch trophy');
        }
        const data = await response.json();
        setTrophyData(data);
        setTimeout(() => setShowTrophy(true), 500);
      } catch (error) {
        console.error('Error fetching trophy:', error);
        setError(error.message);
      }
    };

    if (planId) {
      fetchTrophyData();
    }

    // Enhanced confetti animation
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const colors = ['#FFD700', '#4169E1', '#32CD32', '#FF69B4', '#9370DB'];

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const runFirework = () => {
      const timeLeft = animationEnd - Date.now();
      
      if (timeLeft <= 0) {
        clearInterval(confettiInterval.current);
        return;
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: randomInRange(0.2, 0.8), y: randomInRange(0.2, 0.4) },
        colors,
        ticks: 300,
        shapes: ['circle', 'square'],
        scalar: randomInRange(0.4, 1)
      });
    };

    confettiInterval.current = setInterval(runFirework, 450);
    runFirework();

    return () => clearInterval(confettiInterval.current);
  }, [planId]);

  const handleShare = async () => {
    try {
      await navigator.share({
        title: `I completed my ${trophyData?.planTitle || 'ASL Learning Journey'}! 🎓`,
        text: 'Just earned my Sign Language Star trophy! 🏆✨',
        url: window.location.href
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <Card className="w-full max-w-md p-6">
          <CardContent className="text-center">
            <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Oops!</h2>
            <p className="text-gray-600 mb-6">We couldn't load your trophy. Please try again later.</p>
            <Button onClick={() => router.push('/')} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-blue-50 to-white overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-to-r from-transparent via-blue-100/50 to-transparent opacity-30"
        />
      </div>

      <div className="max-w-6xl mx-auto p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold text-blue-600 mb-4">
            Congratulations! 🎉
          </h1>
          <p className="text-2xl text-gray-600">
            You've completed {trophyData?.planTitle || 'your ASL learning journey'}!
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="h-96"
          >
            <Card className="h-full bg-gradient-to-br from-white to-blue-50">
              <CardContent className="p-6 h-full">
                {showTrophy && trophyData?.modelUrls?.glb ? (
                  <div className="relative w-full h-full">
                    <TrophyViewer modelUrl={`/api/proxy?url=${encodeURIComponent(trophyData.modelUrls.glb)}`} />
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 1 }}
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    >
                      <div className="absolute top-2 right-2">
                        <Star className="w-6 h-6 text-yellow-400 animate-pulse" />
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <Star className="w-6 h-6 text-yellow-400 animate-pulse" />
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Trophy className="w-20 h-20 text-blue-500 animate-bounce" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <Card className="h-full bg-white">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <Award className="w-8 h-8 text-yellow-500" />
                  <h2 className="text-2xl font-semibold text-gray-800">
                    Sign Language Star Trophy
                  </h2>
                </div>
                
                <p className="text-gray-600 leading-relaxed text-lg">
                  {trophyData?.description || 
                    "You've demonstrated exceptional dedication and skill in mastering American Sign Language. This trophy represents your journey and achievement in breaking down communication barriers and embracing a new way to connect with others."}
                </p>

                <motion.div 
                  className="flex flex-col gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button 
                    onClick={() => router.push('/')}
                    variant="outline" 
                    className="w-full py-6 text-lg"
                  >
                    <Home className="w-5 h-5 mr-2" />
                    Return Home
                  </Button>
                  
                  <Button 
                    onClick={handleShare}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg"
                  >
                    <Share2 className="w-5 h-5 mr-2" />
                    Share Achievement
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}