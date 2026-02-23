import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import * as kv from "./db";

dotenv.config();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GamePhase =
    | 'LOBBY'
    | 'STARTING'
    | 'QUESTION_ACTIVE'
    | 'QUESTION_READ'
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
    questions: Question[];
    currentQuestionIndex: number;
    phaseStartTime: number;
    timeLimitSeconds: number;
    players: string[];
    scores: Record<string, number>;
    currentRoundAnswers: Record<string, {
        answerIndex: number;
        timeTakenMs: number;
        scoreEarned: number;
        timestamp: number;
    }>;
    createdAt: number;
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const app = express();
const httpServer = createServer(app);

// Allow AutoSSL domain validation (Namecheap places txt files in this directory)
// We serve it statically so Namecheap's Sectigo validation bots can read the file to issue the cert.
import path from "path";
app.use('/.well-known', express.static(path.join(__dirname, '../../public_html/api/.well-known')));
// As a fallback for different folder structures:
app.use('/.well-known', express.static(path.join(__dirname, '../.well-known')));

// Restrict origins to known frontend URLs; override via ALLOWED_ORIGINS env var.
const ALLOWED_ORIGINS: string[] = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "https://guiltyguild.com", "https://www.guiltyguild.com"];

const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: "64kb" })); // Reject oversized bodies

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIRED_SERVER_ID = "982182985862377522";

const DISCORD_CLIENT_ID =
    process.env.DISCORD_CLIENT_ID || "1448157938245173282";

const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
if (!DISCORD_CLIENT_SECRET) {
    console.warn("⚠  DISCORD_CLIENT_SECRET is not set. Discord OAuth will fail.");
}

const ALLOWED_HOSTS: readonly string[] = [
    "894118872712613898",
    "339513008835395587",
    "1125935493029310595",
    "525421911220682772",
    "1474209423378481194",
];

// ---------------------------------------------------------------------------
// Socket user tracking  (socketId → { userId, gameId })
// Enables personalized per-player state broadcasts.
// ---------------------------------------------------------------------------

const socketUsers = new Map<string, { userId: string; gameId: string }>();

