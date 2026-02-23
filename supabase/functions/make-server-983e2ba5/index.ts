import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.ts";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
    "/*",
    cors({
        origin: "*",
        allowHeaders: ["Content-Type", "Authorization", "X-Session-ID"],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
    }),
);

const REQUIRED_SERVER_ID = "982182985862377522";

// --- Type Definitions ---

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
    correctAnswer: number;
}

interface GameState {
    id: string;
    hostId: string;
    phase: GamePhase;

    // The full question set (ONLY visible to Host)
    questions: Question[];
    currentQuestionIndex: number;

    // Timing
    phaseStartTime: number;
    timeLimitSeconds: number;

    // Player Data
    players: string[];
    scores: Record<string, number>;

    // Round Data
    currentRoundAnswers: Record<string, {
        answerIndex: number;
        timeTakenMs: number;
        scoreEarned: number; // Calculated but not necessarily revealed yet
        timestamp: number;
    }>;

    createdAt: number;
}

// --- Sanitization Helper ---

function sanitizeGameState(game: GameState, userId: string): any {
    const isHost = game.hostId === userId;

    if (isHost) {
        return game;
    }

    // Basic public state
    const sanitized: any = {
        id: game.id,
        phase: game.phase,
        hostId: game.hostId,
        currentQuestionIndex: game.currentQuestionIndex,
        phaseStartTime: game.phaseStartTime,
        timeLimitSeconds: game.timeLimitSeconds,
        players: game.players,
        // Start with scores hidden or limited if needed, for now sending all scores is okay for leaderboard/lobby
        scores: game.scores,
    };

    // Logic for Questions & Answers
    const currentQuestion = game.questions[game.currentQuestionIndex];

    // 1. Inject Reconnection Flag
    const myAnswer = game.currentRoundAnswers?.[userId];
    if (myAnswer) {
        sanitized.userHasAnswered = true;
    }

    // 2. Handle Phase Visibility
    if (game.phase === 'QUESTION_ACTIVE' || game.phase === 'QUESTION_READ' || game.phase === 'WAITING_FOR_HOST') {
        if (currentQuestion) {
            sanitized.currentQuestion = {
                text: currentQuestion.text,
                answers: currentQuestion.answers,
                // correctAnswer is STRIPPED
            };
        }
    } else if (game.phase === 'REVEAL_ANSWER') {
        if (currentQuestion) {
            sanitized.currentQuestion = currentQuestion; // Full question with answer
        }
        // Include the user's result for this round
        if (myAnswer) {
            sanitized.roundResult = {
                answerIndex: myAnswer.answerIndex,
                scoreEarned: myAnswer.scoreEarned,
                isCorrect: myAnswer.scoreEarned > 0 // Heuristic, or check index match
            };
        }
    }

    return sanitized;
}

// --- SECRETS & CONFIG ---
const DISCORD_CLIENT_ID = "1448157938245173282";
const DISCORD_CLIENT_SECRET = "XDXFTl_CoScAQabhr_A7ghvL8THVEi_-";
const DISCORD_REDIRECT_URI = "https://guiltyguild.com/api/auth/callback/discord";
const SESSION_SECRET = "shadow_slave_super_secret_key_987654321";

// --- Auth Endpoints ---

app.get("/make-server-983e2ba5/config/discord", (c) => {
    return c.json({ clientId: DISCORD_CLIENT_ID });
});

