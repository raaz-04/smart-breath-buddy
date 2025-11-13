import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, RotateCcw, Star, CheckCircle2, AlertCircle, SmartphoneCharging, TrendingUp, Calendar, Target } from "lucide-react";
import breathingBuddy from "@/assets/breathing-buddy.png";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInhalationLogs } from "@/hooks/useRealtimeInhalationLogs";
import { useRealtimeDevice } from "@/hooks/useRealtimeDevice";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval } from "date-fns";

type BreathingPhase = "ready" | "inhale" | "hold" | "exhale" | "complete";

interface BreathingSession {
  id: string;
  date: string;
  result: string;
  score: number;
  inhalation_strength: number;
  inhalation_duration: number;
  holding_time: number;
}

const Practice = () => {
  const [userId, setUserId] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stars, setStars] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<BreathingPhase>("ready");
  const [currentStep, setCurrentStep] = useState(0);
  const [breathingScale, setBreathingScale] = useState(1);
  const [sessionScore, setSessionScore] = useState(0);
  const [sessions, setSessions] = useState<BreathingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const { logs } = useRealtimeInhalationLogs(userId);
  const { device } = useRealtimeDevice(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchSessions();
  }, [userId]);

  const fetchSessions = async () => {
    if (!userId) return;
    
    const thirtyDaysAgo = subDays(new Date(), 30);
    const { data, error } = await supabase
      .from("breathing_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", thirtyDaysAgo.toISOString())
      .order("date", { ascending: true });

    if (!error && data) {
      setSessions(data);
    }
    setLoading(false);
  };

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
    
    // Refresh sessions after saving
    fetchSessions();
  };

  // Analytics calculations
  const getWeeklyData = () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return daysOfWeek.map((day) => {
      const daySessions = sessions.filter((s) =>
        isWithinInterval(new Date(s.date), {
          start: day,
          end: new Date(day.getTime() + 24 * 60 * 60 * 1000 - 1),
        })
      );

      const perfectCount = daySessions.filter((s) => s.result === "perfect").length;
      const avgScore = daySessions.length > 0
        ? daySessions.reduce((sum, s) => sum + s.score, 0) / daySessions.length
        : 0;

      return {
        day: format(day, "EEE"),
        sessions: daySessions.length,
        perfectSessions: perfectCount,
        avgScore: Math.round(avgScore),
        date: format(day, "MMM d"),
      };
    });
  };

  const getAccuracyTrend = () => {
    const last14Days = Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i));

    return last14Days.map((day) => {
      const daySessions = sessions.filter((s) =>
        isWithinInterval(new Date(s.date), {
          start: day,
          end: new Date(day.getTime() + 24 * 60 * 60 * 1000 - 1),
        })
      );

      const perfectRate = daySessions.length > 0
        ? (daySessions.filter((s) => s.result === "perfect").length / daySessions.length) * 100
        : 0;

      return {
        date: format(day, "MM/dd"),
        accuracy: Math.round(perfectRate),
        sessions: daySessions.length,
      };
    });
  };

  const getResultDistribution = () => {
    const resultCounts = sessions.reduce((acc, session) => {
      acc[session.result] = (acc[session.result] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(resultCounts).map(([name, value]) => ({ name, value }));
  };

  const getTechniqueMetrics = () => {
    if (sessions.length === 0) return null;

    const avgStrength = sessions.reduce((sum, s) => sum + (s.inhalation_strength || 0), 0) / sessions.length;
    const avgDuration = sessions.reduce((sum, s) => sum + (s.inhalation_duration || 0), 0) / sessions.length;
    const avgHoldTime = sessions.reduce((sum, s) => sum + (s.holding_time || 0), 0) / sessions.length;
    const completionRate = (sessions.filter(s => s.result === "perfect").length / sessions.length) * 100;

    return {
      avgStrength: avgStrength.toFixed(2),
      avgDuration: avgDuration.toFixed(1),
      avgHoldTime: avgHoldTime.toFixed(1),
      completionRate: completionRate.toFixed(1),
      totalSessions: sessions.length,
    };
  };

  const weeklyData = getWeeklyData();
  const accuracyTrend = getAccuracyTrend();
  const resultDistribution = getResultDistribution();
  const techniqueMetrics = getTechniqueMetrics();

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

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

          {/* Analytics Dashboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Progress Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="weekly" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                  <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
                  <TabsTrigger value="metrics">Metrics</TabsTrigger>
                </TabsList>

                <TabsContent value="weekly" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          This Week
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {weeklyData.reduce((sum, d) => sum + d.sessions, 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Total sessions</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Perfect
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-success">
                          {weeklyData.reduce((sum, d) => sum + d.perfectSessions, 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Perfect attempts</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Avg Score
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {Math.round(
                            weeklyData.reduce((sum, d) => sum + d.avgScore, 0) / 
                            weeklyData.filter(d => d.sessions > 0).length || 0
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Out of 100</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="day" 
                          className="text-xs"
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis 
                          className="text-xs"
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="sessions" fill="hsl(var(--primary))" name="Total Sessions" />
                        <Bar dataKey="perfectSessions" fill="hsl(var(--success))" name="Perfect Sessions" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                <TabsContent value="accuracy" className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">14-Day Accuracy Trend</h3>
                    <p className="text-xs text-muted-foreground">
                      Track your breathing technique improvement over the past two weeks
                    </p>
                  </div>

                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={accuracyTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          className="text-xs"
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis 
                          className="text-xs"
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                          domain={[0, 100]}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="accuracy" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          name="Accuracy %"
                          dot={{ fill: "hsl(var(--primary))" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {resultDistribution.length > 0 && (
                    <>
                      <div className="space-y-2 mt-6">
                        <h3 className="text-sm font-semibold">Result Distribution</h3>
                        <p className="text-xs text-muted-foreground">
                          Breakdown of your breathing session results
                        </p>
                      </div>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={resultDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="hsl(var(--primary))"
                              dataKey="value"
                            >
                              {resultDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "var(--radius)",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="metrics" className="space-y-4">
                  {techniqueMetrics ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                              Avg Strength
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{techniqueMetrics.avgStrength}</div>
                            <p className="text-xs text-muted-foreground">Flow rate</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                              Avg Duration
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{techniqueMetrics.avgDuration}s</div>
                            <p className="text-xs text-muted-foreground">Inhalation time</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                              Avg Hold Time
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{techniqueMetrics.avgHoldTime}s</div>
                            <p className="text-xs text-muted-foreground">Breath holding</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                              Success Rate
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-success">
                              {techniqueMetrics.completionRate}%
                            </div>
                            <p className="text-xs text-muted-foreground">Perfect sessions</p>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <h3 className="font-semibold flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-primary" />
                              Overall Performance
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              You've completed <span className="font-bold text-foreground">{techniqueMetrics.totalSessions}</span> breathing sessions 
                              with a <span className="font-bold text-success">{techniqueMetrics.completionRate}%</span> success rate.
                            </p>
                            {parseFloat(techniqueMetrics.completionRate) >= 70 && (
                              <p className="text-sm font-medium text-success">
                                🎉 Excellent progress! Keep up the great work!
                              </p>
                            )}
                            {parseFloat(techniqueMetrics.completionRate) < 70 && parseFloat(techniqueMetrics.completionRate) >= 50 && (
                              <p className="text-sm font-medium text-primary">
                                👍 Good job! Keep practicing to improve your technique.
                              </p>
                            )}
                            {parseFloat(techniqueMetrics.completionRate) < 50 && (
                              <p className="text-sm font-medium text-warning">
                                💪 Keep practicing! Consistency is key to improvement.
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold">Technique Recommendations</h3>
                        <div className="space-y-2">
                          {parseFloat(techniqueMetrics.avgDuration) < 3 && (
                            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                              <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                              <div className="text-sm">
                                <span className="font-medium">Slow down your inhalation:</span> Try to breathe in for 3-5 seconds for better medication delivery.
                              </div>
                            </div>
                          )}
                          {parseFloat(techniqueMetrics.avgHoldTime) < 8 && (
                            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                              <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                              <div className="text-sm">
                                <span className="font-medium">Increase hold time:</span> Hold your breath for at least 10 seconds to allow medication to settle in your lungs.
                              </div>
                            </div>
                          )}
                          {parseFloat(techniqueMetrics.completionRate) >= 80 && (
                            <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
                              <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                              <div className="text-sm">
                                <span className="font-medium">Excellent technique!</span> Your breathing pattern is optimal for effective medication delivery.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Complete some breathing sessions to see your technique metrics.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Practice;