function findSocketByUserId(userId: string, gameId: string): ReturnType<typeof io.sockets.sockets.get> {
    for (const [socketId, info] of socketUsers.entries()) {
        if (info.userId === userId && info.gameId === gameId) {
            return io.sockets.sockets.get(socketId);
        }
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getSession(req: express.Request): Promise<any | null> {
    const sessionId = req.header("X-Session-ID");
    if (!sessionId) return null;
    return kv.get(`session:${sessionId}`);
}

// ---------------------------------------------------------------------------
// Game state sanitisation
// Host sees the full state.
// Players only see what they need (no correctAnswers during active phase,
// no other players' answers, but their own result on reveal).
// ---------------------------------------------------------------------------

function sanitizeGameState(game: GameState, userId: string): object {
    const isHost = game.hostId === userId;
    if (isHost) return { ...game };

    const currentQuestion = game.questions[game.currentQuestionIndex];
    const myAnswer = game.currentRoundAnswers?.[userId];

    const base: Record<string, any> = {
        id: game.id,
        phase: game.phase,
        hostId: game.hostId,
        currentQuestionIndex: game.currentQuestionIndex,
        phaseStartTime: game.phaseStartTime,
        timeLimitSeconds: game.timeLimitSeconds,
        players: game.players,
        scores: game.scores,
        userHasAnswered: !!myAnswer,
        totalQuestions: game.questions.length,
    };

    if (
        game.phase === 'QUESTION_ACTIVE' ||
        game.phase === 'QUESTION_READ' ||
        game.phase === 'WAITING_FOR_HOST' ||
        game.phase === 'STARTING'
    ) {
        if (currentQuestion) {
            base.currentQuestion = {
                text: currentQuestion.text,
                answers: currentQuestion.answers,
                // correctAnswer deliberately omitted for players
            };
        }
    } else if (game.phase === 'REVEAL_ANSWER') {
        if (currentQuestion) base.currentQuestion = currentQuestion; // correctAnswer exposed on reveal
        if (myAnswer) {
            base.roundResult = {
                answerIndex: myAnswer.answerIndex,
                scoreEarned: myAnswer.scoreEarned,
                isCorrect: myAnswer.answerIndex === currentQuestion?.correctAnswer,
            };
        }
    }

    return base;
}

// ---------------------------------------------------------------------------
// Personalised broadcast
// Iterates every socket in the game room and sends each its own view.
// ---------------------------------------------------------------------------

async function broadcastToGame(gameId: string, game: GameState): Promise<void> {
    try {
        const room = io.sockets.adapter.rooms.get(`game:${gameId}`);
        if (!room) return;

        const playerData = await buildPlayerData(game);

        for (const socketId of room) {
            const info = socketUsers.get(socketId);
            const socket = io.sockets.sockets.get(socketId);
            if (!socket) continue;

            const userId = info?.userId ?? 'ANONYMOUS';
            const sanitized = sanitizeGameState(game, userId) as any;
            sanitized.playerData = playerData;
            socket.emit('state_update', sanitized);
        }
    } catch (err) {
        console.error("broadcastToGame error:", err);
    }
}

// ---------------------------------------------------------------------------
// Efficient player data (O(n) – load sessions once, map by userId)
// ---------------------------------------------------------------------------

async function buildPlayerData(game: GameState): Promise<any[]> {
    const allSessions = await kv.getByPrefix("session:");
    const sessionMap = new Map<string, any>();
    for (const s of allSessions) {
        if (s?.userId) sessionMap.set(s.userId, s);
    }
    return game.players.map((pid) => {
        const s = sessionMap.get(pid);
        return {
            id: pid,
            username: s?.username ?? "Unknown",
            avatar: s?.avatar ?? null,
            score: game.scores[pid] ?? 0,
        };
    });
}

// ---------------------------------------------------------------------------
// Socket.io connection handling
// ---------------------------------------------------------------------------

io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on("join_game", async (payload: { gameId: string; sessionId: string }) => {
        const { gameId, sessionId } = payload ?? {};
        if (!gameId || !sessionId) return;

        const session = await kv.get(`session:${sessionId}`);
        if (!session) {
            console.warn(`[Socket] join_game rejected – invalid session (${socket.id})`);
            return;
        }

        socket.join(`game:${gameId}`);
        socketUsers.set(socket.id, { userId: session.userId, gameId });
        console.log(`[Socket] ${socket.id} (${session.username}) joined game:${gameId}`);

        // Immediately push current state to the newly-joined socket.
        const game: GameState | null = await kv.get(`game:${gameId}`);
        if (game) {
            const playerData = await buildPlayerData(game);
            const sanitized = sanitizeGameState(game, session.userId) as any;
            sanitized.playerData = playerData;
            socket.emit('state_update', sanitized);
        }
    });

    socket.on("disconnect", () => {
        socketUsers.delete(socket.id);
        console.log(`[Socket] Disconnected: ${socket.id}`);
    });
});

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

app.get("/make-server-983e2ba5/config/discord", (_req, res) => {
    res.json({
        clientId: DISCORD_CLIENT_ID,
        redirectUri: process.env.DISCORD_REDIRECT_URI ?? "http://localhost:5173",
    });
});

app.post("/make-server-983e2ba5/auth/discord", async (req, res) => {
    try {
        const { code, redirectUri: clientRedirectUri } = req.body ?? {};

        if (!code || typeof code !== "string" || code.length > 200) {
            return res.status(400).json({ error: "Invalid code" });
        }

        const secret = DISCORD_CLIENT_SECRET;
        if (!secret) return res.status(500).json({ error: "Server misconfiguration" });

        const redirectUri = typeof clientRedirectUri === "string" && clientRedirectUri
            ? clientRedirectUri
            : "http://localhost:5173";

        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: secret,
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenRes.ok) {
            const txt = await tokenRes.text();
            console.error("[Auth] Token exchange failed:", txt);
            return res.status(400).json({ error: "Discord authentication failed" });
        }

        const { access_token } = (await tokenRes.json()) as { access_token?: string };
        if (!access_token) return res.status(400).json({ error: "No access token" });

        const [userRes, guildsRes] = await Promise.all([
            fetch("https://discord.com/api/users/@me", {
                headers: { Authorization: `Bearer ${access_token}` },
            }),
            fetch("https://discord.com/api/users/@me/guilds", {
                headers: { Authorization: `Bearer ${access_token}` },
            }),
        ]);

        if (!userRes.ok || !guildsRes.ok) {
            return res.status(400).json({ error: "Failed to fetch Discord profile" });
        }

        const user = (await userRes.json()) as any;
        const guilds = (await guildsRes.json()) as any[];

        const isMember =
            Array.isArray(guilds) && guilds.some((g: any) => g.id === REQUIRED_SERVER_ID);

        if (!isMember) {
            return res
                .status(403)
                .json({ error: "Not a member of the required server", isMember: false });
        }

        const sessionId = crypto.randomUUID();
        await kv.set(`session:${sessionId}`, {
            userId: user.id,
            username: user.username,
            avatar: user.avatar ?? null,
            createdAt: Date.now(),
        });

        return res.json({
            sessionId,
            user: { id: user.id, username: user.username, avatar: user.avatar ?? null },
            isMember: true,
        });
    } catch (err) {
        console.error("[Auth] Unexpected error:", err);
        return res.status(500).json({ error: "Authentication failed" });
    }
});

