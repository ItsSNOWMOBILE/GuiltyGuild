import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  Play,
  Settings,
  XCircle,
  SkipForward,
  Trophy,
  Loader2,
  FolderOpen,
  Save,
  Plus,
  Zap,
  Users,
  Eye,
  EyeOff,
  CheckCircle,
  GripVertical,
  Edit2
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { toast } from "sonner";
import { API_BASE_URL } from "../utils/config";

interface Question {
  id?: string;
  text: string;
  answers: string[];
  correctAnswer?: number;
}

interface SavedQuiz {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  timeLimitSeconds: number;
  createdAt: number;
}

interface GameStats {
  totalPlayers: number;
  answered: number;
  correct: number;
  incorrect: number;
}

type GamePhase =
  | 'LOBBY'
  | 'STARTING'
  | 'QUESTION_READ'
  | 'QUESTION_ACTIVE'
  | 'WAITING_FOR_HOST'
  | 'REVEAL_ANSWER'
  | 'LEADERBOARD'
  | 'FINISHED'
  | 'OFFLINE';

interface WeaversLoomProps {
  isSovereignMode: boolean;
  onToggleMode: () => void;
  questions: Question[];
  onUpdateQuestions: (questions: Question[]) => void;
  onStartGame: () => void;
  onNextQuestion: () => void;
  onRevealArgs: () => void;
  onLeaderboardArgs: () => void;
  gameStats: GameStats | null;
  currentQuestionIndex: number;
  gameStatus: GamePhase;
  onTerminate: () => void;
  // New props for quiz management
  sessionId?: string | null;
  projectId?: string;
  publicAnonKey?: string;
  timeLimitSeconds?: number;
  onUpdateTimeLimit?: (seconds: number) => void;
  isActionLoading?: boolean;
}

// Ensure questions have IDs
const ensureQuestionIds = (questions: Question[]) => {
  return questions.map(q => ({
    ...q,
    id: q.id || crypto.randomUUID()
  }));
};

interface SortableQuestionItemProps {
  question: Question;
  index: number;
  isCurrentQuestion: boolean;
  gameStatus: GamePhase;
  handleDeleteQuestion: (index: number) => void;
  handleEditQuestion: (index: number) => void;
}

