import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, RotateCcw, Star } from "lucide-react";
import breathingBuddy from "@/assets/breathing-buddy.png";

const Practice = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stars, setStars] = useState(0);

  const handleStart = () => {
    setIsPlaying(true);
    // Simulate breathing exercise progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsPlaying(false);
          setStars((s) => Math.min(s + 1, 5));
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  const handleReset = () => {
    setProgress(0);
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navigation />
      
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Breathing Practice</h1>
          <p className="text-muted-foreground">Practice your breathing technique with Breeze Buddy!</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Practice Area */}
          <Card className="text-center">
            <CardHeader>
              <CardTitle>Let's Practice Together!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Breathing Buddy Character */}
              <div className="relative inline-block">
                <div 
                  className={`transition-transform duration-1000 ${
                    isPlaying ? 'scale-110' : 'scale-100'
                  }`}
                  style={{
                    animation: isPlaying ? 'pulse 3s ease-in-out infinite' : 'none'
                  }}
                >
                  <img
                    src={breathingBuddy}
                    alt="Breeze Buddy"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {!isPlaying && progress === 0 && "Ready to start?"}
                  {isPlaying && "Breathe slowly and steadily..."}
                  {!isPlaying && progress === 100 && "Perfect! Great job! 🎉"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {!isPlaying && progress === 0 && "Click start to begin your breathing exercise"}
                  {isPlaying && "Follow Breeze Buddy's breathing rhythm"}
                  {!isPlaying && progress === 100 && "You earned a star! Try again to earn more!"}
                </p>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <Progress value={progress} className="h-3" />
                <div className="text-sm text-muted-foreground">
                  {progress}% Complete
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-2 justify-center">
                {!isPlaying ? (
                  <Button onClick={handleStart} size="lg" className="gap-2">
                    <Play className="h-4 w-4" />
                    Start Practice
                  </Button>
                ) : (
                  <Button onClick={() => setIsPlaying(false)} size="lg" variant="secondary" className="gap-2">
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                )}
                <Button onClick={handleReset} size="lg" variant="outline" className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle>Your Stars</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 justify-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-12 w-12 ${
                      i < stars ? "fill-warning text-warning" : "text-muted"
                    }`}
                  />
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4">
                You've earned {stars} out of 5 stars today! Keep practicing!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Practice;