app.get("/make-server-983e2ba5/auth/verify", async (req, res) => {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: "Invalid or expired session" });
    return res.json({
        user: { id: session.userId, username: session.username, avatar: session.avatar },
    });
});

// ---------------------------------------------------------------------------
// Game endpoints
// ---------------------------------------------------------------------------

/**
 * POST /game/connect
 *
 * For hosts   → creates a new game (if none exists) and returns it.
 * For players → joins an existing LOBBY game, or reconnects to an in-progress game.
 *
 * Returns:
 *   200 { gameId, gameState }  – joined / created
 *   401                         – bad session
 *   403                         – game in progress, not a player
 *   404                         – no active game and caller is not a host
 */
app.post("/make-server-983e2ba5/game/connect", async (req, res) => {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const activeGameId: string | null = await kv.get("activeGame");

    if (activeGameId) {
        const game: GameState | null = await kv.get(`game:${activeGameId}`);

        if (game && game.phase !== 'FINISHED') {
            if (game.phase !== 'LOBBY') {
                // Game is in progress – reconnect existing players only.
                if (game.players.includes(session.userId)) {
                    const playerData = await buildPlayerData(game);
                    const sanitized: any = sanitizeGameState(game, session.userId);
                    sanitized.playerData = playerData;
                    return res.json({ gameId: activeGameId, gameState: sanitized });
                }
                return res.status(403).json({ error: "Trial is in progress. You cannot join now." });
            }

            // LOBBY – join if not already in.
            if (!game.players.includes(session.userId)) {
                game.players.push(session.userId);
                game.scores[session.userId] = 0;
                await kv.set(`game:${activeGameId}`, game);
                await broadcastToGame(activeGameId, game); // Notify host of new player
            }

            const playerData = await buildPlayerData(game);
            const sanitized: any = sanitizeGameState(game, session.userId);
            sanitized.playerData = playerData;
            return res.json({ gameId: activeGameId, gameState: sanitized });
        }
    }

    // No active game – only allowed hosts may create one.
    if (!ALLOWED_HOSTS.includes(session.userId)) {
        return res.status(404).json({ error: "No active Trial found. Awaiting the Weaver..." });
    }

    // Create a fresh game for the host.
    const gameId = crypto.randomUUID();
    const newGame: GameState = {
        id: gameId,
        hostId: session.userId,
        phase: 'LOBBY',
        questions: [],
        currentQuestionIndex: -1,
        phaseStartTime: Date.now(),
        timeLimitSeconds: 30,
        players: [session.userId],
        scores: { [session.userId]: 0 },
        currentRoundAnswers: {},
        createdAt: Date.now(),
    };

    await kv.set(`game:${gameId}`, newGame);
    await kv.set("activeGame", gameId);

    return res.json({ gameId, gameState: sanitizeGameState(newGame, session.userId) });
});

/**
 * GET /game/:gameId
 * Polling fallback / manual state refresh.
 * Does NOT perform any auto-phase-transitions (those are host-driven via POST).
 */
app.get("/make-server-983e2ba5/game/:gameId", async (req, res) => {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const game: GameState | null = await kv.get(`game:${req.params.gameId}`);
    if (!game) return res.status(404).json({ error: "Game not found" });

    if (
        !game.players.includes(session.userId) &&
        game.hostId !== session.userId
    ) {
        return res.status(403).json({ error: "Not in this game" });
    }

    const playerData = await buildPlayerData(game);
    const sanitized: any = sanitizeGameState(game, session.userId);
    sanitized.playerData = playerData;
    return res.json(sanitized);
});

/** GET /game – quick check for active game existence */
app.get("/make-server-983e2ba5/game", async (_req, res) => {
    const activeGameId = await kv.get("activeGame");
    if (activeGameId) return res.json({ id: activeGameId });
    return res.status(404).json({ error: "No active game" });
});

/**
 * POST /game/:gameId/start  (host only)
 * Validates and sets questions, transitions to STARTING phase.
 */
