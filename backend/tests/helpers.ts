/**
 * Shared helpers for the Guilty Guild backend test suite.
 *
 * Each test file runs in the same single fork (singleFork: true) but gets its
 * own module scope. We pass `app` (the Express handler) to supertest – it
 * wraps it in a temporary HTTP server automatically, so no `.listen()` call
 * is needed and socket.io is not involved in these REST tests.
 */
import * as kv from "../db";
import { app } from "../server";

export { kv, app };

// ─── Fixed test identities ──────────────────────────────────────────────────

export const HOST_SESSION_ID    = "test-host-session";
export const HOST_USER_ID       = "894118872712613898";   // in ALLOWED_HOSTS

export const OTHER_HOST_SESSION_ID = "test-other-host-session";
export const OTHER_HOST_USER_ID    = "339513008835395587"; // in ALLOWED_HOSTS

export const PLAYER_SESSION_ID  = "test-player-session";
export const PLAYER_USER_ID     = "player-user-123456";   // NOT in ALLOWED_HOSTS

/** URL prefix every route lives under. */
export const P = "/make-server-983e2ba5";

// ─── Sample quiz questions ───────────────────────────────────────────────────

export const SAMPLE_QUESTIONS = [
    {
        text: "What colour is the sky?",
        answers: ["Red", "Blue", "Green", "Yellow"],
        correctAnswer: 1,   // "Blue"
    },
    {
        text: "What is 2 + 2?",
        answers: ["3", "4", "5", "6"],
        correctAnswer: 1,   // "4"
    },
];

// ─── DB seed / cleanup helpers ───────────────────────────────────────────────

export async function seedSessions() {
    const now = Date.now();
    await kv.set(`session:${HOST_SESSION_ID}`, {
        userId: HOST_USER_ID, username: "TestHost", avatar: null, createdAt: now,
    });
    await kv.set(`session:${OTHER_HOST_SESSION_ID}`, {
        userId: OTHER_HOST_USER_ID, username: "OtherHost", avatar: null, createdAt: now,
    });
    await kv.set(`session:${PLAYER_SESSION_ID}`, {
        userId: PLAYER_USER_ID, username: "TestPlayer", avatar: null, createdAt: now,
    });
}

export async function cleanGames() {
    await kv.deleteByPrefix("game:");
    await kv.del("activeGame");
}

export async function cleanQuizzes() {
    await kv.deleteByPrefix("quiz:");
}
