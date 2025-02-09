'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  ChevronLeft,
  Info,
  X,
  Sparkles,
  RotateCcw
} from 'lucide-react';

const TrophyViewer = dynamic(() => import('@/components/trophyViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-pulse">
        <Trophy className="w-20 h-20 text-blue-500/50" />
      </div>
    </div>
  ),
});

export default function TrophyCase({ params }) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const planId = resolvedParams.planId;
  
  const [trophies, setTrophies] = useState([]);
  const [selectedTrophy, setSelectedTrophy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrophies = async () => {
      try {
        // First fetch the current plan's details to get the user ID
        const planResponse = await fetch(`/api/getPlan?planId=${planId}`);
        if (!planResponse.ok) throw new Error('Failed to fetch plan');
        const planData = await planResponse.json();
        
        if (!planData || !planData.userId) {
          throw new Error('Invalid plan data');
        }

        const userId = planData.userId;

        // Now get all plans for this user
        const userPlansResponse = await fetch(`/api/getUserPlans?userId=${userId}`);
        if (!userPlansResponse.ok) throw new Error('Failed to fetch user plans');
        const userPlansData = await userPlansResponse.json();

        // Fetch trophies for each plan
        const trophyPromises = userPlansData.plans.map(async (plan) => {
          try {
            const trophyResponse = await fetch(`/api/getTrophy?planId=${plan._id}`);
            if (trophyResponse.status === 404) return null;
            if (!trophyResponse.ok) throw new Error(`Failed to fetch trophy for plan ${plan._id}`);
            
            const trophyData = await trophyResponse.json();
            return {
              ...trophyData,
              planId: plan._id,
              planTitle: plan.displayTitle || 'ASL Learning Journey'
            };
          } catch (error) {
            console.error(`Error fetching trophy for plan ${plan._id}:`, error);
            return null;
          }
        });

        const fetchedTrophies = (await Promise.all(trophyPromises))
          .filter(trophy => trophy !== null);

        setTrophies(fetchedTrophies);
      } catch (error) {
        console.error('Error fetching trophies:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTrophies();
  }, [planId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Trophy className="w-16 h-16 text-blue-500/50 animate-bounce" />
          <p className="text-gray-500 font-medium">Loading your achievements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Card className="w-full max-w-md shadow-lg border-0">
          <CardContent className="p-8 text-center">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Unable to Load Trophies</h2>
            <p className="text-gray-500 mb-6">We encountered an issue while loading your achievements.</p>
            <Button onClick={() => router.push(`/${planId}/plan`)} variant="outline" className="w-full">
              Return to Learning Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (trophies.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6">
          <header className="flex items-center gap-4 mb-12">
            <Button
              variant="ghost"
              className="text-gray-600 hover:bg-gray-100"
              onClick={() => router.push(`/${planId}/plan`)}
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Back to Plan
            </Button>
            <h1 className="text-3xl font-bold text-gray-800">Trophy Case</h1>
          </header>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-50 to-white">
            <CardContent className="p-12 text-center">
              <Trophy className="w-20 h-20 text-gray-300 mx-auto mb-6" />
              <h2 className="text-2xl font-semibold text-gray-800 mb-3">Your Trophy Case Awaits</h2>
              <p className="text-gray-500 text-lg">Complete your learning journey to earn your first trophy!</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Subtle grid pattern background */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNDB2NDBoLTQweiIvPjxwYXRoIGQ9Ik00MCAyMGgtNDBtMjAtMjB2NDAiIHN0cm9rZT0iI2VlZSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-50" />
      
      <div className="max-w-7xl mx-auto p-6 relative">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              className="text-gray-600 hover:bg-gray-100"
              onClick={() => router.push(`/${planId}/plan`)}
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Back to Plan
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-1">Trophy Case</h1>
              <p className="text-gray-500">Your collection of achievements</p>
            </div>
          </div>
          <Sparkles className="w-8 h-8 text-yellow-400 opacity-75" />
        </header>

        {/* Display grid with subtle shadows and hover effects */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {trophies.map((trophy, index) => (
            <motion.div
              key={trophy.planId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden bg-gradient-to-br from-gray-50 to-white"
                onClick={() => setSelectedTrophy(trophy)}
              >
                <CardContent className="p-6">
                  <div className="h-64 relative rounded-lg overflow-hidden bg-white">
                    <TrophyViewer modelUrl={`/api/proxy?url=${encodeURIComponent(trophy.modelUrls.glb)}`} />
                  </div>
                  <div className="mt-6 text-center">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{trophy.planTitle}</h3>
                    <p className="text-sm text-gray-500">
                      Achieved {new Date(trophy.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Modal with clean design */}
        <AnimatePresence>
          {selectedTrophy && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-6 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden relative"
              >
                <Button
                  variant="ghost"
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  onClick={() => setSelectedTrophy(null)}
                >
                  <X className="w-5 h-5" />
                </Button>

                <div className="grid md:grid-cols-2 gap-8 p-8">
                  <div className="h-96 relative rounded-xl overflow-hidden bg-gray-50">
                    <TrophyViewer 
                      modelUrl={`/api/proxy?url=${encodeURIComponent(selectedTrophy.modelUrls.glb)}`}
                    />
                    <Button
                      variant="ghost"
                      className="absolute bottom-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-white/50"
                      onClick={() => {
                        const viewer = document.querySelector('canvas');
                        if (viewer) viewer.click();
                      }}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedTrophy.planTitle}</h2>
                      <p className="text-gray-500">
                        Achieved on {new Date(selectedTrophy.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4 text-blue-500" />
                        <h3 className="font-medium text-gray-800">About this Achievement</h3>
                      </div>
                      <p className="text-gray-600">{selectedTrophy.description}</p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <h3 className="font-medium text-gray-800">Milestone Details</h3>
                      </div>
                      <p className="text-gray-600">
                        Successfully completed {selectedTrophy.planTitle} with distinction
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}