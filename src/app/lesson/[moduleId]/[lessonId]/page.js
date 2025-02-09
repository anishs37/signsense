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

function fixAdjoinedWords(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1\n$2");
}
function forceHeadingsOnNewLine(str) {
  return str.replace(/(?!^)(#+\s)/g, "\n$1");
}

function formatMarkdownContent(text) {
  if (!text) return [];

  text = fixAdjoinedWords(text);
  text = text.replace(/\$ /g, "\n");
  text = forceHeadingsOnNewLine(text);

  const sections = text.split(/(?=(^|\n)#+\s)/);

  const parsedSections = sections.map((rawSection) => {
    const lines = rawSection.trim().split("\n");
    let level = 0;
    let title = "";
    let content = [];

    if (lines[0]?.startsWith("#")) {
      const headerMatch = lines[0].match(/^(#+)\s+(.*)$/);
      if (headerMatch) {
        level = headerMatch[1].length;
        title = headerMatch[2].trim();
        lines.shift();
      }
    }

    let currentParagraph = [];
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed === "") {
        if (currentParagraph.length > 0) {
          content.push(currentParagraph.join(" "));
          currentParagraph = [];
        }
      } else {
        currentParagraph.push(trimmed);
      }
    });
    if (currentParagraph.length > 0) {
      content.push(currentParagraph.join(" "));
    }

    return { level, title, content };
  });

  return parsedSections.filter((sec) => sec.title || sec.content.length > 0);
}

function parseParagraph(paragraph) {
  paragraph = paragraph.replace(/(?<!^)(\s*\d+\.\s+)/g, "\n$1");
  paragraph = paragraph.replace(/(?<!^)(\s*-\s+)/g, "\n$1");

  const lines = paragraph.split(/\n+/);
  const bulletPattern = /^\s*[-+*]\s+(.*)$/;
  const numericPattern = /^\s*\d+\.\s+(.*)$/;

  let allBullets = true;
  let allNumbers = true;
  const bulletItems = [];
  const numberItems = [];

  for (const line of lines) {
    if (!bulletPattern.test(line)) {
      allBullets = false;
    } else {
      const match = line.match(bulletPattern);
      if (match) {
        bulletItems.push(match[1]);
      }
    }

    if (!numericPattern.test(line)) {
      allNumbers = false;
    } else {
      const match = line.match(numericPattern);
      if (match) {
        numberItems.push(match[1]);
      }
    }
  }

  if (lines.length > 0 && allBullets) {
    return [{ type: "ul", items: bulletItems }];
  }
  if (lines.length > 0 && allNumbers) {
    return [{ type: "ol", items: numberItems }];
  }

  return [{ type: "p", text: paragraph }];
}

function renderFormattedContent(sections) {
  return sections.map((section, index) => {
    let HeadingTag = "h5";
    let headingClass = "text-md mb-2 text-blue-600 font-bold";

    if (section.level === 1) {
      HeadingTag = "h2";
      headingClass = "text-2xl mb-4 text-blue-700 font-bold";
    } else if (section.level === 2) {
      HeadingTag = "h3";
      headingClass = "text-xl mb-3 text-blue-600 font-bold";
    } else if (section.level === 3) {
      HeadingTag = "h4";
      headingClass = "text-lg mb-2 text-blue-600 font-bold";
    } else if (section.level >= 4) {
      HeadingTag = "h5";
      headingClass = "text-md mb-2 text-blue-600 font-bold";
    }

    return (
      <div key={index} className="mb-6">
        {section.title &&
          React.createElement(
            HeadingTag,
            { className: headingClass },
            section.title
          )}

        {section.content.map((paragraph, pIndex) => {
          const tokens = parseParagraph(paragraph);
          return (
            <div key={pIndex}>
              {tokens.map((token, tIndex) => {
                if (token.type === "p") {
                  return (
                    <p
                      key={tIndex}
                      className="mb-4 text-gray-700 leading-relaxed"
                    >
                      {token.text}
                    </p>
                  );
                }
                if (token.type === "ul") {
                  return (
                    <ul
                      key={tIndex}
                      className="list-disc list-inside mb-4 text-gray-700 leading-relaxed"
                    >
                      {token.items.map((item, i) => (
                        <li key={i} className="mb-1">
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                }
                if (token.type === "ol") {
                  return (
                    <ol
                      key={tIndex}
                      className="list-decimal list-inside mb-4 text-gray-700 leading-relaxed"
                    >
                      {token.items.map((item, i) => (
                        <li key={i} className="mb-1">
                          {item}
                        </li>
                      ))}
                    </ol>
                  );
                }
                return null;
              })}
            </div>
          );
        })}
      </div>
    );
  });
}

export default function LessonPage() {
  const router = useRouter();
  const params = useParams();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [moduleContext, setModuleContext] = useState(null);

  useEffect(() => {
    const fetchOrLoadLesson = async () => {
      try {
        const planFromStorage = localStorage.getItem("learningPlan");
        if (!planFromStorage) {
          throw new Error("No learningPlan found in localStorage.");
        }
        const planObject = JSON.parse(planFromStorage);
        const currentModule = planObject.learningPathway?.find(
          (m) => m.moduleId === params.moduleId
        );
        if (!currentModule) {
          throw new Error("Module not found in plan.");
        }
        setModuleContext(currentModule);

        const checkRes = await fetch(`/api/checkLesson?lessonId=${params.lessonId}`);
        if (!checkRes.ok) {
          throw new Error("Failed to check existing lesson from DB");
        }
        const checkData = await checkRes.json();

        if (checkData.found && checkData.lessonData) {
          console.log("[LessonPage] Lesson found in DB, skipping generateLesson");
          const dbLesson = {
            title: checkData.lessonData.title,
            duration: checkData.lessonData.duration,
            content: checkData.lessonData.content
          };
          setLesson(dbLesson);
        } else {
          console.log("[LessonPage] No lesson in DB, calling generateLesson");
          const userProfile = JSON.parse(localStorage.getItem("userProfile")) || {};

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
          setLesson(data.lesson);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (params.moduleId && params.lessonId) {
      fetchOrLoadLesson();
    }
  }, [params.moduleId, params.lessonId, router]);

  // Updated handleComplete: Redirect to /[planId]/plan when lesson is complete.
  const handleComplete = () => {
    setShowCelebration(true);
    setTimeout(() => {
      localStorage.setItem(`lesson-${params.lessonId}-completed`, "true");
      const planId = localStorage.getItem("planId");
      router.push(`/${planId}/plan`);
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

  const steps = lesson.content.steps;
  const totalSteps = steps.length;
  const stepData = steps[currentStep];
  const progressValue = ((currentStep + 1) / totalSteps) * 100;

  const formattedSections = formatMarkdownContent(stepData.instruction);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 animate-gradient-x">
          <div className="absolute top-0 -left-1/2 w-[200%] h-[200%] bg-gradient-to-r from-blue-100/30 via-purple-100/30 to-blue-100/30" />
        </div>
        <div className="absolute inset-0 animate-gradient-y">
          <div className="absolute top-0 -left-1/2 w-[200%] h-[200%] bg-gradient-to-b from-green-100/30 via-transparent to-green-100/30" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 relative z-10">
        <motion.header
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <Link href="/plan">
              <Button
                variant="outline"
                className="rounded-full hover:scale-105 transition-transform"
              >
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
                <div className="prose max-w-none">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    {renderFormattedContent(formattedSections)}
                  </motion.div>
                </div>

                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
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

                  <div className="p-4 bg-green-50 rounded-lg hover:shadow-md transition-shadow">
                    <h4 className="font-medium text-green-800 mb=2 flex items-center gap=2">
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

                {stepData.cameraActivity === true && (
                  <div className="mt-4">
                    <CameraModule />
                  </div>
                )}
              </CardContent>

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