app.post("/make-server-983e2ba5/game/:gameId/start", async (req, res) => {
    const session = await getSession(req);
    const game: GameState | null = await kv.get(`game:${req.params.gameId}`);

    if (!session || !game || game.hostId !== session.userId) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const { questions, timeLimitSeconds } = req.body ?? {};

    if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "At least one question is required" });
    }

    for (const q of questions) {
        if (
            !q.text ||
            !Array.isArray(q.answers) ||
            q.answers.length < 2 ||
            typeof q.correctAnswer !== "number" ||
            q.correctAnswer < 0 ||
            q.correctAnswer >= q.answers.length
        ) {
            return res.status(400).json({ error: "Invalid question format" });
        }
    }

    game.questions = questions;
    if (typeof timeLimitSeconds === "number") {
        game.timeLimitSeconds = Math.max(5, Math.min(120, timeLimitSeconds));
    }

    game.phase = 'STARTING';
    game.phaseStartTime = Date.now();
    game.currentQuestionIndex = 0;
    game.currentRoundAnswers = {};

    await kv.set(`game:${req.params.gameId}`, game);
    await broadcastToGame(req.params.gameId, game);

    const playerData = await buildPlayerData(game);
    const sanitized = sanitizeGameState(game, session.userId) as any;
    sanitized.playerData = playerData;

    return res.json({ success: true, gameState: sanitized });
});

/**
 * POST /game/:gameId/next  (host only)
 * STARTING → QUESTION_ACTIVE
 * REVEAL_ANSWER | LEADERBOARD → next question or FINISHED
 */
app.post("/make-server-983e2ba5/game/:gameId/next", async (req, res) => {
    const session = await getSession(req);
    const game: GameState | null = await kv.get(`game:${req.params.gameId}`);

    if (!session || !game || game.hostId !== session.userId) {
        return res.status(403).json({ error: "Forbidden" });
    }

    if (game.phase === 'STARTING') {
        game.phase = 'QUESTION_ACTIVE';
        game.phaseStartTime = Date.now();
        game.currentRoundAnswers = {};
    } else if (game.phase === 'REVEAL_ANSWER' || game.phase === 'LEADERBOARD') {
        const nextIdx = game.currentQuestionIndex + 1;
        if (nextIdx >= game.questions.length) {
            game.phase = 'FINISHED';
            await kv.del("activeGame"); // Free the slot for future games
        } else {
            game.currentQuestionIndex = nextIdx;
            game.phase = 'QUESTION_ACTIVE';
            game.phaseStartTime = Date.now();
            game.currentRoundAnswers = {};
        }
    }

    await kv.set(`game:${req.params.gameId}`, game);
    await broadcastToGame(req.params.gameId, game);

    const playerData = await buildPlayerData(game);
    const sanitized = sanitizeGameState(game, session.userId) as any;
    sanitized.playerData = playerData;

    return res.json({ success: true, gameState: sanitized });
});

/**
 * POST /game/:gameId/answer  (players only)
 * Records the player's answer and sends them their personalised state immediately.
 */
app.post("/make-server-983e2ba5/game/:gameId/answer", async (req, res) => {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const game: GameState | null = await kv.get(`game:${req.params.gameId}`);
    if (!game) return res.status(404).json({ error: "Game not found" });

    if (game.phase !== 'QUESTION_ACTIVE') {
        return res.status(400).json({ error: "Not accepting answers right now" });
    }
    if (!game.players.includes(session.userId)) {
        return res.status(403).json({ error: "Not in this game" });
    }
    if (game.currentRoundAnswers?.[session.userId]) {
        return res.status(400).json({ error: "Already answered" });
    }

    const elapsedMs = Date.now() - game.phaseStartTime;
    if (elapsedMs > game.timeLimitSeconds * 1000 + 2000) {
        return res.status(400).json({ error: "Time expired" });
    }

    const { answerIndex } = req.body ?? {};
    if (typeof answerIndex !== "number") {
        return res.status(400).json({ error: "answerIndex must be a number" });
    }

    const currentQ = game.questions[game.currentQuestionIndex];
    if (answerIndex < 0 || answerIndex >= currentQ.answers.length) {
        return res.status(400).json({ error: "Invalid answer index" });
    }

    if (!game.currentRoundAnswers) game.currentRoundAnswers = {};
    game.currentRoundAnswers[session.userId] = {
        answerIndex,
        timeTakenMs: elapsedMs,
        scoreEarned: 0,
        timestamp: Date.now(),
    };

    await kv.set(`game:${req.params.gameId}`, game);

    // Notify the room that a player has answered (count only – no answer revealed).
    io.to(`game:${req.params.gameId}`).emit("player_answered", {
        userId: session.userId,
        answeredCount: Object.keys(game.currentRoundAnswers).length,
        totalPlayers: game.players.length,
    });

    // Push the personalised state to the answering player immediately
    // (so userHasAnswered flips to true for them without waiting for the next poll).
    const playerSocket = findSocketByUserId(session.userId, req.params.gameId);
    if (playerSocket) {
        playerSocket.emit('state_update', sanitizeGameState(game, session.userId));
    }

    return res.json({ status: "received" });
});