app.post("/make-server-983e2ba5/auth/discord", async (c) => {
    try {
        const { code, redirectUri: clientRedirectUri } = await c.req.json();
        if (!code) return c.json({ error: "No code provided" }, 400);

        const clientId = DISCORD_CLIENT_ID;
        const clientSecret = DISCORD_CLIENT_SECRET;
        const redirectUri = clientRedirectUri || DISCORD_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            return c.json({ error: "Server misconfigured" }, 500);
        }

        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("Discord Token Error:", errorText);
            return c.json({
                error: "Token exchange failed: " + errorText,
                debug: {
                    redirectUri: redirectUri,
                    clientId: clientId,
                    // clientSecret is omitted for security
                }
            }, 400);
        }
        const { access_token } = await tokenResponse.json();

        const [userRes, guildsRes] = await Promise.all([
            fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${access_token}` } }),
            fetch("https://discord.com/api/users/@me/guilds", { headers: { Authorization: `Bearer ${access_token}` } })
        ]);

        if (!userRes.ok || !guildsRes.ok) return c.json({ error: "Failed to fetch Discord data" }, 400);

        const user = await userRes.json();
        const guilds = await guildsRes.json();
        const isMember = guilds.some((g: any) => g.id === REQUIRED_SERVER_ID);

        if (!isMember) return c.json({ error: "Not a member of the required server", isMember: false }, 403);

        const sessionId = crypto.randomUUID();
        await kv.set(`session:${sessionId}`, {
            userId: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.avatar,
            createdAt: Date.now(),
        });

        return c.json({
            sessionId,
            user: { id: user.id, username: user.username, avatar: user.avatar },
            isMember: true
        });
    } catch (err) {
        console.error(err);
        return c.json({ error: "Auth failed" }, 500);
    }
});

// Verify session
app.get("/make-server-983e2ba5/auth/verify", async (c) => {
    try {
        const sessionId = c.req.header("X-Session-ID");

        if (!sessionId) {
            return c.json({ error: "No session ID provided" }, 401);
        }

        const session = await kv.get(`session:${sessionId}`);

        if (!session) {
            return c.json({ error: "Invalid or expired session" }, 401);
        }

        return c.json({ user: session });
    } catch (error) {
        console.log("Session verification error:", error);
        return c.json({ error: "Internal server error during verification" }, 500);
    }
});

// --- Game Logic Endpoints ---

const ALLOWED_HOSTS = [
    "894118872712613898",
    "339513008835395587",
    "1125935493029310595",
    "525421911220682772"
];

// Create Game
app.post("/make-server-983e2ba5/game/create", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    if (!sessionId) return c.json({ error: "Unauthorized" }, 401);
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    // Security: Host Whitelist Check
    if (!ALLOWED_HOSTS.includes(session.userId)) {
        return c.json({ error: "Access Denied: You are not authorized to host trials." }, 403);
    }

    const gameId = crypto.randomUUID();
    const gameState: GameState = {
        id: gameId,
        hostId: session.userId,
        phase: 'LOBBY',
        questions: [],
        currentQuestionIndex: -1,
        phaseStartTime: Date.now(),
        timeLimitSeconds: 30, // Default
        players: [session.userId],
        scores: { [session.userId]: 0 },
        currentRoundAnswers: {},
        createdAt: Date.now(),
    };

    await kv.set(`game:${gameId}`, gameState);
    await kv.set(`activeGame`, gameId);
    return c.json({ gameId, gameState });
});

// Join Game
app.post("/make-server-983e2ba5/game/join", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const activeGameId = await kv.get(`activeGame`);
    if (!activeGameId) return c.json({ error: "No active game" }, 404);

    const game = await kv.get(`game:${activeGameId}`);
    if (!game) return c.json({ error: "Game not found" }, 404);

    if (game.phase !== 'LOBBY') {
        // Allow re-joining if already a player? Or block?
        // For now, if not in players list, block.
        if (!game.players.includes(session.userId)) {
            return c.json({ error: "Game locked" }, 403);
        }
    }

    if (!game.players.includes(session.userId)) {
        game.players.push(session.userId);
        game.scores[session.userId] = 0;
        await kv.set(`game:${activeGameId}`, game);
    }

    return c.json({ gameId: activeGameId, gameState: sanitizeGameState(game, session.userId) });
});

// GET Game
app.get("/make-server-983e2ba5/game/:gameId", async (c) => {
    const gameId = c.req.param("gameId");
    const sessionId = c.req.header("X-Session-ID");

    // We need session to know who is asking
    if (!sessionId) return c.json({ error: "Unauthorized" }, 401);
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Invalid session" }, 401);

    const game = await kv.get(`game:${gameId}`);
    if (!game) return c.json({ error: "Game not found" }, 404);

    // Hydrate player data for display
    const playerData = await Promise.all(
        game.players.map(async (pid: string) => {
            // Inefficient but functional for MVP
            // Optimally, store player profile cache
            const sessions = await kv.getByPrefix("session:");
            const s = sessions.find((s: any) => s.userId === pid);
            return {
                id: pid,
                username: s?.username || "Unknown",
                avatar: s?.avatar,
                score: game.scores[pid] || 0
            };
        })
    );

    const sanitized = sanitizeGameState(game, session.userId);
    sanitized.playerData = playerData;

    return c.json(sanitized);
});

// POST /start
app.post("/make-server-983e2ba5/game/:gameId/start", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    const gameId = c.req.param("gameId");
    const game = await kv.get(`game:${gameId}`);

    if (!game || game.hostId !== session.userId) return c.json({ error: "Forbidden" }, 403);

    const { questions, timeLimitSeconds } = await c.req.json();
    if (questions) game.questions = questions; // Update questions if provided
    if (timeLimitSeconds) game.timeLimitSeconds = timeLimitSeconds; // Update time limit if provided

    game.phase = 'STARTING';
    game.phaseStartTime = Date.now();
    game.currentQuestionIndex = 0; // Prepare first question

    await kv.set(`game:${gameId}`, game);
    return c.json({ success: true, gameState: game });
});

// POST /next -> Transition for Host
app.post("/make-server-983e2ba5/game/:gameId/next", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    const gameId = c.req.param("gameId");
    const game = await kv.get(`game:${gameId}`);

    if (!game || game.hostId !== session.userId) return c.json({ error: "Forbidden" }, 403);

    // If currently STARTING, move to ACTIVE
    if (game.phase === 'STARTING') {
        game.phase = 'QUESTION_ACTIVE';
        game.phaseStartTime = Date.now();
        game.currentRoundAnswers = {}; // Reset answers
    }
    // If currently REVEAL or LEADERBOARD, move to next question or STARTING for next q
    else if (game.phase === 'REVEAL_ANSWER' || game.phase === 'LEADERBOARD') {
        const nextIdx = game.currentQuestionIndex + 1;
        if (nextIdx >= game.questions.length) {
            game.phase = 'FINISHED';
        } else {
            game.currentQuestionIndex = nextIdx;
            game.phase = 'QUESTION_ACTIVE'; // Or QUESTION_READ if you want a read phase
            game.phaseStartTime = Date.now();
            game.currentRoundAnswers = {};
        }
    }

    await kv.set(`game:${gameId}`, game);
    return c.json({ success: true, gameState: game });
});

// POST /answer
app.post("/make-server-983e2ba5/game/:gameId/answer", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const gameId = c.req.param("gameId");
    const game = await kv.get(`game:${gameId}`);
    if (!game) return c.json({ error: "Game not found" }, 404);

    // 1. Phase Check
    if (game.phase !== 'QUESTION_ACTIVE') {
        return c.json({ error: "Phase is not active" }, 400);
    }

    // 2. Duplicate Check
    // Initialize currentRoundAnswers if missing (migration safety or new round)
    if (!game.currentRoundAnswers) game.currentRoundAnswers = {};

    if (game.currentRoundAnswers[session.userId]) {
        return c.json({ error: "Already answered" }, 400);
    }

    // 3. Timing Check (Latency Buffer 2s)
    const elapsedTime = Date.now() - game.phaseStartTime;
    if (elapsedTime > (game.timeLimitSeconds * 1000 + 2000)) {
        return c.json({ error: "Time expired" }, 400);
    }

    // 4. Bounds Check
    const { answerIndex } = await c.req.json();
    const currentQ = game.questions[game.currentQuestionIndex];
    if (answerIndex < 0 || answerIndex >= currentQ.answers.length) {
        return c.json({ error: "Invalid answer index" }, 400);
    }

    // Store Answer (No scoring yet!)
    game.currentRoundAnswers[session.userId] = {
        answerIndex,
        timeTakenMs: elapsedTime,
        scoreEarned: 0, // Placeholder
        timestamp: Date.now()
    };

    await kv.set(`game:${gameId}`, game);
    return c.json({ status: "received" });
});

// POST /reveal
app.post("/make-server-983e2ba5/game/:gameId/reveal", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    const gameId = c.req.param("gameId");
    const game = await kv.get(`game:${gameId}`);

    if (!game || game.hostId !== session.userId) return c.json({ error: "Forbidden" }, 403);

    // Only allow reveal if currently ACTIVE or WAITING (or STARTING/READ if skipped)
    // Just proceed to calculate for whoever answered
    const currentQ = game.questions[game.currentQuestionIndex];

    // Calculate Scores
    if (game.currentRoundAnswers) {
        for (const [userId, record] of Object.entries(game.currentRoundAnswers)) {
            const isCorrect = record.answerIndex === currentQ.correctAnswer;

            if (isCorrect) {
                // Score = 1000 * (1 - (Time / Limit) / 2)
                const ratio = record.timeTakenMs / (game.timeLimitSeconds * 1000);
                // Clamp ratio to 0-1 just in case
                const clampedRatio = Math.max(0, Math.min(ratio, 1));
                const points = Math.round(1000 * (1 - clampedRatio / 2));
                record.scoreEarned = points;

                game.scores[userId] = (game.scores[userId] || 0) + points;
            } else {
                record.scoreEarned = 0;
            }
        }
    }

    game.phase = 'REVEAL_ANSWER';
    await kv.set(`game:${gameId}`, game);
    return c.json({ success: true, gameState: game });
});

// POST /leaderboard
app.post("/make-server-983e2ba5/game/:gameId/leaderboard", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    const gameId = c.req.param("gameId");
    const game = await kv.get(`game:${gameId}`);

    if (!game || game.hostId !== session.userId) return c.json({ error: "Forbidden" }, 403);

    game.phase = 'LEADERBOARD';
    await kv.set(`game:${gameId}`, game);
    return c.json({ success: true, gameState: game });
});

// POST /reset -> Reset to Lobby for new game
app.post("/make-server-983e2ba5/game/:gameId/reset", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    const gameId = c.req.param("gameId");
    const game = await kv.get(`game:${gameId}`);

    if (!game || game.hostId !== session.userId) return c.json({ error: "Forbidden" }, 403);

    // Reset Game State
    game.phase = 'LOBBY';
    game.currentQuestionIndex = -1;
    game.questions = []; // Clear questions
    game.currentRoundAnswers = {};
    game.scores = {}; // Reset scores for fresh game
    // Players remain in the list so they don't have to rejoin
    // Re-initialize scores for existing players
    game.players.forEach(pid => {
        game.scores[pid] = 0;
    });
    game.phaseStartTime = Date.now();

    await kv.set(`game:${gameId}`, game);
    return c.json({ success: true, gameState: game });
});

// Debug: Force Clear Active Game
app.post("/make-server-983e2ba5/debug/reset-server", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    // Only allowed hosts can nuke the server state
    if (!ALLOWED_HOSTS.includes(session.userId)) {
        return c.json({ error: "Forbidden" }, 403);
    }

    await kv.del(`activeGame`);
    return c.json({ success: true, message: "Server active game cleared." });
});

// --- Quiz Template Management ---

interface QuizTemplate {
    id: string;
    name: string;
    description: string;
    questions: Question[];
    timeLimitSeconds: number;
    createdAt: number;
    createdBy: string;
}

// Create Quiz Template
app.post("/make-server-983e2ba5/quiz/create", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    // Only allowed hosts can create quizzes
    if (!ALLOWED_HOSTS.includes(session.userId)) {
        return c.json({ error: "Access Denied" }, 403);
    }

    const { name, description, questions, timeLimitSeconds } = await c.req.json();

    if (!name || !questions || questions.length === 0) {
        return c.json({ error: "Name and questions are required" }, 400);
    }

    const quizId = crypto.randomUUID();
    const quiz: QuizTemplate = {
        id: quizId,
        name,
        description: description || "",
        questions,
        timeLimitSeconds: timeLimitSeconds || 30,
        createdAt: Date.now(),
        createdBy: session.userId,
    };

    await kv.set(`quiz:${quizId}`, quiz);
    return c.json({ success: true, quiz });
});

// List All Quiz Templates
app.get("/make-server-983e2ba5/quiz/list", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    // Only allowed hosts can list quizzes
    if (!ALLOWED_HOSTS.includes(session.userId)) {
        return c.json({ error: "Access Denied" }, 403);
    }

    const quizzes = await kv.getByPrefix("quiz:");

    // Return summary list (without full questions for performance)
    const summaries = quizzes.map((q: QuizTemplate) => ({
        id: q.id,
        name: q.name,
        description: q.description,
        questionCount: q.questions?.length || 0,
        timeLimitSeconds: q.timeLimitSeconds,
        createdAt: q.createdAt,
    }));

    return c.json({ quizzes: summaries });
});

// Get Single Quiz
app.get("/make-server-983e2ba5/quiz/:quizId", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    if (!ALLOWED_HOSTS.includes(session.userId)) {
        return c.json({ error: "Access Denied" }, 403);
    }

    const quizId = c.req.param("quizId");
    const quiz = await kv.get(`quiz:${quizId}`);

    if (!quiz) return c.json({ error: "Quiz not found" }, 404);

    return c.json({ quiz });
});

// Update Quiz
app.put("/make-server-983e2ba5/quiz/:quizId", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    if (!ALLOWED_HOSTS.includes(session.userId)) {
        return c.json({ error: "Access Denied" }, 403);
    }

    const quizId = c.req.param("quizId");
    const quiz = await kv.get(`quiz:${quizId}`);

    if (!quiz) return c.json({ error: "Quiz not found" }, 404);

    const { name, description, questions, timeLimitSeconds } = await c.req.json();

    if (name) quiz.name = name;
    if (description !== undefined) quiz.description = description;
    if (questions) quiz.questions = questions;
    if (timeLimitSeconds) quiz.timeLimitSeconds = timeLimitSeconds;

    await kv.set(`quiz:${quizId}`, quiz);
    return c.json({ success: true, quiz });
});

// Delete Quiz
app.delete("/make-server-983e2ba5/quiz/:quizId", async (c) => {
    const sessionId = c.req.header("X-Session-ID");
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    if (!ALLOWED_HOSTS.includes(session.userId)) {
        return c.json({ error: "Access Denied" }, 403);
    }

    const quizId = c.req.param("quizId");
    const quiz = await kv.get(`quiz:${quizId}`);

    if (!quiz) return c.json({ error: "Quiz not found" }, 404);

    await kv.del(`quiz:${quizId}`);
    return c.json({ success: true, message: "Quiz deleted" });
});

// Health check endpoint
app.get("/make-server-983e2ba5/health", (c) => {
    return c.json({ status: "ok" });
});


Deno.serve(app.fetch);
