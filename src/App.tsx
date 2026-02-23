/// <reference types="vite/client" />
import { useState, useEffect, useRef, useCallback } from "react";
import { NightmareGate } from "./components/NightmareGate";
import { SoulSea } from "./components/SoulSea";
import { TheTrial } from "./components/TheTrial";
import { WeaversLoom } from "./components/WeaversLoom";
import { Ascension } from "./components/Ascension";
import { projectId, publicAnonKey } from "./utils/supabase/info";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { MysticBackground } from "./components/MysticBackground";
import { DISCORD_CONFIG } from "./utils/config";
import { io, Socket } from "socket.io-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
    id: string;
    username: string;
    avatar?: string;
}

interface Player {
    id: string;
    username: string;
    avatar?: string;
    score: number;
}

interface Question {
    text: string;
    answers: string[];
    correctAnswer?: number;
}

type GamePhase =
    | "LOBBY"
    | "STARTING"
    | "QUESTION_READ"
    | "QUESTION_ACTIVE"
    | "WAITING_FOR_HOST"
    | "REVEAL_ANSWER"
    | "LEADERBOARD"
    | "FINISHED";

interface GameState {
    id: string;
    hostId: string;
    phase: GamePhase;
    players: string[];
    currentQuestionIndex: number;
    questions?: Question[];
    currentQuestion?: Question;
    phaseStartTime: number;
    timeLimitSeconds: number;
    totalQuestions?: number;
    scores: Record<string, number>;
    playerData?: Player[];
    userHasAnswered?: boolean;
    roundResult?: {
        answerIndex: number;
        scoreEarned: number;
        isCorrect: boolean;
    };
    currentRoundAnswers?: Record<string, {
        answerIndex: number;
        timeTakenMs: number;
        scoreEarned: number;
        timestamp: number;
    }>;
}

type AppScreen = "login" | "waiting" | "lobby" | "quiz" | "admin" | "leaderboard";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API = "http://localhost:3001/make-server-983e2ba5";

