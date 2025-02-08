"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  CheckCircle,
  Award,
  Clock,
  HandMetal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import CameraModule from "@/components/cameraModule";

export default function LessonPage() {
  const router = useRouter();
  const params = useParams();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [moduleContext, setModuleContext] = useState(null);

  // --- Fetch Lesson Data on Mount ---
  useEffect(() => {
    const fetchLesson = async () => {
      try {
        // 1. Grab the plan from localStorage
        const planFromStorage = localStorage.getItem("learningPlan");
        if (!planFromStorage) {
          throw new Error("No learningPlan found in localStorage.");
        }

        const planObject = JSON.parse(planFromStorage);

        // 2. Find the module with moduleId
        const currentModule = planObject.learningPathway?.find(
          (m) => m.moduleId === params.moduleId
        );
        if (!currentModule) {
          throw new Error("Module not found in plan.");
        }
        setModuleContext(currentModule);

        // 3. Optionally load userProfile
        const userProfile = JSON.parse(localStorage.getItem("userProfile")) || {};

        // 4. Hit our /api/generateLesson endpoint
        const response = await fetch("/api/generateLesson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId: params.lessonId,
            moduleContext: currentModule,
            userProfile,
          }),
        });

        if (!response.ok) throw new Error("Failed to fetch lesson");
        const data = await response.json();
        // data => { lesson: { title, duration, content: { steps: [...] } } }
        setLesson(data.lesson);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (params.moduleId && params.lessonId) {
      fetchLesson();
    }
  }, [params.moduleId, params.lessonId]);

  // --- Lesson Completion Handler ---
  const handleComplete = () => {
    setShowCelebration(true);
    setTimeout(() => {
      localStorage.setItem(`lesson-${params.lessonId}-completed`, "true");
      router.push("/plan");
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your lesson...</p>
        </motion.div>
      </div>
    );
  }

  // If lesson is null or the shape isn't what we expect:
  if (!lesson || !lesson.content?.steps?.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Lesson</h2>
            <p className="text-gray-600 mb-4">
              Unable to load the lesson. Please try again.
            </p>
            <Link href="/plan">
              <Button className="w-full">Return to Learning Plan</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For convenience
  const steps = lesson.content.steps;
  const totalSteps = steps.length;
  const stepData = steps[currentStep];

  // Compute progress as a percentage (1-based)
  const progressValue = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 animate-gradient-x">
          <div className="absolute top-0 -left-1/2 w-[200%] h-[200%] bg-gradient-to-r from-blue-100/30 via-purple-100/30 to-blue-100/30" />
        </div>
        <div className="absolute inset-0 animate-gradient-y">
          <div className="absolute top-0 -left-1/2 w-[200%] h-[200%] bg-gradient-to-b from-green-100/30 via-transparent to-green-100/30" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 relative z-10">
        {/* Header */}
        <motion.header
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <Link href="/plan">
              <Button variant="outline" className="rounded-full hover:scale-105 transition-transform">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Plan
              </Button>
            </Link>
            <Progress value={progressValue} className="w-48 h-3" />
          </div>

          <h1 className="text-3xl font-bold text-blue-600 mb-2">
            {lesson.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {lesson.duration}
            </span>
          </div>
        </motion.header>

        {/* Step container */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <Card className="backdrop-blur-sm bg-white/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HandMetal className="w-5 h-5 text-blue-500" />
                  {stepData.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Instruction Text */}
                <div className="prose max-w-none">
                  <motion.p
                    className="text-gray-700"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    {stepData.instruction}
                  </motion.p>
                </div>

                {/* Mistakes / Tips */}
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {/* Watch Out For */}
                  <div className="p-4 bg-red-50 rounded-lg hover:shadow-md transition-shadow">
                    <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Watch Out For
                    </h4>
                    <ul className="space-y-2">
                      {(stepData.commonMistakes || []).map((mistake, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.1 }}
                          className="text-red-700 text-sm"
                        >
                          {mistake}
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  {/* Pro Tips */}
                  <div className="p-4 bg-green-50 rounded-lg hover:shadow-md transition-shadow">
                    <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Pro Tips
                    </h4>
                    <ul className="space-y-2">
                      {(stepData.tips || []).map((tip, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.1 }}
                          className="text-green-700 text-sm"
                        >
                          {tip}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </motion.div>

                {/* HARD-CODED FINAL STEP: Show camera module on last step */}
                {currentStep === totalSteps - 1 && (
                  <div className="mt-4">
                    <CameraModule />
                  </div>
                )}
              </CardContent>

              {/* Step navigation footer */}
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep((curr) => curr - 1)}
                  disabled={currentStep === 0}
                  className="hover:scale-105 transition-transform"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                <Button
                  onClick={() => {
                    // If we're on the final step, mark the lesson complete
                    if (currentStep === totalSteps - 1) {
                      handleComplete();
                    } else {
                      setCurrentStep((curr) => curr + 1);
                    }
                  }}
                  disabled={currentStep === totalSteps}
                  className="hover:scale-105 transition-transform"
                >
                  {currentStep === totalSteps - 1 ? "Complete Lesson" : "Next"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Celebration animation */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="fixed inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-50"
            >
              <motion.div
                animate={{
                  rotate: 360,
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                  scale: { duration: 0.5, repeat: Infinity },
                }}
              >
                <Award className="w-24 h-24 text-yellow-400" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        @keyframes gradient-x {
          0%,
          100% {
            transform: translateX(-25%);
          }
          50% {
            transform: translateX(25%);
          }
        }

        @keyframes gradient-y {
          0%,
          100% {
            transform: translateY(-25%);
          }
          50% {
            transform: translateY(25%);
          }
        }

        .animate-gradient-x {
          animation: gradient-x 15s ease infinite;
        }

        .animate-gradient-y {
          animation: gradient-y 15s ease infinite;
        }
      `}</style>
    </div>
  );
}