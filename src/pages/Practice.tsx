import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, RotateCcw, Star, CheckCircle2, AlertCircle, SmartphoneCharging } from "lucide-react";
import breathingBuddy from "@/assets/breathing-buddy.png";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInhalationLogs } from "@/hooks/useRealtimeInhalationLogs";
import { useRealtimeDevice } from "@/hooks/useRealtimeDevice";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type BreathingPhase = "ready" | "inhale" | "hold" | "exhale" | "complete";

const Practice = () => {
  const [userId, setUserId] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stars, setStars] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<BreathingPhase>("ready");
  const [currentStep, setCurrentStep] = useState(0);
  const [breathingScale, setBreathingScale] = useState(1);
  const [sessionScore, setSessionScore] = useState(0);

  const { logs } = useRealtimeInhalationLogs(userId);
  const { device } = useRealtimeDevice(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const steps = [
    { title: "Shake inhaler", description: "Shake your inhaler and attach to spacer" },
    { title: "Exhale", description: "Breathe out completely" },
    { title: "Inhale slowly", description: "Press inhaler and breathe in slowly for 3-5 seconds" },
    { title: "Hold breath", description: "Hold your breath for 10 seconds" },
    { title: "Exhale slowly", description: "Breathe out slowly and relax" }
  ];

  const handleStart = () => {
    setIsPlaying(true);
    setCurrentStep(0);
    setProgress(0);
    setSessionScore(0);
    runBreathingCycle();
  };

  const runBreathingCycle = async () => {
    const phases: { phase: BreathingPhase; duration: number; scale: number }[] = [
      { phase: "inhale", duration: 4000, scale: 1.4 },
      { phase: "hold", duration: 10000, scale: 1.4 },
      { phase: "exhale", duration: 4000, scale: 1 },
    ];

    for (let i = 0; i < phases.length; i++) {
      if (!isPlaying) break;
      
      const { phase, duration, scale } = phases[i];
      setCurrentPhase(phase);
      setCurrentStep(i + 2); // +2 because steps 0 and 1 are preparation
      
      // Animate breathing scale
      const startTime = Date.now();
      const animationInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressPercent = Math.min(elapsed / duration, 1);
        
        if (phase === "inhale") {
          setBreathingScale(1 + (scale - 1) * progressPercent);
        } else if (phase === "exhale") {
          setBreathingScale(scale - (scale - 1) * progressPercent);
        } else {
          setBreathingScale(scale);
        }
        
        setProgress((i / phases.length) * 100 + (progressPercent / phases.length) * 100);
        
        if (elapsed >= duration) {
          clearInterval(animationInterval);
        }
      }, 50);

      await new Promise(resolve => setTimeout(resolve, duration));
      clearInterval(animationInterval);
    }

    // Complete
    setCurrentPhase("complete");
    setCurrentStep(4);
    setProgress(100);
    setIsPlaying(false);
    setStars((s) => Math.min(s + 1, 5));
    setSessionScore(100);
    
    // Save session
    if (userId) {
      await saveBreathingSession("perfect", "Great job! Perfect breathing technique! 🎉");
      toast.success("Session completed! You earned a star!");
    }
  };

  const saveBreathingSession = async (result: string, feedbackMessage: string) => {
    if (!userId) return;

    const latestLog = logs[0];
    await supabase.from("breathing_sessions").insert({
      user_id: userId,
      inhalation_strength: latestLog?.inhalation_strength || null,
      inhalation_duration: latestLog?.duration || null,
      holding_time: 10,
      orientation_angle: latestLog?.orientation_angle || null,
      result,
      feedback_message: feedbackMessage,
      session_type: "guided",
      score: sessionScore,
    });
  };

  const handleReset = () => {
    setProgress(0);
    setIsPlaying(false);
    setCurrentPhase("ready");
    setCurrentStep(0);
    setBreathingScale(1);
    setSessionScore(0);
  };

  const getPhaseInstruction = () => {
    switch (currentPhase) {
      case "ready":
        return "Ready to start your breathing practice?";
      case "inhale":
        return "Breathe in slowly and deeply...";
      case "hold":
        return "Hold your breath... Keep holding...";
      case "exhale":
        return "Now exhale slowly...";
      case "complete":
        return "Perfect! Great job! 🎉";
      default:
        return "";
    }
  };

  const getOrientationFeedback = () => {
    const latestLog = logs[0];
    if (!latestLog) return null;

    const angle = latestLog.orientation_angle;
    if (Math.abs(angle) > 30) {
      return {
        status: "error",
        message: "Hold inhaler upright!",
        color: "text-destructive"
      };
    } else if (Math.abs(angle) > 15) {
      return {
        status: "warning",
        message: "Adjust angle slightly",
        color: "text-warning"
      };
    }
    return {
      status: "success",
      message: "Perfect angle! ✓",
      color: "text-success"
    };
  };

  const orientationFeedback = getOrientationFeedback();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navigation />
      
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Breathing Trainer</h1>
            <p className="text-muted-foreground">Master proper breathing and inhaler technique</p>
          </div>
          {device && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-2">
                {device.is_charging ? (
                  <SmartphoneCharging className="h-4 w-4 text-success" />
                ) : null}
                {device.battery_level}%
              </Badge>
            </div>
          )}
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Step-by-Step Guide */}
          <Card>
            <CardHeader>
              <CardTitle>Guided Training Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      currentStep === index
                        ? "bg-primary/10 border-2 border-primary"
                        : currentStep > index
                        ? "bg-success/5 border border-success/20"
                        : "bg-muted/30 border border-muted"
                    }`}
                  >
                    <div className={`mt-1 ${currentStep >= index ? "text-primary" : "text-muted-foreground"}`}>
                      {currentStep > index ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{step.title}</h4>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main Practice Area */}
          <Card className="text-center">
            <CardHeader>
              <CardTitle>Breathing Animation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Breathing Buddy Character with Animation */}
              <div className="relative inline-block">
                <div 
                  className="transition-all duration-1000 ease-in-out"
                  style={{
                    transform: `scale(${breathingScale})`,
                  }}
                >
                  <img
                    src={breathingBuddy}
                    alt="Breeze Buddy"
                    className={`w-48 h-48 mx-auto ${
                      currentPhase === "hold" ? "animate-pulse" : ""
                    }`}
                  />
                </div>
                
                {/* Breathing Phase Indicator */}
                {currentPhase !== "ready" && currentPhase !== "complete" && (
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-full">
                    <Badge 
                      variant={currentPhase === "hold" ? "default" : "secondary"}
                      className="text-xs uppercase tracking-wider"
                    >
                      {currentPhase}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Live Instructions */}
              <div className="space-y-2 min-h-[80px]">
                <h3 className="text-xl font-bold">
                  {getPhaseInstruction()}
                </h3>
                {currentPhase === "inhale" && (
                  <p className="text-sm text-muted-foreground">
                    Breathe in through the spacer slowly and steadily
                  </p>
                )}
                {currentPhase === "hold" && (
                  <p className="text-sm text-muted-foreground">
                    Keep holding... this ensures medication reaches your lungs
                  </p>
                )}
              </div>

              {/* Orientation Feedback */}
              {orientationFeedback && logs.length > 0 && (
                <div className={`flex items-center justify-center gap-2 ${orientationFeedback.color}`}>
                  {orientationFeedback.status === "error" ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  <span className="font-semibold">{orientationFeedback.message}</span>
                  <span className="text-sm text-muted-foreground">
                    (Angle: {logs[0]?.orientation_angle?.toFixed(1)}°)
                  </span>
                </div>
              )}

              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress value={progress} className="h-3" />
                <div className="text-sm text-muted-foreground">
                  {Math.round(progress)}% Complete
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-2 justify-center">
                {!isPlaying ? (
                  <Button onClick={handleStart} size="lg" className="gap-2">
                    <Play className="h-4 w-4" />
                    Start Training
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

          {/* Recent Performance */}
          {logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Attempts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {logs.slice(0, 3).map((log) => (
                    <div 
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={log.result === "correct" ? "default" : "secondary"}>
                          {log.result}
                        </Badge>
                        <span className="text-sm">{log.feedback_message}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 justify-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-12 w-12 ${
                      i < stars ? "fill-warning text-warning" : "text-muted"
                    }`}
                  />
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground">
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