const ALLOWED_HOSTS: readonly string[] = [
    "894118872712613898",
    "339513008835395587",
    "1125935493029310595",
    "525421911220682772",
    "1474209423378481194",
];

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
    const [screen, setScreen] = useState<AppScreen>("login");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [gameId, setGameId] = useState<string | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSovereignMode, setIsSovereignMode] = useState(false);
    const [isHostActionLoading, setIsHostActionLoading] = useState(false);

    // Questions the host manages locally (loaded into game on start)
    const [questions, setQuestions] = useState<Question[]>([
        {
            text: "Who is the main protagonist of Shadow Slave?",
            answers: ["Nephis", "Cassie", "Sunny", "Kai"],
            correctAnswer: 2,
        },
        {
            text: "What is Sunny's Aspect called?",
            answers: ["Divine Flame", "Shadow Slave", "Immortal", "Void Walker"],
            correctAnswer: 1,
        },
    ]);
    const [timeLimitSeconds, setTimeLimitSeconds] = useState(30);

    // Refs for stable closures in effects / socket handlers
    const sovereignModeRef = useRef(false);
    const sessionIdRef = useRef<string | null>(null);
    const gameIdRef = useRef<string | null>(null);

    useEffect(() => { sovereignModeRef.current = isSovereignMode; }, [isSovereignMode]);
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
    useEffect(() => { gameIdRef.current = gameId; }, [gameId]);

    // -------------------------------------------------------------------------
    // Screen routing
    // -------------------------------------------------------------------------

    const syncScreenWithPhase = useCallback(
        (state: GameState, sovereignMode: boolean) => {
            if (sovereignMode) {
                setScreen("admin");
                return;
            }
            switch (state.phase) {
                case "LOBBY":
                    setScreen("lobby");
                    break;
                case "STARTING":
                case "QUESTION_READ":
                case "QUESTION_ACTIVE":
                case "WAITING_FOR_HOST":
                case "REVEAL_ANSWER":
                    setScreen("quiz");
                    break;
                case "LEADERBOARD":
                case "FINISHED":
                    setScreen("leaderboard");
                    break;
            }
        },
        []
    );

    // -------------------------------------------------------------------------
    // Session management
    // -------------------------------------------------------------------------

    const handleLogout = useCallback(() => {
        localStorage.removeItem("guilty_guild_session_id");
        localStorage.removeItem("guilty_guild_user");
        setSessionId(null);
        setUser(null);
        setGameId(null);
        setGameState(null);
        setScreen("login");
        toast.success("Disconnected from the Nexus.");
    }, []);

    // Session restoration + Discord OAuth code handling
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
            handleDiscordCallback(code);
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        const savedSession = localStorage.getItem("guilty_guild_session_id");
        const savedUser = localStorage.getItem("guilty_guild_user");

        if (savedSession && savedUser) {
            const parsedUser: User = JSON.parse(savedUser);

            if (savedSession === "demo-session") {
                setSessionId(savedSession);
                setUser(parsedUser);
                return;
            }

            // Verify session with backend
            fetch(`${API}/auth/verify`, {
                headers: { "X-Session-ID": savedSession },
            })
                .then((r) => r.ok ? r.json() : Promise.reject(r.status))
                .then((data) => {
                    const normalizedUser: User = {
                        ...data.user,
                        id: data.user.id ?? data.user.userId,
                    };
                    setSessionId(savedSession);
                    setUser(normalizedUser);
                })
                .catch(() => handleLogout());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // -------------------------------------------------------------------------
    // Demo mode
    // -------------------------------------------------------------------------

    const handleDemoLogin = () => {
        const demoUser: User = { id: "demo-user-123", username: "Sunless" };
        const demoPlayers: Player[] = [{ id: "demo-user-123", username: "Sunless", score: 0 }];
        const demoScores: Record<string, number> = { "demo-user-123": 0 };

        for (let i = 1; i <= 50; i++) {
            const botId = `demo-bot-${i}`;
            demoScores[botId] = 0;
            demoPlayers.push({
                id: botId,
                username: `Sleeper ${i}`,
                score: Math.floor(Math.random() * 500),
            });
        }

        const demoState: GameState = {
            id: "demo-game-123",
            hostId: "demo-user-123",
            phase: "LOBBY",
            players: demoPlayers.map((p) => p.id),
            currentQuestionIndex: -1,
            questions,
            phaseStartTime: Date.now(),
            timeLimitSeconds: 30,
            scores: demoScores,
            playerData: demoPlayers,
            currentRoundAnswers: {},
        };

        setSessionId("demo-session");
        setUser(demoUser);
        localStorage.setItem("guilty_guild_session_id", "demo-session");
        localStorage.setItem("guilty_guild_user", JSON.stringify(demoUser));
        setGameId("demo-game-123");
        setGameState(demoState);
        setIsSovereignMode(true);
        setScreen("admin");
        toast.success("Demo Mode Activated – You are the Weaver");
    };

    // -------------------------------------------------------------------------
    // Demo action engine
    // -------------------------------------------------------------------------

    const handleDemoAction = useCallback(
        (action: string, payload?: any) => {
            setGameState((prev) => {
                if (!prev) return null;
                const state = { ...prev };

                switch (action) {
                    case "next":
                        if (state.phase === "LOBBY") {
                            state.phase = "STARTING";
                            state.phaseStartTime = Date.now();
                            state.currentQuestionIndex = 0;
                            state.userHasAnswered = false;
                            // Auto-advance to QUESTION_ACTIVE after countdown
                            setTimeout(
                                () =>
                                    setGameState((s) =>
                                        s?.phase === "STARTING"
                                            ? { ...s, phase: "QUESTION_ACTIVE", phaseStartTime: Date.now() }
                                            : s
                                    ),
                                3500
                            );
                        } else if (state.phase === "REVEAL_ANSWER" || state.phase === "LEADERBOARD") {
                            const nextIdx = state.currentQuestionIndex + 1;
                            if (nextIdx >= (state.questions?.length ?? 0)) {
                                state.phase = "FINISHED";
                            } else {
                                state.phase = "STARTING";
                                state.phaseStartTime = Date.now();
                                state.currentQuestionIndex = nextIdx;
                                state.currentRoundAnswers = {};
                                state.userHasAnswered = false;
                                state.roundResult = undefined;
                                setTimeout(
                                    () =>
                                        setGameState((s) =>
                                            s?.phase === "STARTING"
                                                ? { ...s, phase: "QUESTION_ACTIVE", phaseStartTime: Date.now() }
                                                : s
                                        ),
                                    3500
                                );
                            }
                        }
                        break;

                    case "reveal":
                        state.phase = "REVEAL_ANSWER";
                        if (state.currentRoundAnswers && state.questions) {
                            const currentQ = state.questions[state.currentQuestionIndex];
                            Object.entries(state.currentRoundAnswers).forEach(([pid, ans]) => {
                                if (ans.answerIndex === currentQ.correctAnswer) {
                                    const ratio = Math.min(1, ans.timeTakenMs / (state.timeLimitSeconds * 1000));
                                    const pts = Math.max(100, Math.round(1000 * (1 - ratio / 2)));
                                    ans.scoreEarned = pts;
                                    state.scores[pid] = (state.scores[pid] ?? 0) + pts;
                                    const pData = state.playerData?.find((p) => p.id === pid);
                                    if (pData) pData.score = state.scores[pid];
                                } else {
                                    ans.scoreEarned = 0;
                                }
                            });
                        }
                        break;

                    case "leaderboard":
                        state.phase = "LEADERBOARD";
                        break;

                    case "reset":
                        state.phase = "LOBBY";
                        state.currentQuestionIndex = -1;
                        state.scores = {};
                        state.currentRoundAnswers = {};
                        state.userHasAnswered = false;
                        state.roundResult = undefined;
                        state.playerData?.forEach((p) => { p.score = 0; });
                        break;

                    case "answer":
                        if (!payload?.id) break;
                        if (payload.id === "demo-user-123") state.userHasAnswered = true;
                        if (!state.currentRoundAnswers) state.currentRoundAnswers = {};
                        state.currentRoundAnswers[payload.id] = {
                            answerIndex: payload.answerIndex,
                            timeTakenMs: Date.now() - state.phaseStartTime,
                            scoreEarned: 0,
                            timestamp: Date.now(),
                        };
                        // Simulate bots answering shortly after
                        if (payload.id === "demo-user-123") {
                            setTimeout(() =>
                                setGameState((s) => {
                                    if (!s) return null;
                                    const bot = { ...s };
                                    if (!bot.currentRoundAnswers) bot.currentRoundAnswers = {};
                                    ["demo-bot-1", "demo-bot-2"].forEach((botId) => {
                                        if (!bot.currentRoundAnswers![botId]) {
                                            bot.currentRoundAnswers![botId] = {
                                                answerIndex: Math.floor(Math.random() * 4),
                                                timeTakenMs: Math.random() * 5000,
                                                scoreEarned: 0,
                                                timestamp: Date.now(),
                                            };
                                        }
                                    });
                                    return bot;
                                }), 1500);
                        }
                        break;
                }

                return state;
            });

            // Sync screen after state update (use timeout to read updated state)
            if (action !== "answer") {
                setTimeout(() =>
                    setGameState((s) => {
                        if (s) syncScreenWithPhase(s, sovereignModeRef.current);
                        return s;
                    }), 0);
            }
        },
        [syncScreenWithPhase]
    );

    // -------------------------------------------------------------------------
    // Discord auth
    // -------------------------------------------------------------------------

    const handleDiscordCallback = async (code: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API}/auth/discord`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, redirectUri: DISCORD_CONFIG.redirectUri }),
            });

            const data = await res.json();

            if (!res.ok) {
                const msg = data.error ?? "Authentication failed";
                setError(msg);
                toast.error(msg);
                return;
            }

            if (!data.isMember) {
                setError("Access Denied: Not a member of the required Citadel");
                toast.error("Access Denied: Not a member of the required Citadel");
                return;
            }

            setSessionId(data.sessionId);
            setUser(data.user);
            localStorage.setItem("guilty_guild_session_id", data.sessionId);
            localStorage.setItem("guilty_guild_user", JSON.stringify(data.user));
            window.history.replaceState({}, document.title, "/");
            toast.success(`Welcome, ${data.user.username}!`);
        } catch {
            setError("Failed to authenticate with Discord");
            toast.error("Failed to authenticate with Discord");
        } finally {
            setIsLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // Game connection
    // -------------------------------------------------------------------------

    const connectToTrial = useCallback(
        async (sid: string, manualPress = false) => {
            try {
                if (manualPress) setIsLoading(true);

                const res = await fetch(`${API}/game/connect`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Session-ID": sid },
                });

                const data = await res.json();

                if (res.ok) {
                    const { gameId: gid, gameState: gs } = data;
                    setGameId(gid);
                    setGameState(gs);
                    setScreen("waiting"); // will be overridden by syncScreenWithPhase below
                    const isHost = user?.id === gs.hostId || gs.hostId === (JSON.parse(localStorage.getItem("guilty_guild_user") ?? "{}").id);
                    const newSovereign = isHost;
                    setIsSovereignMode(newSovereign);
                    syncScreenWithPhase(gs, newSovereign);
                    if (manualPress) {
                        toast.success(newSovereign ? "You are the Weaver of this Trial" : "Connected to the Soul Sea");
                    }
                    return;
                }

                if (res.status === 401) {
                    handleLogout();
                    toast.error("Session expired. Please reconnect.");
                    return;
                }

                // 403 = game in progress, 404 = no game yet
                if (res.status === 403 || res.status === 404) {
                    setScreen("waiting");
                    if (manualPress) toast.info(data.error ?? "Awaiting the Weaver...");
                    return;
                }

                if (manualPress) toast.error(data.error ?? "Failed to connect to the Trial");
            } catch {
                if (manualPress) toast.error("Network error while connecting.");
            } finally {
                if (manualPress) setIsLoading(false);
            }
        },
        [user, syncScreenWithPhase, handleLogout]
    );

    // -------------------------------------------------------------------------
    // Waitlist polling – when on waiting screen, poll every 5 s
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (screen !== "waiting" || !sessionId || sessionId === "demo-session") return;

        const interval = setInterval(() => {
            connectToTrial(sessionId, false);
        }, 5000);

        return () => clearInterval(interval);
    }, [screen, sessionId, connectToTrial]);

    // -------------------------------------------------------------------------
    // Heartbeat fallback – poll every 30 s while in an active game
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (!gameId || !sessionId || sessionId === "demo-session" || gameId.startsWith("demo-")) return;
        if (gameState?.phase === "FINISHED") return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API}/game/${gameIdRef.current}`, {
                    headers: { "X-Session-ID": sessionIdRef.current ?? "" },
                });
                if (res.ok) {
                    const data = await res.json();
                    setGameState((prev) => {
                        if (JSON.stringify(data) === JSON.stringify(prev)) return prev;
                        syncScreenWithPhase(data, sovereignModeRef.current);
                        return data;
                    });
                } else if (res.status === 404) {
                    setGameId(null);
                    setGameState(null);
                    setScreen("waiting");
                    toast("The Weaver has ended the Trial.");
                }
            } catch {
                // silent – socket is the primary sync mechanism
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [gameId, sessionId, syncScreenWithPhase]);

    // -------------------------------------------------------------------------
    // Socket.io realtime sync
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (!gameId || !sessionId || sessionId === "demo-session" || gameId.startsWith("demo-")) return;

        const socket: Socket = io("http://localhost:3001");

        socket.on("connect", () => {
            // Authenticate the socket join so the server can send personalised state
            socket.emit("join_game", { gameId, sessionId });
        });

        socket.on("state_update", (payload: GameState) => {
            setGameState((prev) => {
                const questionChanged =
                    payload.currentQuestionIndex !== prev?.currentQuestionIndex;
                return {
                    ...payload,
                    // Preserve host-side data that the server doesn't send back on broadcast
                    questions: prev?.hostId === user?.id ? prev?.questions ?? payload.questions : payload.questions,
                    currentRoundAnswers: prev?.hostId === user?.id ? prev?.currentRoundAnswers ?? payload.currentRoundAnswers : payload.currentRoundAnswers,
                    playerData: prev?.playerData ?? payload.playerData,
                    // Reset per-round client state when question changes
                    userHasAnswered: questionChanged ? payload.userHasAnswered : (payload.userHasAnswered ?? prev?.userHasAnswered),
                    roundResult: questionChanged ? payload.roundResult : (payload.roundResult ?? prev?.roundResult),
                };
            });
            syncScreenWithPhase(payload, sovereignModeRef.current);
        });

        socket.on("player_answered", (payload: { userId: string; answeredCount: number; totalPlayers: number }) => {
            if (sovereignModeRef.current) {
                setGameState((prev) => {
                    if (!prev) return null;
                    // Stamp a placeholder so the answered count updates for the host
                    const updated = { ...(prev.currentRoundAnswers ?? {}) };
                    if (!updated[payload.userId]) {
                        updated[payload.userId] = {
                            answerIndex: -1,
                            timeTakenMs: 0,
                            scoreEarned: 0,
                            timestamp: Date.now(),
                        };
                    }
                    return { ...prev, currentRoundAnswers: updated };
                });
            }
        });

        socket.on("server_terminated", () => {
            handleLogout();
            window.location.reload();
        });

        return () => { socket.disconnect(); };
    }, [gameId, sessionId, user?.id, syncScreenWithPhase, handleLogout]);

    // -------------------------------------------------------------------------
    // Demo auto-advance (STARTING → QUESTION_ACTIVE)
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (!gameId?.startsWith("demo-") || !gameState || gameState.phase !== "STARTING") return;
        const timer = setTimeout(() =>
            setGameState((s) =>
                s?.phase === "STARTING"
                    ? { ...s, phase: "QUESTION_ACTIVE", phaseStartTime: Date.now() }
                    : s
            ), 3500);
        return () => clearTimeout(timer);
    }, [gameId, gameState?.phase]);

    // -------------------------------------------------------------------------
    // Host auto-advance: STARTING → QUESTION_ACTIVE after 3.5 s
    // ONE effect only to avoid double-firing.
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (!gameState || gameState.phase !== "STARTING") return;
        if (!user || user.id !== gameState.hostId) return;
        if (sessionId === "demo-session") return; // handled by demo effect above

        const elapsed = Date.now() - gameState.phaseStartTime;
        const delay = Math.max(0, 3500 - elapsed);

        const timer = setTimeout(() => {
            handleHostAction("next");
        }, delay);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState?.phase, gameState?.phaseStartTime, gameState?.hostId, user?.id, sessionId]);

    // -------------------------------------------------------------------------
    // Game actions
    // -------------------------------------------------------------------------

    /**
     * "Open Nightmare Gate" (no game yet) → POST /game/connect to create one.
     * "Begin The Trial" (game exists in LOBBY) → POST /game/:id/start.
     */
    const handleStartGame = async () => {
        if (sessionId === "demo-session") {
            handleDemoAction("next");
            toast.success("The Trial has begun (Demo)");
            return;
        }

        if (!sessionId) return;

        // Phase 1: No game yet – create one by connecting
        if (!gameId) {
            await connectToTrial(sessionId, true);
            return; // User will see LOBBY and can click "Begin Trial" next
        }

        // Phase 2: Game exists – start it
        if (!questions.length || isHostActionLoading) return;

        setIsHostActionLoading(true);
        try {
            const res = await fetch(`${API}/game/${gameId}/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Session-ID": sessionId },
                body: JSON.stringify({ questions, timeLimitSeconds }),
            });

            if (res.ok) {
                const data = await res.json();
                setGameState(data.gameState);
                toast.success("The Trial has begun!");
            } else {
                const err = await res.json();
                toast.error(err.error ?? "Failed to start game");
            }
        } catch {
            toast.error("Failed to start game");
        } finally {
            setIsHostActionLoading(false);
        }
    };

    const handleSubmitAnswer = async (answerIndex: number) => {
        if (sessionId === "demo-session" && user) {
            handleDemoAction("answer", { id: user.id, answerIndex });
            return;
        }

        if (!gameId || !sessionId || gameState?.userHasAnswered) return;

        // Optimistic update – prevent double-submit immediately
        setGameState((prev) => (prev ? { ...prev, userHasAnswered: true } : null));

        try {
            const res = await fetch(`${API}/game/${gameId}/answer`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Session-ID": sessionId },
                body: JSON.stringify({ answerIndex }),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error ?? "Failed to submit answer");
                // Revert on failure
                setGameState((prev) => (prev ? { ...prev, userHasAnswered: false } : null));
            }
        } catch {
            toast.error("Failed to submit answer");
            setGameState((prev) => (prev ? { ...prev, userHasAnswered: false } : null));
        }
    };

    const handleHostAction = async (action: "next" | "reveal" | "leaderboard" | "reset") => {
        if (sessionId === "demo-session") {
            handleDemoAction(action);
            return;
        }

        if (!gameId || !sessionId || isHostActionLoading) return;

        setIsHostActionLoading(true);
        try {
            const res = await fetch(`${API}/game/${gameId}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Session-ID": sessionId },
            });

            if (res.ok) {
                const data = await res.json();
                setGameState(data.gameState);
                syncScreenWithPhase(data.gameState, sovereignModeRef.current);
            } else {
                const err = await res.json();
                toast.error(err.error ?? `Failed to ${action}`);
            }
        } catch {
            toast.error(`Failed to ${action}`);
        } finally {
            setIsHostActionLoading(false);
        }
    };

    const handleForceReset = async () => {
        if (!sessionId) return;
        if (!confirm("⚠️ This will terminate the current game for EVERYONE. Are you sure?")) return;

        try {
            const res = await fetch(`${API}/debug/reset-server`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Session-ID": sessionId },
            });
            if (res.ok) {
                toast.success("Server reset. Reloading...");
                setTimeout(() => window.location.reload(), 1000);
            } else {
                const err = await res.json();
                toast.error(err.error ?? "Reset failed");
            }
        } catch {
            toast.error("Reset failed");
        }
    };

    const handleToggleMode = () => {
        const newMode = !isSovereignMode;
        setIsSovereignMode(newMode);
        if (gameState) {
            syncScreenWithPhase(gameState, newMode);
        } else if (!newMode) {
            setScreen("login");
        }
    };

    const handleManualJoin = () => {
        if (sessionId && sessionId !== "demo-session") {
            connectToTrial(sessionId, true);
        }
    };

    const handleEditGame = () => {
        setIsSovereignMode(true);
        setScreen("admin");
    };

    // -------------------------------------------------------------------------
    // Game stats for host panel
    // -------------------------------------------------------------------------

    const getGameStats = () => {
        if (!gameState) return null;
        const totalPlayers = gameState.playerData?.length ?? gameState.players?.length ?? 0;
        const answers = gameState.currentRoundAnswers ?? {};
        const answeredCount = Object.values(answers).filter((a) => a.answerIndex >= 0).length;

        let correct = 0, incorrect = 0;
        if (gameState.questions && gameState.currentQuestionIndex >= 0) {
            const currentQ = gameState.questions[gameState.currentQuestionIndex];
            Object.values(answers).forEach((ans) => {
                if (ans.answerIndex < 0) return;
                ans.answerIndex === currentQ.correctAnswer ? correct++ : incorrect++;
            });
        }
        return { totalPlayers, answered: answeredCount, correct, incorrect };
    };

    const handleTerminate = async () => {
        if (!sessionId) return;

        if (gameId?.startsWith("demo-")) {
            handleDemoAction("reset");
            toast.success("Demo Session Ended");
            setTimeout(() => window.location.reload(), 500);
            return;
        }

        try {
            await fetch(`${API}/debug/reset-server`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Session-ID": sessionId },
            });
            toast.success("Session Terminated – Reloading...");
            setTimeout(() => window.location.reload(), 1000);
        } catch {
            toast.error("Failed to terminate session");
        }
    };

    // Dev console helper
    useEffect(() => {
        if (import.meta.env.DEV && user && ALLOWED_HOSTS.includes(user.id)) {
            (window as any).nukeServer = () => {
                handleTerminate();
                return "Terminating active game...";
            };
            console.info("🛠 Dev tool: nukeServer() available in console.");
        }
        return () => { delete (window as any).nukeServer; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, sessionId]);

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    return (
        <div className="min-h-screen bg-[#050505] text-[#e2e8f0] font-sans selection:bg-[#00C2FF]/30">

            {/* Login screen */}
            {screen === "login" && (
                <>
                    <NightmareGate
                        onLogin={handleDiscordCallback}
                        error={error}
                        isLoading={isLoading}
                        onDemoMode={import.meta.env.DEV ? handleDemoLogin : undefined}
                        user={user}
                        onJoin={handleManualJoin}
                        onEditGame={user && ALLOWED_HOSTS.includes(user.id) ? handleEditGame : undefined}
                    />
                    <Toaster position="top-center" theme="dark" />
                </>
            )}

            {/* Waiting for game to open */}
            {screen === "waiting" && (
                <>
                    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4">
                        <MysticBackground />

                        <div className="relative z-10 max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-1000">
                            <div className="relative w-24 h-24 mx-auto">
                                <div className="absolute inset-0 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin" />
                                <div className="absolute inset-2 border-2 border-[#00C2FF]/20 border-b-[#00C2FF] rounded-full animate-[spin_0.7s_linear_infinite_reverse]" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-[#FFD700] rounded-full animate-pulse shadow-[0_0_15px_#FFD700]" />
                                </div>
                            </div>

                            <div>
                                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#B8860B] tracking-[0.2em] uppercase mb-4 font-serif">
                                    Awaiting the Weaver
                                </h2>
                                <p className="text-[#00C2FF] text-sm tracking-widest font-mono opacity-80 uppercase">
                                    Your fate is being woven...
                                </p>
                            </div>

                            <p className="text-[#6b7280] text-xs max-w-xs mx-auto leading-relaxed border-t border-[#333] pt-4">
                                In the Soul Sea. You will automatically ascend when the Trial begins.
                            </p>

                            {user && (
                                <button
                                    onClick={handleLogout}
                                    className="text-[#6b7280] hover:text-[#FFD700] text-xs underline underline-offset-2 transition-colors"
                                >
                                    Disconnect Soul
                                </button>
                            )}
                        </div>
                    </div>
                    <Toaster position="top-center" theme="dark" />
                </>
            )}

            {/* Lobby */}
            {screen === "lobby" && (
                <>
                    <SoulSea
                        players={gameState?.playerData ?? []}
                        isHost={user?.id === gameState?.hostId}
                        onStartGame={handleStartGame}
                        isLoading={isLoading || isHostActionLoading}
                        isAllowedHost={!!(user?.id && ALLOWED_HOSTS.includes(user.id))}
                        onForceReset={handleForceReset}
                        onLogout={handleLogout}
                        onEditGame={handleEditGame}
                    />
                    <Toaster position="top-center" theme="dark" />
                </>
            )}

            {/* Host admin panel (Weaver's Loom) */}
            {screen === "admin" && isSovereignMode && (
                <>
                    <WeaversLoom
                        isSovereignMode={isSovereignMode}
                        onToggleMode={handleToggleMode}
                        questions={questions}
                        onUpdateQuestions={setQuestions}
                        onStartGame={handleStartGame}
                        onNextQuestion={() => handleHostAction("next")}
                        onRevealArgs={() => handleHostAction("reveal")}
                        onLeaderboardArgs={() => handleHostAction("leaderboard")}
                        onTerminate={handleTerminate}
                        gameStats={getGameStats()}
                        currentQuestionIndex={gameState?.currentQuestionIndex ?? -1}
                        gameStatus={!gameId ? "OFFLINE" : (gameState?.phase ?? "LOBBY")}
                        sessionId={sessionId}
                        projectId={projectId}
                        publicAnonKey={publicAnonKey}
                        timeLimitSeconds={timeLimitSeconds}
                        onUpdateTimeLimit={setTimeLimitSeconds}
                        isActionLoading={isHostActionLoading}
                    />
                    <Toaster position="top-center" theme="dark" />
                </>
            )}

            {/* Quiz / question view */}
            {screen === "quiz" && gameState && (
                <>
                    <TheTrial
                        phase={gameState.phase}
                        question={
                            gameState.questions
                                ? gameState.questions[gameState.currentQuestionIndex]
                                : gameState.currentQuestion
                        }
                        questionNumber={gameState.currentQuestionIndex + 1}
                        totalQuestions={
                            gameState.questions?.length ??
                            gameState.totalQuestions ??
                            99
                        }
                        timeLimit={gameState.timeLimitSeconds}
                        phaseStartTime={gameState.phaseStartTime}
                        onAnswer={handleSubmitAnswer}
                        hasAnswered={!!gameState.userHasAnswered}
                        roundResult={gameState.roundResult}
                        score={user ? (gameState.scores?.[user.id] ?? 0) : 0}
                        rank={
                            user
                                ? Object.entries(gameState.scores ?? {})
                                    .sort(([, a], [, b]) => b - a)
                                    .findIndex(([id]) => id === user.id) + 1
                                : 0
                        }
                    />
                    {/* Quick access to Weaver's Loom for the host */}
                    {user?.id === gameState.hostId && (
                        <div className="fixed top-4 right-4 z-50">
                            <button
                                onClick={handleToggleMode}
                                className="bg-[#FFD700] text-[#050505] px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#cc9900] transition-colors shadow-lg"
                            >
                                Weaver's Loom
                            </button>
                        </div>
                    )}
                    <Toaster position="top-center" theme="dark" />
                </>
            )}

            {/* Leaderboard */}
            {screen === "leaderboard" && gameState && (
                <>
                    <Ascension
                        players={gameState.playerData ?? []}
                        isHost={user?.id === gameState.hostId}
                        onPlayAgain={() => {
                            if (sessionId === "demo-session") {
                                handleDemoAction("reset");
                            } else {
                                handleHostAction("reset");
                            }
                        }}
                    />
                    <Toaster position="top-center" theme="dark" />
                </>
            )}

            {/* Fallback loading */}
            {!screen && (
                <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                    <div className="text-[#00C2FF] text-center">
                        <div className="animate-spin w-12 h-12 border-4 border-[#00C2FF] border-t-transparent rounded-full mx-auto mb-4" />
                        <p>Loading the Spell...</p>
                    </div>
                    <Toaster position="top-center" theme="dark" />
                </div>
            )}
        </div>
    );
}