function SortableQuestionItem({ question, index, isCurrentQuestion, gameStatus, handleDeleteQuestion, handleEditQuestion }: SortableQuestionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-[#1a1a1a] p-4 rounded border relative group flex items-start gap-3 transition-opacity ${isCurrentQuestion
        ? 'border-[#FFD700] border-2 shadow-[0_0_20px_rgba(255,215,0,0.4)] animate-pulse'
        : 'border-[#00C2FF]/20 hover:border-[#00C2FF]/50'
        } ${isDragging ? 'opacity-50 scale-[1.02] shadow-2xl' : ''}`}
    >
      {/* Current question indicator */}
      {isCurrentQuestion && (
        <div className="absolute -top-3 left-4 bg-[#FFD700] text-[#050505] px-3 py-0.5 rounded text-xs font-bold tracking-wider z-10">
          CURRENT
        </div>
      )}

      {/* Drag Handle */}
      {(gameStatus === "LOBBY" || gameStatus === "OFFLINE") && (
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing p-1 hover:bg-white/5 rounded text-[#6b7280] hover:text-[#00C2FF] transition-colors"
        >
          <GripVertical className="w-5 h-5" />
        </div>
      )}

      <div className="flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className={`mb-2 font-medium whitespace-pre-wrap ${isCurrentQuestion ? 'text-[#FFD700]' : 'text-[#00C2FF]'}`}>
              {index + 1}. {question.text}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {question.answers.map((answer, ansIdx) => (
                <div
                  key={ansIdx}
                  className={`flex items-center gap-2 ${ansIdx === question.correctAnswer ? 'text-[#FFD700]' : 'text-[#6b7280]'}`}
                >
                  {ansIdx === question.correctAnswer && <CheckCircle className="w-3 h-3" />}
                  {String.fromCharCode(65 + ansIdx)}. {answer}
                </div>
              ))}
            </div>
          </div>

          {(gameStatus === "LOBBY" || gameStatus === "OFFLINE") && (
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                onClick={() => handleEditQuestion(index)}
                variant="ghost"
                size="sm"
                className="text-[#cc9900] hover:text-[#FFD700] hover:bg-[#FFD700]/10"
                title="Edit Question"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => handleDeleteQuestion(index)}
                variant="ghost"
                size="sm"
                className="text-[#880015] hover:text-[#aa0020] hover:bg-[#880015]/10"
                title="Delete Question"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WeaversLoom({
  isSovereignMode,
  onToggleMode,
  questions,
  onUpdateQuestions,
  onStartGame,
  onNextQuestion,
  onRevealArgs,
  onLeaderboardArgs,
  gameStats,
  currentQuestionIndex,
  gameStatus,
  onTerminate,
  sessionId,
  projectId,
  publicAnonKey,
  timeLimitSeconds = 30,
  onUpdateTimeLimit,
  isActionLoading = false,
}: WeaversLoomProps) {
  const [newQuestion, setNewQuestion] = useState<Question>({
    text: "",
    answers: ["", "", "", ""],
    correctAnswer: 0,
  });

  // Ensure initial questions have IDs
  useEffect(() => {
    const hasMissingIds = questions.some(q => !q.id);
    if (hasMissingIds && questions.length > 0) {
      onUpdateQuestions(ensureQuestionIds(questions));
    }
  }, [questions, onUpdateQuestions]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before dragging starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Quiz management state
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizName, setQuizName] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSovereignMode) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (gameStatus === 'REVEAL_ANSWER' || gameStatus === 'LEADERBOARD') {
            onNextQuestion();
          }
          break;
        case 'r':
        case 'R':
          if (gameStatus === 'QUESTION_ACTIVE') {
            onRevealArgs();
          }
          break;
        case 'l':
        case 'L':
          if (gameStatus === 'REVEAL_ANSWER') {
            onLeaderboardArgs();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSovereignMode, gameStatus, onNextQuestion, onRevealArgs, onLeaderboardArgs]);

  // Load saved quizzes
  const loadQuizzes = useCallback(async () => {
    if (!sessionId || !projectId || !publicAnonKey || sessionId === "demo-session") return;

    setIsLoadingQuizzes(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/make-server-983e2ba5/quiz/list`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "X-Session-ID": sessionId,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSavedQuizzes(data.quizzes || []);
      }
    } catch (err) {
      console.error("Failed to load quizzes:", err);
    } finally {
      setIsLoadingQuizzes(false);
    }
  }, [sessionId, projectId, publicAnonKey]);

  useEffect(() => {
    if (showQuizModal) {
      loadQuizzes();
    }
  }, [showQuizModal, loadQuizzes]);

  // Save current quiz
  const saveQuiz = async () => {
    if (!sessionId || !projectId || !publicAnonKey) return;
    if (!quizName.trim()) {
      toast.error("Please enter a quiz name");
      return;
    }
    if (questions.length === 0) {
      toast.error("Add some questions first");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/make-server-983e2ba5/quiz/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
            "X-Session-ID": sessionId,
          },
          body: JSON.stringify({
            name: quizName,
            description: quizDescription,
            questions,
            timeLimitSeconds,
          }),
        }
      );

      if (response.ok) {
        toast.success("Quiz saved successfully!");
        setQuizName("");
        setQuizDescription("");
        setShowQuizModal(false);
        loadQuizzes();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save quiz");
      }
    } catch (err) {
      console.error("Failed to save quiz:", err);
      toast.error("Failed to save quiz");
    } finally {
      setIsSaving(false);
    }
  };

  // Load a quiz
  const loadQuiz = async (quizId: string) => {
    if (!sessionId || !projectId || !publicAnonKey) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/make-server-983e2ba5/quiz/${quizId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "X-Session-ID": sessionId,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        onUpdateQuestions(data.quiz.questions);
        if (onUpdateTimeLimit && data.quiz.timeLimitSeconds) {
          onUpdateTimeLimit(data.quiz.timeLimitSeconds);
        }
        toast.success(`Loaded "${data.quiz.name}"`);
        setShowQuizModal(false);
      } else {
        toast.error("Failed to load quiz");
      }
    } catch (err) {
      console.error("Failed to load quiz:", err);
      toast.error("Failed to load quiz");
    }
  };

  // Delete a quiz
  const deleteQuiz = async (quizId: string) => {
    if (!sessionId || !projectId || !publicAnonKey) return;
    if (!confirm("Delete this quiz permanently?")) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/make-server-983e2ba5/quiz/${quizId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "X-Session-ID": sessionId,
          },
        }
      );

      if (response.ok) {
        toast.success("Quiz deleted");
        loadQuizzes();
      } else {
        toast.error("Failed to delete quiz");
      }
    } catch (err) {
      toast.error("Failed to delete quiz");
    }
  };

  const handleAddQuestion = () => {
    if (newQuestion.text && newQuestion.answers.every(a => a.trim())) {
      const questionToAdd = { ...newQuestion, id: crypto.randomUUID() };
      onUpdateQuestions([...questions, questionToAdd]);
      setNewQuestion({
        text: "",
        answers: ["", "", "", ""],
        correctAnswer: 0,
      });
    }
  };

  const handleDeleteQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    onUpdateQuestions(updated);
  };

  const handleEditQuestion = (index: number) => {
    const questionToEdit = questions[index];
    setNewQuestion({ ...questionToEdit });
    const updated = questions.filter((_, i) => i !== index);
    onUpdateQuestions(updated);
    // Scroll to top of window to see the edit form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);

      onUpdateQuestions(arrayMove(questions, oldIndex, newIndex));
    }
  };

  if (!isSovereignMode) {
    return null;
  }

  // Progress calculations
  const totalQuestions = questions.length;
  const currentQ = currentQuestionIndex + 1;
  const progressPercent = totalQuestions > 0 ? (currentQ / totalQuestions) * 100 : 0;
  const answeredPercent = gameStats && gameStats.totalPlayers > 0
    ? (gameStats.answered / gameStats.totalPlayers) * 100
    : 0;

  const renderControls = () => {
    switch (gameStatus) {
      case 'OFFLINE':
        return (
          <Button
            onClick={onStartGame}
            disabled={questions.length === 0}
            className="w-full relative overflow-hidden group bg-gradient-to-r from-[#00C2FF] to-[#0090cc] hover:from-[#0090cc] hover:to-[#00C2FF] text-[#050505] font-bold tracking-widest uppercase py-6 shadow-[0_0_20px_rgba(0,194,255,0.3)] hover:shadow-[0_0_40px_rgba(0,194,255,0.6)] border border-[#00C2FF]/50"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 transform skew-y-12" />
            <Play className="w-5 h-5 mr-3 relative z-10" />
            <span className="relative z-10">Open Nightmare Gate</span>
          </Button>
        );
      case 'LOBBY':
        return (
          <Button
            onClick={onStartGame}
            disabled={questions.length === 0 || isActionLoading}
            className="w-full relative overflow-hidden group bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FFD700] bg-[length:200%_auto] hover:bg-right transition-all duration-500 text-black font-bold tracking-widest uppercase py-6 shadow-[0_0_20px_rgba(255,215,0,0.3)] hover:shadow-[0_0_40px_rgba(255,215,0,0.6)] border border-[#FFD700]/50"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 transform skew-y-12" />
            {isActionLoading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Play className="w-5 h-5 mr-3 relative z-10 group-hover:scale-125 transition-transform duration-300" />}
            <span className="relative z-10">Begin The Trial</span>
          </Button>
        );
      case 'STARTING':
        return (
          <Button
            onClick={onNextQuestion}
            variant="ghost"
            disabled={isActionLoading}
            className="w-full bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/20 border border-[#FFD700]/30 animate-pulse"
          >
            {isActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Fate is manifesting... (Force Start)
          </Button>
        );
      case 'QUESTION_ACTIVE':
        return (
          <Button
            onClick={onRevealArgs}
            disabled={isActionLoading}
            className="w-full bg-gradient-to-r from-[#880015] to-[#aa0020] hover:from-[#aa0020] hover:to-[#880015] text-white"
          >
            {isActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
            Reveal Truth
            <span className="ml-2 text-xs opacity-70">(R)</span>
          </Button>
        );
      case 'REVEAL_ANSWER':
        return (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onLeaderboardArgs} disabled={isActionLoading} className="bg-[#00C2FF]/20 text-[#00C2FF] hover:bg-[#00C2FF]/30">
              {isActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trophy className="w-4 h-4 mr-2" />}
              Ascension
              <span className="ml-1 text-xs opacity-70">(L)</span>
            </Button>
            <Button onClick={onNextQuestion} disabled={isActionLoading} className="bg-[#FFD700]/20 text-[#FFD700] hover:bg-[#FFD700]/30">
              {isActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <SkipForward className="w-4 h-4 mr-2" />}
              Next
              <span className="ml-1 text-xs opacity-70">(␣)</span>
            </Button>
          </div>
        );
      case 'LEADERBOARD':
        return (
          <Button
            onClick={onNextQuestion}
            disabled={isActionLoading}
            className="w-full bg-gradient-to-r from-[#00C2FF] to-[#0090cc] hover:from-[#0090cc] hover:to-[#00C2FF] text-[#050505]"
          >
            {isActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <SkipForward className="w-4 h-4 mr-2" />}
            Next Nightmare
            <span className="ml-2 text-xs opacity-70">(␣)</span>
          </Button>
        );
      case 'FINISHED':
        return (
          <div className="text-center p-4 bg-[#FFD700]/10 border border-[#FFD700] rounded">
            <p className="text-[#FFD700]">The Trial is complete</p>
          </div>
        );
      default:
        return (
          <Button onClick={onNextQuestion} variant="outline">Force Next</Button>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#00C2FF]">
      {/* Header with mode toggle */}
      <div className="bg-[#050505] border-b-2 border-[#FFD700]/30 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl text-[#FFD700] tracking-wider">
              Weaver's Loom
            </h1>
            <span className="text-[#6b7280] text-sm">
              Command the fate of Sleepers
            </span>
          </div>

          <div className="flex items-center gap-3 bg-[#1a1a1a] px-4 py-2 rounded-lg border border-[#FFD700]/30">
            <Label htmlFor="mode-toggle" className="text-[#00C2FF] flex items-center gap-2">
              {isSovereignMode ? (
                <>
                  <Eye className="w-4 h-4 text-[#FFD700]" />
                  Sovereign Mode
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-[#6b7280]" />
                  Sleeper Mode
                </>
              )}
            </Label>
            <Switch
              id="mode-toggle"
              checked={isSovereignMode}
              onCheckedChange={onToggleMode}
              className="data-[state=checked]:bg-[#FFD700]"
            />
          </div>

          <Button
            onClick={onTerminate}
            variant="ghost"
            className="ml-4 text-red-500 hover:text-red-400 hover:bg-red-900/20 border border-red-900/50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            End Session
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Question management */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quiz Management Bar */}
            {(gameStatus === "LOBBY" || gameStatus === "OFFLINE") && (
              <div className="flex items-center gap-3 p-4 bg-[#0a0a0a] border-2 border-[#00C2FF]/30 rounded-lg">
                <Button
                  onClick={() => setShowQuizModal(true)}
                  variant="outline"
                  className="border-[#00C2FF]/30 text-[#00C2FF] hover:bg-[#00C2FF]/10"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Load Quiz
                </Button>

                <Button
                  onClick={() => {
                    setShowQuizModal(true);
                    setQuizName("");
                    setQuizDescription("");
                  }}
                  variant="outline"
                  className="border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/10"
                  disabled={questions.length === 0}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Quiz
                </Button>

                <div className="flex-1" />

                <div className="flex items-center gap-2">
                  <Label className="text-[#6b7280] text-sm">Time Limit:</Label>
                  <Input
                    type="number"
                    value={timeLimitSeconds}
                    onChange={(e) => onUpdateTimeLimit?.(parseInt(e.target.value) || 30)}
                    className="w-20 bg-[#1a1a1a] border-[#00C2FF]/30 text-[#00C2FF] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min={5}
                    max={120}
                  />
                  <span className="text-[#6b7280] text-sm">sec</span>
                </div>
              </div>
            )}

            {/* Add new question form */}
            {(gameStatus === "LOBBY" || gameStatus === "OFFLINE") && (
              <div className="bg-[#0a0a0a] border-2 border-[#00C2FF]/30 rounded-lg p-6">
                <h2 className="text-[#FFD700] mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Manifest New Question
                </h2>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="question-text" className="text-[#00C2FF]">
                      Question
                    </Label>
                    <Textarea
                      id="question-text"
                      value={newQuestion.text}
                      onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                      placeholder="Enter your question..."
                      className="bg-[#1a1a1a] border-[#00C2FF]/30 text-[#00C2FF] min-h-[4rem] resize-y"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {newQuestion.answers.map((answer, index) => (
                      <div key={index}>
                        <div className="flex justify-between items-center mb-1">
                          <Label htmlFor={`answer-${index}`} className="text-[#00C2FF] text-sm">
                            Answer {String.fromCharCode(65 + index)}
                          </Label>
                          {newQuestion.answers.length > 2 && (
                            <button
                              onClick={() => {
                                const updated = newQuestion.answers.filter((_, i) => i !== index);
                                let newCorrect = newQuestion.correctAnswer;
                                if (index < newCorrect!) newCorrect!--;
                                if (index === newCorrect) newCorrect = 0;
                                setNewQuestion({ ...newQuestion, answers: updated, correctAnswer: Math.min(newCorrect!, updated.length - 1) });
                              }}
                              className="text-[#880015] hover:text-red-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Input
                            id={`answer-${index}`}
                            value={answer}
                            onChange={(e) => {
                              const updated = [...newQuestion.answers];
                              updated[index] = e.target.value;
                              setNewQuestion({ ...newQuestion, answers: updated });
                            }}
                            placeholder={`Answer ${index + 1}`}
                            className={`bg-[#1a1a1a] border-[#00C2FF]/30 text-[#00C2FF] ${newQuestion.correctAnswer === index ? 'border-[#FFD700] border-2' : ''}`}
                          />
                          <button
                            onClick={() => setNewQuestion({ ...newQuestion, correctAnswer: index })}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 ${newQuestion.correctAnswer === index ? 'text-[#FFD700]' : 'text-[#6b7280]'}`}
                            title="Mark as correct answer"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {newQuestion.answers.length < 6 && (
                      <Button
                        variant="outline"
                        className="h-full min-h-[40px] border-dashed border-[#00C2FF]/30 text-[#00C2FF]/50 hover:text-[#00C2FF] hover:border-[#00C2FF]"
                        onClick={() => {
                          setNewQuestion({ ...newQuestion, answers: [...newQuestion.answers, ""] });
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <Button
                    onClick={handleAddQuestion}
                    disabled={!newQuestion.text || !newQuestion.answers.every(a => a.trim()) || newQuestion.answers.length < 2}
                    className="w-full bg-gradient-to-r from-[#00C2FF] to-[#0090cc] hover:from-[#0090cc] hover:to-[#00C2FF] text-[#050505]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </div>
            )}

            {/* Question list */}
            <div className="bg-[#0a0a0a] border-2 border-[#00C2FF]/30 rounded-lg p-6">
              <h2 className="text-[#FFD700] mb-4">
                Woven Questions ({questions.length})
              </h2>

              <div className="space-y-3 max-h-[600px] overflow-y-auto px-1 pb-4">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={questions.map(q => q.id || '')}
                    strategy={verticalListSortingStrategy}
                  >
                    {questions.map((q, index) => {
                      const isCurrentQuestion = index === currentQuestionIndex && gameStatus !== "LOBBY" && gameStatus !== "FINISHED";
                      return (
                        <SortableQuestionItem
                          key={q.id || index}
                          question={q}
                          index={index}
                          isCurrentQuestion={isCurrentQuestion}
                          gameStatus={gameStatus}
                          handleDeleteQuestion={handleDeleteQuestion}
                          handleEditQuestion={handleEditQuestion}
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>

          {/* Right column: Game controls and stats */}
          <div className="space-y-6">
            {/* Game controls */}
            <div className="bg-[#0a0a0a] border-2 border-[#FFD700]/30 rounded-lg p-6 sticky top-6">
              <h2 className="text-[#FFD700] mb-4 flex items-center justify-between">
                <span>Weaver's Controls</span>
                <span className="text-xs bg-[#FFD700]/10 px-2 py-1 rounded border border-[#FFD700]/30">{gameStatus}</span>
              </h2>

              {/* Question Progress Indicator */}
              {gameStatus !== 'LOBBY' && gameStatus !== 'FINISHED' && (
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#00C2FF] flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#FFD700]" />
                      Question {currentQ} of {totalQuestions}
                    </span>
                    <span className="text-[#6b7280]">{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] transition-all duration-500"
                      style={{ width: `${progressPercent}% ` }}
                    />
                  </div>
                </div>
              )}

              {/* Answer Submission Progress */}
              {(gameStatus === 'QUESTION_ACTIVE' || gameStatus === 'REVEAL_ANSWER') && gameStats && (
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#00C2FF] flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Answered
                    </span>
                    <span className="text-[#6b7280]">{gameStats.answered} / {gameStats.totalPlayers}</span>
                  </div>
                  <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00C2FF] to-[#0090cc] transition-all duration-300"
                      style={{ width: `${answeredPercent}% ` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {renderControls()}
              </div>

              {/* Live stats */}
              <div className="mt-8 pt-4 border-t border-[#333]">
                <h3 className="text-[#FFD700] mb-4 text-sm uppercase tracking-widest">
                  Live Statistics
                </h3>
                {gameStats ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[#6b7280]">Total Sleepers</span>
                      <span className="text-[#00C2FF]">{gameStats.totalPlayers}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[#6b7280]">Answered</span>
                      <span className="text-[#00C2FF]">{gameStats.answered}</span>
                    </div>

                    <div className="h-px bg-[#00C2FF]/20" />

                    <div className="flex justify-between items-center">
                      <span className="text-[#6b7280] flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Survivors
                      </span>
                      <span className="text-green-500">{gameStats.correct}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[#6b7280] flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-[#880015]" />
                        Fallen
                      </span>
                      <span className="text-[#880015]">{gameStats.incorrect}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-600 italic">Waiting for data...</div>
                )}
              </div>

              {/* Keyboard shortcuts hint */}
              <div className="mt-6 pt-4 border-t border-[#333]">
                <p className="text-[#6b7280] text-xs">
                  <span className="text-[#00C2FF]">Shortcuts:</span> R = Reveal | L = Leaderboard | Space = Next
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Modal */}
      {showQuizModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border-2 border-[#00C2FF]/30 rounded-xl p-6 max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-[#FFD700] text-xl">Quiz Manager</h2>
              <Button
                onClick={() => setShowQuizModal(false)}
                variant="ghost"
                size="sm"
                className="text-[#6b7280] hover:text-white"
              >
                ✕
              </Button>
            </div>

            {/* Save new quiz form */}
            <div className="mb-6 p-4 bg-[#1a1a1a] rounded-lg border border-[#FFD700]/30">
              <h3 className="text-[#FFD700] mb-4 text-sm uppercase tracking-wider">Save Current Quiz</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Quiz Name"
                  value={quizName}
                  onChange={(e) => setQuizName(e.target.value)}
                  className="bg-[#0a0a0a] border-[#00C2FF]/30 text-white"
                />
                <Input
                  placeholder="Description (optional)"
                  value={quizDescription}
                  onChange={(e) => setQuizDescription(e.target.value)}
                  className="bg-[#0a0a0a] border-[#00C2FF]/30 text-white"
                />
                <Button
                  onClick={saveQuiz}
                  disabled={isSaving || !quizName.trim() || questions.length === 0}
                  className="w-full bg-gradient-to-r from-[#FFD700] to-[#cc9900] text-[#050505]"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Quiz ({questions.length} questions)
                </Button>
              </div>
            </div>

            {/* Saved quizzes list */}
            <div className="overflow-y-auto flex-1 pr-2 min-h-0">
              <div className="sticky top-0 bg-[#0a0a0a] pb-2 pt-1 z-10 border-b border-[#00C2FF]/20 mb-4">
                <h3 className="text-[#00C2FF] text-sm uppercase tracking-wider">Saved Quizzes</h3>
              </div>
              {isLoadingQuizzes ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00C2FF] mx-auto" />
                </div>
              ) : savedQuizzes.length === 0 ? (
                <p className="text-[#6b7280] text-center py-8">No saved quizzes yet</p>
              ) : (
                <div className="space-y-3">
                  {savedQuizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-lg border border-[#00C2FF]/20 hover:border-[#00C2FF]/40 transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="text-white font-medium">{quiz.name}</h4>
                        <p className="text-[#6b7280] text-sm">
                          {quiz.questionCount} questions • {quiz.timeLimitSeconds}s per question
                        </p>
                        {quiz.description && (
                          <p className="text-[#6b7280] text-xs mt-1">{quiz.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => loadQuiz(quiz.id)}
                          size="sm"
                          className="bg-[#00C2FF]/20 text-[#00C2FF] hover:bg-[#00C2FF]/30"
                        >
                          Load
                        </Button>
                        <Button
                          onClick={() => deleteQuiz(quiz.id)}
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-400 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
