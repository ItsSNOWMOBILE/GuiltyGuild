import { useState, useEffect } from "react";
import { Clock, Zap, CheckCircle, XCircle, AlertTriangle, Hexagon, Crown } from "lucide-react";
import { Button } from "./ui/button";
import { MysticBackground } from "./MysticBackground";

type GamePhase =
  | 'LOBBY'
  | 'STARTING'
  | 'QUESTION_READ'
  | 'QUESTION_ACTIVE'
  | 'WAITING_FOR_HOST'
  | 'REVEAL_ANSWER'
  | 'LEADERBOARD'
  | 'FINISHED';

interface Question {
  text: string;
  answers: string[];
  correctAnswer?: number;
}

interface RoundResult {
  answerIndex: number;
  scoreEarned: number;
  isCorrect: boolean;
}

interface TheTrialProps {
  phase: GamePhase;
  question?: Question;
  questionNumber: number;
  totalQuestions: number;
  timeLimit: number;
  phaseStartTime: number;
  onAnswer: (answerIndex: number) => void;
  hasAnswered: boolean;
  roundResult?: RoundResult;
  score?: number;
  rank?: number;
  isHost?: boolean;
  onTimeUp?: () => void;
}

export function TheTrial({
  phase,
  question,
  questionNumber,
  totalQuestions,
  timeLimit,
  phaseStartTime,
  onAnswer,
  hasAnswered,
  roundResult,
  score = 0,
  rank = 0,
  isHost = false,
  onTimeUp,
}: TheTrialProps) {
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // Sync Timer with Server Time
  useEffect(() => {
    if (phase !== 'QUESTION_ACTIVE' && phase !== 'STARTING') return;

    const updateTimer = () => {
      const now = Date.now();
      const elapsedSec = (now - phaseStartTime) / 1000;

      let newTime = 0;
      if (phase === 'STARTING') {
        newTime = Math.max(0, 3 - elapsedSec);
      } else {
        newTime = Math.max(0, timeLimit - elapsedSec);
      }

      if (phase === 'STARTING' && newTime <= 0.1) {
        console.log(`[Countdown DEBUG] STARTING Phase End. Time: ${newTime.toFixed(2)}`);
      }

      setTimeRemaining(newTime);

      // Fire onTimeUp exactly when the timer zeroes out for the Host
      if (newTime === 0 && phase === 'STARTING' && isHost && onTimeUp) {
        onTimeUp();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 200);
    return () => clearInterval(interval);
  }, [phase, phaseStartTime, timeLimit, isHost, onTimeUp]);

  // Reset selected answer when question changes
  useEffect(() => {
    setSelectedAnswer(null);
  }, [questionNumber]);

  // Keyboard shortcuts for answers (1-4 keys)
  useEffect(() => {
    if (phase !== 'QUESTION_ACTIVE' || hasAnswered) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const answerCount = question?.answers?.length || 4;

      // Number keys 1-4 (or 1-6 depending on answers)
      if (key >= '1' && key <= String(answerCount)) {
        const index = parseInt(key) - 1;
        if (index < answerCount) {
          handleAnswerClick(index);
        }
      }

      // Also support A, B, C, D keys
      const letterMap: Record<string, number> = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5 };
      const letterIndex = letterMap[key.toLowerCase()];
      if (letterIndex !== undefined && letterIndex < answerCount) {
        handleAnswerClick(letterIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, hasAnswered, question?.answers?.length]);

  const handleAnswerClick = (index: number) => {
    if (hasAnswered || phase !== 'QUESTION_ACTIVE') return;
    setSelectedAnswer(index);
    onAnswer(index);
  };

  // --- Styles ---
  // All visual state styling (colors, shadows, glows) is driven by CSS state
  // classes in src/index.css — Tailwind v4 has no Vite plugin here so arbitrary
  // hover:/shadow-[...] classes inside template literals are never generated.

  const baseAnswerClass =
    "answer-option relative group w-full p-6 text-left border-2 rounded-lg backdrop-blur-xl flex items-center gap-4";

  const getAnswerStateClass = (index: number): string => {
    const isSelected = selectedAnswer === index;
    const isReveal = phase === 'REVEAL_ANSWER';
    const correctAnswerNum = question?.correctAnswer !== undefined ? Number(question.correctAnswer) : undefined;
    const isCorrect = isReveal && correctAnswerNum === index;
    const isWrongSelection = isReveal && isSelected && !isCorrect;

    if (isReveal) {
      if (isCorrect) return "answer-correct";
      if (isWrongSelection) return "answer-wrong";
      return "answer-dimmed";
    }
    if (hasAnswered && !isHost) {
      return isSelected ? "answer-pending" : "answer-idle";
    }
    if (isSelected && !isHost) return "answer-selected";
    return "";
  };

  const letters = ["A", "B", "C", "D"];

  // 1. Starting Phase
  if (phase === 'STARTING') {
    return (
      <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center font-[Cinzel,serif]">
        <MysticBackground />
        <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in-75 duration-700 ease-out">
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Spinning Fate Rings - Royal Gold */}
            <div className="absolute inset-0 border-2 border-[#D946EF]/30 rounded-full animate-[spin_3s_linear_infinite]" />
            <div className="absolute inset-4 border-2 border-[#FFD700]/30 rounded-full animate-[spin_4s_linear_infinite_reverse]" />
            <div className="absolute inset-0 border-t-2 border-[#D946EF] rounded-full animate-[spin_1.5s_ease-in-out_infinite]" />

            {/* Countdown Number - Gold Glow */}
            <h1 className="text-7xl font-black text-[#FFD700] drop-shadow-[0_0_15px_rgba(255,215,0,0.6)] z-10 font-mono">
              {Math.ceil(timeRemaining)}
            </h1>
          </div>

          <div className="text-center space-y-2">
            <p className="text-[#D946EF] font-mono tracking-[0.5em] uppercase text-sm animate-pulse drop-shadow-[0_0_5px_rgba(217,70,239,0.5)]">
              System Initializing
            </p>
            <p className="text-[#FFD700]/70 text-xs tracking-widest uppercase">
              Establishing Connection...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Waiting Phase
  if ((hasAnswered && phase === 'QUESTION_ACTIVE') || phase === 'WAITING_FOR_HOST') {
    return (
      <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-8 font-[Cinzel,serif]">
        <MysticBackground />
        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in-90 duration-700 text-center">
          <div className="mb-6 relative flex items-center justify-center">
            {/* User Requested System Asset - Large Size (144px Width, Auto Height) */}
            <img
              src="https://i.imgur.com/bPg5PBn.png"
              alt="System"
              className="relative z-10 w-36 h-auto object-contain animate-pulse drop-shadow-[0_0_20px_rgba(217,70,239,0.5)]"
              style={{ width: '144px', height: 'auto' }}
            />
          </div>
          <h2 className="text-2xl text-[#FFD700] font-bold tracking-[0.2em] uppercase mb-2 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">System Processing</h2>
          <p className="text-[#D946EF] font-mono text-xs tracking-widest opacity-80">Calculating Response Vector...</p>
        </div>
      </div>
    );
  }

  // 3. Active / Reveal Interface
  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col font-sans selection:bg-[#FFD700] selection:text-black">
      <MysticBackground />

      <div className="relative z-10 flex flex-col min-h-screen max-w-5xl mx-auto w-full p-4 md:p-6">

        {/* Top HUD */}
        <div className="flex items-center justify-between mb-8 md:mb-12">
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <Zap className="w-4 h-4 text-[#FFD700]" />
            <span className="text-sm font-mono text-white/80">
              <span className="text-[#00C2FF]">Q{questionNumber}</span> <span className="text-white/30">/</span> {totalQuestions}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <Hexagon className="w-4 h-4 text-[#FFD700] fill-[#FFD700]/20" />
              <span className="text-sm font-mono text-white/80">
                <span className="text-[#FFD700]">{score}</span> <span className="text-white/30 text-[10px] uppercase">Pts</span>
              </span>
            </div>

            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <Crown className="w-4 h-4 text-[#00C2FF]" />
              <span className="text-sm font-mono text-white/80">
                <span className="text-white/30 text-[10px] uppercase mr-1">Rank</span> <span className="text-[#00C2FF]">#{rank}</span>
              </span>
            </div>
          </div>

          {phase === 'QUESTION_ACTIVE' && (
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <Clock className={`w-4 h-4 ${timeRemaining <= 5 ? 'text-red-500 animate-pulse' : 'text-[#00C2FF]'}`} />
              <span className={`text-xl font-bold font-mono ${timeRemaining <= 5 ? 'text-red-500' : 'text-white'}`}>
                {Math.ceil(timeRemaining)}s
              </span>
            </div>
          )}
        </div>

        {/* Mobile Sub-HUD for Score/Rank */}
        <div className="md:hidden flex items-center justify-center gap-4 mb-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/5">
            <Hexagon className="w-3 h-3 text-[#FFD700]" />
            <span className="text-xs font-mono text-[#FFD700] font-bold">{score}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/5">
            <Crown className="w-3 h-3 text-[#00C2FF]" />
            <span className="text-xs font-mono text-[#00C2FF] font-bold">#{rank}</span>
          </div>
        </div>

        {/* Floating Notification (Round Result) */}
        {phase === 'REVEAL_ANSWER' && roundResult && (
          <div className="mb-8 animate-in slide-in-from-top-4 fade-in duration-700 ease-out">
            <div className={`
                mx-auto max-w-md p-4 rounded-lg border backdrop-blur-xl flex items-center gap-4 shadow-2xl
                ${roundResult.isCorrect
                ? 'bg-green-950/60 border-green-500/50 shadow-green-900/20'
                : 'bg-red-950/60 border-red-500/50 shadow-red-900/20'}
             `}>
              <div className={`p-2 rounded-full ${roundResult.isCorrect ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {roundResult.isCorrect ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                <h3 className={`font-bold uppercase tracking-wider ${roundResult.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                  {roundResult.isCorrect ? "Correct" : "Incorrect"}
                </h3>
                <p className="text-xs text-white/60 font-mono">
                  {roundResult.isCorrect ? `+${roundResult.scoreEarned} Essence Acquired` : "Soul Damage Sustained"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Question Panel - The "System Window" */}
        <div className="mb-8 relative group animate-in slide-in-from-bottom-4 fade-in duration-700 delay-150">
          {/* Decorative Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#00C2FF]/20 via-[#FFD700]/10 to-[#00C2FF]/20 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-1000" />

          <div className="relative bg-[#0a0a0c]/90 backdrop-blur-xl border-2 border-[#7c3aed] rounded-lg p-8 md:p-12 text-center shadow-[0_0_40px_rgba(124,58,237,0.3)]">
            {/* Holographic Inner Border */}
            <div className="absolute inset-1 border border-[#D946EF]/20 rounded-md pointer-events-none" />

            <p className="text-[#D946EF] font-mono text-xs uppercase tracking-[0.3em] mb-4 drop-shadow-[0_0_5px_rgba(217,70,239,0.5)]">
              [ System Event: Incoming Query ]
            </p>

            <h2 className="text-2xl md:text-3xl font-bold text-white leading-relaxed font-sans drop-shadow-md tracking-wide">
              {question?.text || "Decrypting..."}
            </h2>
          </div>
        </div>

        {/* Answer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-300">
          {question?.answers.map((answer, index) => {
            return (
              <button
                key={index}
                onClick={() => handleAnswerClick(index)}
                disabled={hasAnswered || phase !== 'QUESTION_ACTIVE'}
                className={`${baseAnswerClass} ${getAnswerStateClass(index)}`}
              >
                {/* Letter Key */}
                <div className="answer-letter-key flex items-center justify-center w-10 h-10 rounded-lg border font-mono font-bold text-sm shrink-0 z-10">
                  {letters[index]}
                </div>

                {/* Answer Text */}
                <span className="answer-text text-lg font-bold tracking-wide">
                  {answer}
                </span>

                {/* Hover Reveal Texture (subtle grain) */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none rounded-lg" />
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
