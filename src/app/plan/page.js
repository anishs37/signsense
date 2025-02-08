"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Book, ChevronRight, Home } from "lucide-react";

export default function Plan() {
  const router = useRouter();
  const [plan, setPlan] = useState([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const storedPlan = localStorage.getItem("learningPlan");
    if (storedPlan) {
      const parsedPlan = JSON.parse(storedPlan);
      let modules;
      if (Array.isArray(parsedPlan)) {
        modules = parsedPlan;
      } else if (parsedPlan.learningPathway && Array.isArray(parsedPlan.learningPathway)) {
        modules = parsedPlan.learningPathway;
      } else {
        modules = [];
      }

      setPlan(modules);

      const completedLessons = modules.reduce((acc, module) => {
        const completedCount = (module.subLessons || []).filter((lesson) =>
          localStorage.getItem(`lesson-${lesson.lessonId}-completed`) === "true"
        ).length;
        return acc + completedCount;
      }, 0);

      const totalLessons = modules.reduce(
        (acc, module) => acc + (module.subLessons?.length || 0),
        0
      );

      if (totalLessons > 0) {
        setProgress((completedLessons / totalLessons) * 100);
      } else {
        setProgress(0);
      }
    }
  }, []);

  const handleLessonClick = (moduleId, lessonId) => {
    router.push(`/lesson/${moduleId}/${lessonId}`);
  };

  if (!plan || plan.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-8">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-blue-600">
              Welcome to ASL Learning!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6">
              <Trophy className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
              <p className="text-gray-600 text-lg mb-6">
                Let's start by assessing your current ASL knowledge
              </p>
              <Link href="/pre-assessment">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full py-6 text-lg">
                  Start Assessment
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto p-6">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-600 mb-2">
              Your Learning Journey
            </h1>
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
                        {module.moduleTitle || `Module ${index + 1}`}
                      </h2>
                    </div>

                    <p className="text-gray-600 mb-4">
                      {module.description || "No description provided."}
                    </p>

                    <div className="space-y-3">
                      {module.subLessons && module.subLessons.length > 0 ? (
                        module.subLessons.map((lesson, i) => {
                          const isCompleted =
                            localStorage.getItem(
                              `lesson-${lesson.lessonId}-completed`
                            ) === "true";

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
                                  {lesson.title || `Lesson ${i + 1}`}
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
                          No sub-lessons found.
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