/**
 * POST /game/:gameId/reveal  (host only)
 * Scores all answers and transitions to REVEAL_ANSWER.
 */
app.post("/make-server-983e2ba5/game/:gameId/reveal", async (req, res) => {
    const session = await getSession(req);
    const game: GameState | null = await kv.get(`game:${req.params.gameId}`);

    if (!session || !game || game.hostId !== session.userId) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const currentQ = game.questions[game.currentQuestionIndex];
    if (!currentQ) return res.status(400).json({ error: "No current question" });

    // Score each answer.
    if (game.currentRoundAnswers) {
        for (const [userId, record] of Object.entries(game.currentRoundAnswers)) {
            if (record.answerIndex === currentQ.correctAnswer) {
                const ratio = Math.min(1, record.timeTakenMs / (game.timeLimitSeconds * 1000));
                const pts = Math.round(1000 * (1 - ratio / 2));
                record.scoreEarned = Math.max(100, pts); // Floor of 100 for a correct answer
                game.scores[userId] = (game.scores[userId] ?? 0) + record.scoreEarned;
            } else {
                record.scoreEarned = 0;
            }
        }
    }

    game.phase = 'REVEAL_ANSWER';
    await kv.set(`game:${req.params.gameId}`, game);
    await broadcastToGame(req.params.gameId, game);

    const playerData = await buildPlayerData(game);
    const sanitized = sanitizeGameState(game, session.userId) as any;
    sanitized.playerData = playerData;

    return res.json({ success: true, gameState: sanitized });
});

/** POST /game/:gameId/leaderboard  (host only) */
app.post("/make-server-983e2ba5/game/:gameId/leaderboard", async (req, res) => {
    const session = await getSession(req);
    const game: GameState | null = await kv.get(`game:${req.params.gameId}`);

    if (!session || !game || game.hostId !== session.userId) {
        return res.status(403).json({ error: "Forbidden" });
    }

    game.phase = 'LEADERBOARD';
    await kv.set(`game:${req.params.gameId}`, game);
    await broadcastToGame(req.params.gameId, game);

    const playerData = await buildPlayerData(game);
    const sanitized = sanitizeGameState(game, session.userId) as any;
    sanitized.playerData = playerData;

    return res.json({ success: true, gameState: sanitized });
});

/** POST /game/:gameId/reset  (host only) – resets to LOBBY keeping same players */
app.post("/make-server-983e2ba5/game/:gameId/reset", async (req, res) => {
    const session = await getSession(req);
    const game: GameState | null = await kv.get(`game:${req.params.gameId}`);

    if (!session || !game || game.hostId !== session.userId) {
        return res.status(403).json({ error: "Forbidden" });
    }

    game.phase = 'LOBBY';
    game.currentQuestionIndex = -1;
    game.questions = [];
    game.currentRoundAnswers = {};
    game.phaseStartTime = Date.now();
    game.scores = {};
    game.players.forEach((pid) => { game.scores[pid] = 0; });

    await kv.set(`game:${req.params.gameId}`, game);
    await kv.set("activeGame", req.params.gameId); // Ensure it's still marked active
    await broadcastToGame(req.params.gameId, game);

    const playerData = await buildPlayerData(game);
    const sanitized = sanitizeGameState(game, session.userId) as any;
    sanitized.playerData = playerData;

    return res.json({ success: true, gameState: sanitized });
});

