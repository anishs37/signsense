'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HandMetal, Sparkles, Book, Brain, Loader2, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function PreAssessment() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState([false, false, false]);
  const [showCelebration, setShowCelebration] = useState(false);

  const [answers, setAnswers] = useState({
    experience: '',
    goals: '',
    learningStyle: '',
  });

  const questions = [
    {
      field: 'experience',
      title: "Let's start with your ASL journey!",
      question: "What's your current experience with ASL?",
      placeholder: "e.g., total beginner, know the alphabet...",
      icon: HandMetal,
      color: "text-primary"
    },
    {
      field: 'goals',
      title: "Great! Now about your goals...",
      question: "What would you like to achieve with ASL?",
      placeholder: "e.g., talk to a friend, professional setting...",
      icon: Sparkles,
      color: "text-accent"
    },
    {
      field: 'learningStyle',
      title: "Last but not least!",
      question: "How do you learn best?",
      placeholder: "e.g., visual learner, interactive practice...",
      icon: Brain,
      color: "text-secondary"
    }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAnswers(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (value.length >= 3) {
      const newCompleted = [...isCompleted];
      newCompleted[currentStep] = true;
      setIsCompleted(newCompleted);
    } else {
      const newCompleted = [...isCompleted];
      newCompleted[currentStep] = false;
      setIsCompleted(newCompleted);
    }
  };

  const nextStep = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/generatePlan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      if (!data.plan) throw new Error('No plan data received');
      
      setShowCelebration(true);
      localStorage.setItem('learningPlan', JSON.stringify(data.plan));
      
      setTimeout(() => {
        router.push('/plan');
      }, 2000);
    } catch (error) {
      setError(error.message || 'Something went wrong generating your plan.');
    } finally {
      setIsLoading(false);
    }
  };

  const CurrentQuestion = questions[currentStep];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 animate-gradient-x">
          <div className="absolute top-0 -left-1/2 w-[200%] h-[200%] bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5" />
        </div>
        <div className="absolute inset-0 animate-gradient-y">
          <div className="absolute top-0 -left-1/2 w-[200%] h-[200%] bg-gradient-to-b from-secondary/5 via-transparent to-secondary/5" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 w-full h-2 bg-muted">
        <motion.div 
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <motion.div 
        className="w-full max-w-xl relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive"
          >
            {error}
          </motion.div>
        )}

        <Card className="backdrop-blur-sm bg-card/80 p-8 rounded-xl shadow-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <CurrentQuestion.icon className={`w-12 h-12 ${CurrentQuestion.color}`} />
                </motion.div>
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground">{CurrentQuestion.title}</h2>
                  <p className="text-muted-foreground">{CurrentQuestion.question}</p>
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  name={CurrentQuestion.field}
                  value={answers[CurrentQuestion.field]}
                  onChange={handleInputChange}
                  placeholder={CurrentQuestion.placeholder}
                  className="w-full text-lg p-4"
                  autoFocus
                />

                <div className="flex justify-end space-x-4">
                  {currentStep < questions.length - 1 ? (
                    <Button
                      onClick={nextStep}
                      disabled={!isCompleted[currentStep]}
                      className="group"
                    >
                      Next
                      <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={isLoading || !isCompleted[currentStep]}
                      className="relative group"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Generate My Plan
                          <Sparkles className="ml-2 group-hover:rotate-12 transition-transform" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Card>

        {/* Step indicators */}
        <div className="flex justify-center mt-6 space-x-2">
          {questions.map((_, index) => (
            <motion.div
              key={index}
              className={`w-3 h-3 rounded-full ${
                index === currentStep 
                  ? 'bg-primary' 
                  : index < currentStep 
                    ? 'bg-primary/50' 
                    : 'bg-muted'
              }`}
              initial={false}
              animate={index === currentStep ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
            />
          ))}
        </div>
      </motion.div>

      {/* Celebration animation */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-50"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <CheckCircle2 className="w-24 h-24 text-success" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes gradient-x {
          0%, 100% { transform: translateX(-25%); }
          50% { transform: translateX(25%); }
        }

        @keyframes gradient-y {
          0%, 100% { transform: translateY(-25%); }
          50% { transform: translateY(25%); }
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