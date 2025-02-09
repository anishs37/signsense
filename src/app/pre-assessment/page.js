"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  HandMetal, 
  Sparkles, 
  Brain, 
  Loader2, 
  ChevronRight, 
  CheckCircle2, 
  Mail,
  ArrowRight
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PreAssessment() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState([false, false, false, false]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showExistingUserDialog, setShowExistingUserDialog] = useState(false);
  const [showPlanSelection, setShowPlanSelection] = useState(false);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [userId, setUserId] = useState(null);
  const [answers, setAnswers] = useState({
    email: '',
    preAssessment: {
      completedAt: null,
      responses: {
        experience: '',
        goals: '',
        learningStyle: ''
      }
    },
    profile: {
      experience: '',
      goals: '',
      learningStyle: '',
      createdAt: new Date(),
      lastActive: new Date()
    }
  });

  const questions = [
    {
      field: 'email',
      title: "Welcome to SignSync!",
      question: "First, what's your email address?",
      placeholder: "Enter your email address",
      icon: Mail,
      color: "text-primary",
      validation: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
      }
    },
    {
      field: 'experience',
      title: "Let's start with your ASL journey!",
      question: "What's your current experience with ASL?",
      placeholder: "e.g., total beginner, know the alphabet...",
      icon: HandMetal,
      color: "text-primary",
      validation: (value) => value.length >= 3
    },
    {
      field: 'goals',
      title: "Great! Now about your goals...",
      question: "What would you like to achieve with ASL?",
      placeholder: "e.g., talk to a friend, professional setting...",
      icon: Sparkles,
      color: "text-accent",
      validation: (value) => value.length >= 3
    },
    {
      field: 'learningStyle',
      title: "Last but not least!",
      question: "How do you learn best?",
      placeholder: "e.g., visual learner, interactive practice...",
      icon: Brain,
      color: "text-secondary",
      validation: (value) => value.length >= 3
    }
  ];

  const checkExistingUser = async (email) => {
    try {
      const response = await fetch('/api/checkUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error('Failed to check user status');
      }

      const data = await response.json();
      if (data.exists) {
        setUserId(data.userId); // Store the actual user ID
        fetchUserPlans(data.userId); // Use the user ID to fetch plans
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking user:', error);
      setError('Error checking user status. Please try again.');
      return false;
    }
  };

  const fetchUserPlans = async (userId) => {
    try {
      const response = await fetch(`/api/getUserPlans?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user plans');
      }
      const data = await response.json();
      if (data.plans && data.plans.length > 0) {
        setAvailablePlans(data.plans);
        if (data.plans.length === 1) {
          handlePlanSelection(data.plans[0]._id);
        }
      }
      setShowExistingUserDialog(true);
    } catch (error) {
      console.error('Error fetching plans:', error);
      setError('Error fetching your learning plans. Please try again.');
    }
  };  

  const handlePlanSelection = (planId) => {
    setShowPlanSelection(false);
    setShowCelebration(true);
    localStorage.setItem('userEmail', answers.email);
    localStorage.setItem('userId', userId);
    localStorage.setItem('planId', planId);
    setTimeout(() => {
      router.push(`${planId}/plan`);
    }, 2000);
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    
    if (name === 'email') {
      setAnswers(prev => ({
        ...prev,
        email: value
      }));

      const isValid = questions[0].validation(value);
      const newCompleted = [...isCompleted];
      newCompleted[0] = isValid;
      setIsCompleted(newCompleted);
    } else {
      setAnswers(prev => ({
        ...prev,
        preAssessment: {
          ...prev.preAssessment,
          responses: {
            ...prev.preAssessment.responses,
            [name]: value
          }
        },
        profile: {
          ...prev.profile,
          [name]: value
        }
      }));
      
      const newCompleted = [...isCompleted];
      newCompleted[currentStep] = questions[currentStep].validation(value);
      setIsCompleted(newCompleted);
    }
  };

  const nextStep = async () => {
    if (currentStep === 0) {
      const userExists = await checkExistingUser(answers.email);
      if (!userExists) {
        setCurrentStep(prev => prev + 1);
      }
    } else if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError('');

    const now = new Date();
    const submissionData = {
      email: answers.email,
      preAssessment: {
        completedAt: now,
        responses: {
          experience: answers.preAssessment.responses.experience,
          goals: answers.preAssessment.responses.goals,
          learningStyle: answers.preAssessment.responses.learningStyle
        }
      },
      profile: {
        experience: answers.preAssessment.responses.experience,
        goals: answers.preAssessment.responses.goals,
        learningStyle: answers.preAssessment.responses.learningStyle,
        createdAt: now,
        lastActive: now
      }
    };

    try {
      const planRes = await fetch('/api/generatePlan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData),
      });

      if (!planRes.ok) {
        const errorText = await planRes.text();
        throw new Error(errorText);
      }

      const plan = await planRes.json();

      if (!plan.learningPathway) {
        throw new Error('No plan data received');
      }

      setShowCelebration(true);

      // Store user data correctly
      localStorage.setItem('userEmail', answers.email);
      localStorage.setItem('userId', plan.userId);
      localStorage.setItem('planId', plan._id);
      localStorage.setItem('learningPlan', JSON.stringify(plan));

      setTimeout(() => {
        router.push(`${plan._id}/plan`);
      }, 2000);

    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Something went wrong generating your plan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueExisting = () => {
    if (availablePlans.length === 1) {
      handlePlanSelection(availablePlans[0]._id);
    } else {
      setShowExistingUserDialog(false);
      setShowPlanSelection(true);
    }
  };

  const handleCreateNew = () => {
    setShowExistingUserDialog(false);
    setCurrentStep(1);
  };

  const CurrentQuestion = questions[currentStep];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 animate-gradient-x">
          <div className="absolute top-0 -left-1/2 w-[200%] h-[200%] bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5" />
        </div>
        <div className="absolute inset-0 animate-gradient-y">
          <div className="absolute top-0 -left-1/2 w-[200%] h-[200%] bg-gradient-to-b from-secondary/5 via-transparent to-secondary/5" />
        </div>
      </div>

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
                  <h2 className="text-xl font-semibold text-card-foreground">
                    {CurrentQuestion.title}
                  </h2>
                  <p className="text-muted-foreground">
                    {CurrentQuestion.question}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  name={CurrentQuestion.field}
                  value={CurrentQuestion.field === 'email' ? answers.email : answers.preAssessment.responses[CurrentQuestion.field]}
                  onChange={handleInputChange}
                  placeholder={CurrentQuestion.placeholder}
                  type={CurrentQuestion.field === 'email' ? 'email' : 'text'}
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
              animate={
                index === currentStep
                  ? { scale: [1, 1.2, 1] }
                  : {}
              }
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 1
              }}
            />
          ))}
        </div>
      </motion.div>

      <AlertDialog open={showExistingUserDialog} onOpenChange={setShowExistingUserDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Welcome Back!</AlertDialogTitle>
            <AlertDialogDescription>
              It looks like you already have a learning pathway. Would you like to continue with your existing pathway or create a new one?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCreateNew}>
              Create New
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleContinueExisting}>
              Continue Existing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showPlanSelection} onOpenChange={setShowPlanSelection}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Your Learning Plan</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {availablePlans.map((plan) => (
              <Button
                key={plan._id}
                onClick={() => handlePlanSelection(plan._id)}
                variant="outline"
                className="w-full justify-start text-left h-auto py-4"
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">
                    {plan.displayTitle || 'Untitled Plan'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Created: {new Date(plan.createdAt).toLocaleDateString()}
                  </span>
                  {plan.completedAt && (
                    <span className="text-sm text-green-600">
                      Completed: {new Date(plan.completedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
          animation: gradient-x {
          0%, 100% { transform: translateX(-25%); }
          50% { transform: translateX(25%); }
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