/** POST /debug/reset-server  (allowed hosts only) – terminates the active game */
app.post("/make-server-983e2ba5/debug/reset-server", async (req, res) => {
    const session = await getSession(req);
    if (!session || !ALLOWED_HOSTS.includes(session.userId)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const activeGameId: string | null = await kv.get("activeGame");
    if (activeGameId) {
        io.to(`game:${activeGameId}`).emit("server_terminated", {
            message: "The Weaver has ended the Trial.",
        });
    }

    await kv.del("activeGame");
    return res.json({ success: true, message: "Active game cleared." });
});

// ---------------------------------------------------------------------------
// Quiz endpoints (all require allowed-host session)
// ---------------------------------------------------------------------------

function requireHost(session: any, res: express.Response): boolean {
    if (!session) {
        res.status(401).json({ error: "Unauthorized" });
        return false;
    }
    if (!ALLOWED_HOSTS.includes(session.userId)) {
        res.status(403).json({ error: "Forbidden" });
        return false;
    }
    return true;
}

/** POST /quiz/create */
app.post("/make-server-983e2ba5/quiz/create", async (req, res) => {
    const session = await getSession(req);
    if (!requireHost(session, res)) return;

    const { name, description, questions, timeLimitSeconds } = req.body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Quiz name is required" });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "At least one question is required" });
    }

    const quizId = crypto.randomUUID();
    const quiz = {
        id: quizId,
        name: name.trim().slice(0, 100),
        description: typeof description === "string" ? description.trim().slice(0, 500) : "",
        questions,
        timeLimitSeconds:
            typeof timeLimitSeconds === "number"
                ? Math.max(5, Math.min(120, timeLimitSeconds))
                : 30,
        createdAt: Date.now(),
        createdBy: session.userId,
    };

    await kv.set(`quiz:${quizId}`, quiz);
    return res.json({ success: true, quiz });
});

/** GET /quiz/list */
app.get("/make-server-983e2ba5/quiz/list", async (req, res) => {
    const session = await getSession(req);
    if (!requireHost(session, res)) return;

    const quizzes = await kv.getByPrefix("quiz:");
    return res.json({
        quizzes: quizzes.map((q: any) => ({
            id: q.id,
            name: q.name,
            description: q.description,
            questionCount: q.questions?.length ?? 0,
            timeLimitSeconds: q.timeLimitSeconds,
            createdAt: q.createdAt,
        })),
    });
});

/** GET /quiz/:quizId */
app.get("/make-server-983e2ba5/quiz/:quizId", async (req, res) => {
    const session = await getSession(req);
    if (!requireHost(session, res)) return;

    const quiz = await kv.get(`quiz:${req.params.quizId}`);
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    return res.json({ quiz });
});

/** PUT /quiz/:quizId  (only the creator can edit) */
app.put("/make-server-983e2ba5/quiz/:quizId", async (req, res) => {
    const session = await getSession(req);
    if (!requireHost(session, res)) return;

    const quiz = await kv.get(`quiz:${req.params.quizId}`);
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    if (quiz.createdBy !== session.userId) {
        return res.status(403).json({ error: "You can only edit your own quizzes" });
    }

    const { name, description, questions, timeLimitSeconds } = req.body ?? {};
    if (name && typeof name === "string") quiz.name = name.trim().slice(0, 100);
    if (typeof description === "string") quiz.description = description.trim().slice(0, 500);
    if (Array.isArray(questions) && questions.length > 0) quiz.questions = questions;
    if (typeof timeLimitSeconds === "number") {
        quiz.timeLimitSeconds = Math.max(5, Math.min(120, timeLimitSeconds));
    }

    await kv.set(`quiz:${req.params.quizId}`, quiz);
    return res.json({ success: true, quiz });
});

/** DELETE /quiz/:quizId  (only the creator can delete) */
app.delete("/make-server-983e2ba5/quiz/:quizId", async (req, res) => {
    const session = await getSession(req);
    if (!requireHost(session, res)) return;

    const quiz = await kv.get(`quiz:${req.params.quizId}`);
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    if (quiz.createdBy !== session.userId) {
        return res.status(403).json({ error: "You can only delete your own quizzes" });
    }

    await kv.del(`quiz:${req.params.quizId}`);
    return res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/", (_req, res) => {
    res.send("Guilty Guild API is running!");
});

app.get("/make-server-983e2ba5/health", (_req, res) =>
    res.json({ status: "ok", timestamp: Date.now() })
);

// ---------------------------------------------------------------------------
// Start  (skipped when imported by the test suite)
// ---------------------------------------------------------------------------

export { app, httpServer };

if (process.env.NODE_ENV !== "test") {
    const PORT = process.env.PORT ?? 3001;
    console.log(`Starting server because NODE_ENV is: ${JSON.stringify(process.env.NODE_ENV)}`);
    httpServer.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}
