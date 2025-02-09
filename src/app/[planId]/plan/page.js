"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Book, ChevronRight, Home, Menu, Trophy } from "lucide-react";

export default function Plan({ params }) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const planId = resolvedParams.planId;
  
  const [plan, setPlan] = useState([]);
  const [progress, setProgress] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const [availablePlans, setAvailablePlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAndGenerateTrophy = async (email) => {
    try {
      const trophyResponse = await fetch(`/api/getTrophy?planId=${planId}`);
      
      if (trophyResponse.status === 404) {
        console.log('No trophy found, generating...');
        const generateResponse = await fetch('/api/generateTrophy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email,
            planId 
          }),
        });
  
        if (!generateResponse.ok) {
          console.error('Failed to generate trophy:', await generateResponse.text());
        }
      } else if (!trophyResponse.ok && trophyResponse.status !== 404) {
        console.error('Error checking trophy:', await trophyResponse.text());
      }
    } catch (error) {
      console.error('Error in trophy check/generation:', error);
    }
  };

  useEffect(() => {
    const initializePage = async () => {
      const email = localStorage.getItem("userEmail");
      const userId = localStorage.getItem("userId");

      if (!email || !userId) {
        router.push("/pre-assessment");
        return;
      }

      setUserEmail(email);
      try {
        const userResponse = await fetch("/api/checkUser", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        if (!userResponse.ok) {
          throw new Error("Failed to fetch user details");
        }

        const userData = await userResponse.json();
        
        if (!userData.exists) {
          router.push("/pre-assessment");
          return;
        }

        const plansResponse = await fetch(`/api/getUserPlans?userId=${userData.userId}`);
        if (!plansResponse.ok) {
          throw new Error("Failed to fetch user plans");
        }

        const plansData = await plansResponse.json();
        
        if (!plansData.plans || plansData.plans.length === 0) {
          router.push("/pre-assessment");
          return;
        }

        setAvailablePlans(plansData.plans);

        const currentPlan = plansData.plans.find(p => p._id === planId);
        
        if (!currentPlan) {
          router.push(`/${plansData.plans[0]._id}/plan`);
          return;
        }

        setCurrentPlan(currentPlan);
        
        if (currentPlan.pathway) {
          processPathway(currentPlan.pathway);
          checkAndGenerateTrophy(email);
        } else {
          router.push("/pre-assessment");
        }
      } catch (error) {
        console.error("Error initializing page:", error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    initializePage();
  }, [planId, router]);

  const processPathway = (pathway) => {
    if (!pathway || pathway.length === 0) {
      router.push("/pre-assessment");
      return;
    }

    setPlan(pathway);

    const completedLessons = pathway.reduce((acc, module) => {
      const completedCount = (module.subLessons || []).filter(
        (lesson) => lesson.status === "completed"
      ).length;
      return acc + completedCount;
    }, 0);

    const totalLessons = pathway.reduce(
      (acc, module) => acc + (module.subLessons?.length || 0),
      0
    );

    if (totalLessons > 0) {
      setProgress((completedLessons / totalLessons) * 100);
    } else {
      setProgress(0);
    }
  };

  const handlePlanChange = (planId) => {
    router.push(`/${planId}/plan`);
  };

  const handleLessonClick = (moduleId, lessonId) => {
    router.push(`/lesson/${moduleId}/${lessonId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-blue-600 text-lg">Loading your learning plan...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-red-600 text-lg">Error: {error}</div>
      </div>
    );
  }

  if (!plan || !plan.length) {
    router.push("/pre-assessment");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto p-6">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-bold text-blue-600">
              Your Learning Journey
            </h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push(`/${planId}/trophy-case`)}
                className="hover:bg-blue-50"
              >
                <Trophy className="h-4 w-4 text-blue-600" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {availablePlans.map((plan) => (
                    <DropdownMenuItem
                      key={plan._id}
                      onClick={() => handlePlanChange(plan._id)}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {plan.displayTitle || 'Untitled Plan'}
                        </span>
                        <span className="text-xs text-gray-500">
                          Created: {new Date(plan.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-4">
              <Progress value={progress} className="w-48 h-3" />
              <span className="text-sm text-gray-600">
                {Math.round(progress)}% Complete
              </span>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" className="rounded-full">
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
          </Link>
        </header>

        <div className="space-y-6">
          {plan.map((module, index) => (
            <Card
              key={module.moduleId || index}
              className="transform transition-all hover:scale-[1.01]"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Book className="w-6 h-6 text-blue-500" />
                      <h2 className="text-xl font-semibold text-gray-800">
                        {module.name || `Module ${index + 1}`}
                      </h2>
                    </div>

                    <p className="text-gray-600 mb-4">
                      {module.description || "No description provided."}
                    </p>

                    <div className="space-y-3">
                      {module.subLessons && module.subLessons.length > 0 ? (
                        module.subLessons.map((lesson, i) => {
                          const isCompleted = lesson.status === "completed";

                          return (
                            <div
                              key={lesson.lessonId || i}
                              onClick={() =>
                                handleLessonClick(
                                  module.moduleId || `m${index + 1}`,
                                  lesson.lessonId || `m${index + 1}-l${i + 1}`
                                )
                              }
                              className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer"
                            >
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                                  isCompleted
                                    ? "bg-green-100 text-green-600"
                                    : "bg-blue-100 text-blue-600"
                                }`}
                              >
                                {isCompleted ? "✓" : i + 1}
                              </div>

                              <div className="flex-1">
                                <h3 className="font-medium text-gray-800">
                                  {lesson.lessonTitle || `Lesson ${i + 1}`}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {lesson.description || "No description."}
                                </p>
                              </div>

                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-gray-600 italic">
                          No lessons found.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}