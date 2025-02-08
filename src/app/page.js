"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HandMetal, Sparkles, Trophy, Brain, ChevronRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background relative overflow-hidden p-4">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-background">
        <div className="absolute inset-0 animate-gradient-x">
          <div className="absolute top-0 -left-1/2 w-[200%] h-[200%] bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5" />
        </div>
        <div className="absolute inset-0 animate-gradient-y">
          <div className="absolute top-0 -left-1/2 w-[200%] h-[200%] bg-gradient-to-b from-secondary/5 via-transparent to-secondary/5" />
        </div>
      </div>

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-orb-1" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-accent/10 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-orb-2" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-secondary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-orb-3" />
      </div>

      <div className="relative z-10 max-w-4xl w-full">
        {/* Main content container */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center mb-6">
            <HandMetal className="w-12 h-12 text-primary mr-4 animate-wave" />
            <h1 className="text-5xl font-bold text-primary">
              ASL Learning Tool
            </h1>
          </div>
          <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
            Master American Sign Language through interactive lessons and personalized learning paths
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card/80 backdrop-blur-sm">
            <Sparkles className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2 text-card-foreground">Personalized Learning</h3>
            <p className="text-muted-foreground">Adaptive lessons tailored to your skill level</p>
          </Card>
          <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card/80 backdrop-blur-sm">
            <Trophy className="w-8 h-8 text-warning mb-4" />
            <h3 className="font-semibold text-lg mb-2 text-card-foreground">Track Progress</h3>
            <p className="text-muted-foreground">Earn achievements as you learn and grow</p>
          </Card>
          <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card/80 backdrop-blur-sm">
            <Brain className="w-8 h-8 text-accent mb-4" />
            <h3 className="font-semibold text-lg mb-2 text-card-foreground">Smart Assessment</h3>
            <p className="text-muted-foreground">Get detailed insights about your skills</p>
          </Card>
        </div>

        {/* CTA Button */}
        <div className="text-center animate-bounce-slow">
          <Link href="/pre-assessment">
            <Button size="lg" className="px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group">
              Start Your Journey
              <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Add custom styles for animations */}
      <style jsx global>{`
        @keyframes gradient-x {
          0%, 100% { transform: translateX(-25%); }
          50% { transform: translateX(25%); }
        }

        @keyframes gradient-y {
          0%, 100% { transform: translateY(-25%); }
          50% { transform: translateY(25%); }
        }

        @keyframes orb-float-1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -50px) rotate(120deg); }
          66% { transform: translate(-20px, 20px) rotate(240deg); }
        }

        @keyframes orb-float-2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-30px, 50px) rotate(-120deg); }
          66% { transform: translate(20px, -20px) rotate(-240deg); }
        }

        @keyframes orb-float-3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(40px, 40px) rotate(160deg); }
          66% { transform: translate(-40px, -40px) rotate(-160deg); }
        }

        .animate-gradient-x {
          animation: gradient-x 15s ease infinite;
        }

        .animate-gradient-y {
          animation: gradient-y 15s ease infinite;
        }

        .animate-orb-1 {
          animation: orb-float-1 20s ease infinite;
        }

        .animate-orb-2 {
          animation: orb-float-2 25s ease infinite;
        }

        .animate-orb-3 {
          animation: orb-float-3 30s ease infinite;
        }

        @keyframes wave {
          0% { transform: rotate(0deg); }
          20% { transform: rotate(8deg); }
          40% { transform: rotate(-4deg); }
          60% { transform: rotate(4deg); }
          80% { transform: rotate(-2deg); }
          100% { transform: rotate(0deg); }
        }

        .animate-wave {
          animation: wave 2s infinite;
        }

        .animate-bounce-slow {
          animation: bounce 3s infinite;
        }

        .animate-fade-in {
          animation: fadeIn 1s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}