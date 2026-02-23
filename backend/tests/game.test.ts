
import request from "supertest";
import {
    app, P, kv,
    HOST_SESSION_ID, HOST_USER_ID,
    PLAYER_SESSION_ID, PLAYER_USER_ID,
    SAMPLE_QUESTIONS,
    seedSessions, cleanGames,
} from "./helpers";

beforeAll(async () => {
    await seedSessions();
});

afterEach(async () => {
    await cleanGames();
});

// ─── /game/connect ───────────────────────────────────────────────────────────

describe("POST /game/connect", () => {
    it("returns 401 with no session", async () => {
        const res = await request(app).post(`${P}/game/connect`);
        expect(res.status).toBe(401);
    });

    it("host creates a game when none exists", async () => {
        const res = await request(app)
            .post(`${P}/game/connect`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(200);
        expect(res.body.gameId).toBeTruthy();
        expect(res.body.gameState.phase).toBe("LOBBY");
    });

    it("player gets 404 when no active game exists", async () => {
        const res = await request(app)
            .post(`${P}/game/connect`)
            .set("X-Session-ID", PLAYER_SESSION_ID);
        expect(res.status).toBe(404);
    });

    it("player joins lobby after host creates game", async () => {
        // Host creates game
        await request(app)
            .post(`${P}/game/connect`)
            .set("X-Session-ID", HOST_SESSION_ID);

        // Player joins
        const res = await request(app)
            .post(`${P}/game/connect`)
            .set("X-Session-ID", PLAYER_SESSION_ID);

        expect(res.status).toBe(200);
        expect(res.body.gameState.phase).toBe("LOBBY");
        expect(res.body.gameState.players).toContain(PLAYER_USER_ID);
    });

    it("player gets 403 when game is in progress and they weren't in lobby", async () => {
        // Host creates + starts game (bypassing lobby join for the player)
        const hostConn = await request(app)
            .post(`${P}/game/connect`)
            .set("X-Session-ID", HOST_SESSION_ID);
        const { gameId } = hostConn.body;

        await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });

        // A new player tries to join after game started
        const res = await request(app)
            .post(`${P}/game/connect`)
            .set("X-Session-ID", PLAYER_SESSION_ID);
        expect(res.status).toBe(403);
    });
});

// ─── GET /game/:id ────────────────────────────────────────────────────────────

describe("GET /game/:id", () => {
    it("returns 401 with no session", async () => {
        const res = await request(app).get(`${P}/game/fake-id`);
        expect(res.status).toBe(401);
    });

    it("returns 404 for a non-existent game", async () => {
        const res = await request(app)
            .get(`${P}/game/non-existent-game`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(404);
    });

    it("returns game state for a participant", async () => {
        const conn = await request(app)
            .post(`${P}/game/connect`)
            .set("X-Session-ID", HOST_SESSION_ID);
        const { gameId } = conn.body;

        const res = await request(app)
            .get(`${P}/game/${gameId}`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(200);
        expect(res.body.phase).toBe("LOBBY");
    });
});

// ─── Full lifecycle ────────────────────────────────────────────────────────────

describe("Full game lifecycle", () => {
    async function setupLobby() {
        const conn = await request(app)
            .post(`${P}/game/connect`)
            .set("X-Session-ID", HOST_SESSION_ID);
        const gameId: string = conn.body.gameId;

        // Player joins
        await request(app)
            .post(`${P}/game/connect`)
            .set("X-Session-ID", PLAYER_SESSION_ID);

        return gameId;
    }

    it("validates question format on start", async () => {
        const gameId = await setupLobby();

        const bad = await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: [{ text: "No answers here" }] });
        expect(bad.status).toBe(400);
    });

    it("rejects /start from non-host", async () => {
        const gameId = await setupLobby();
        const res = await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", PLAYER_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });
        expect(res.status).toBe(403);
    });

    it("LOBBY → STARTING on /start", async () => {
        const gameId = await setupLobby();
        const res = await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });
        expect(res.status).toBe(200);
        expect(res.body.gameState.phase).toBe("STARTING");
        expect(res.body.gameState.questions).toHaveLength(2);
    });

    it("STARTING → QUESTION_ACTIVE on /next", async () => {
        const gameId = await setupLobby();
        await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });

        const res = await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(200);
        expect(res.body.gameState.phase).toBe("QUESTION_ACTIVE");
    });

    it("player submits a correct answer", async () => {
        const gameId = await setupLobby();
        await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });
        await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID);

        // correctAnswer for Q1 is index 1 ("Blue")
        const res = await request(app)
            .post(`${P}/game/${gameId}/answer`)
            .set("X-Session-ID", PLAYER_SESSION_ID)
            .send({ answerIndex: 1 });
        expect(res.status).toBe(200);
    });

    it("double-answer is rejected with 400", async () => {
        const gameId = await setupLobby();
        await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });
        await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID);

        await request(app)
            .post(`${P}/game/${gameId}/answer`)
            .set("X-Session-ID", PLAYER_SESSION_ID)
            .send({ answerIndex: 1 });

        const second = await request(app)
            .post(`${P}/game/${gameId}/answer`)
            .set("X-Session-ID", PLAYER_SESSION_ID)
            .send({ answerIndex: 0 });
        expect(second.status).toBe(400);
        expect(second.body.error).toMatch(/already answered/i);
    });

    it("answer outside QUESTION_ACTIVE phase is rejected with 400", async () => {
        const gameId = await setupLobby();
        // Game is still in LOBBY phase
        const res = await request(app)
            .post(`${P}/game/${gameId}/answer`)
            .set("X-Session-ID", PLAYER_SESSION_ID)
            .send({ answerIndex: 0 });
        expect(res.status).toBe(400);
    });

    it("QUESTION_ACTIVE → REVEAL_ANSWER on /reveal", async () => {
        const gameId = await setupLobby();
        await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });
        await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID);

        const res = await request(app)
            .post(`${P}/game/${gameId}/reveal`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(200);
        expect(res.body.gameState.phase).toBe("REVEAL_ANSWER");
    });

    it("correct answer scores the player", async () => {
        const gameId = await setupLobby();
        await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });
        await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID);

        await request(app)
            .post(`${P}/game/${gameId}/answer`)
            .set("X-Session-ID", PLAYER_SESSION_ID)
            .send({ answerIndex: 1 }); // correct

        const reveal = await request(app)
            .post(`${P}/game/${gameId}/reveal`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(reveal.body.gameState.scores[PLAYER_USER_ID]).toBeGreaterThanOrEqual(100);
    });

    it("wrong answer earns 0 points", async () => {
        const gameId = await setupLobby();
        await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });
        await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID);

        await request(app)
            .post(`${P}/game/${gameId}/answer`)
            .set("X-Session-ID", PLAYER_SESSION_ID)
            .send({ answerIndex: 0 }); // wrong (correct is 1)

        const reveal = await request(app)
            .post(`${P}/game/${gameId}/reveal`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(reveal.body.gameState.scores[PLAYER_USER_ID]).toBe(0);
    });

    it("REVEAL → LEADERBOARD on /leaderboard", async () => {
        const gameId = await setupLobby();
        await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });
        await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID);
        await request(app)
            .post(`${P}/game/${gameId}/reveal`)
            .set("X-Session-ID", HOST_SESSION_ID);

        const res = await request(app)
            .post(`${P}/game/${gameId}/leaderboard`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(200);
        expect(res.body.gameState.phase).toBe("LEADERBOARD");
    });

    it("LEADERBOARD → QUESTION_ACTIVE (next question) on /next", async () => {
        const gameId = await setupLobby();
        await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });
        await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID);
        await request(app)
            .post(`${P}/game/${gameId}/reveal`)
            .set("X-Session-ID", HOST_SESSION_ID);
        await request(app)
            .post(`${P}/game/${gameId}/leaderboard`)
            .set("X-Session-ID", HOST_SESSION_ID);

        const res = await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(200);
        expect(res.body.gameState.phase).toBe("QUESTION_ACTIVE");
        expect(res.body.gameState.currentQuestionIndex).toBe(1);
    });

    it("game reaches FINISHED after last question, activeGame key removed", async () => {
        const gameId = await setupLobby();
        await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: [SAMPLE_QUESTIONS[0]] }); // single question

        await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID); // → QUESTION_ACTIVE
        await request(app)
            .post(`${P}/game/${gameId}/reveal`)
            .set("X-Session-ID", HOST_SESSION_ID); // → REVEAL_ANSWER

        const res = await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID); // → FINISHED
        expect(res.status).toBe(200);
        expect(res.body.gameState.phase).toBe("FINISHED");

        // activeGame key should have been cleared
        const active = await kv.get("activeGame");
        expect(active).toBeNull();
    });

    it("reset returns game to LOBBY", async () => {
        const gameId = await setupLobby();
        await request(app)
            .post(`${P}/game/${gameId}/start`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ questions: SAMPLE_QUESTIONS });
        await request(app)
            .post(`${P}/game/${gameId}/next`)
            .set("X-Session-ID", HOST_SESSION_ID);
        await request(app)
            .post(`${P}/game/${gameId}/reveal`)
            .set("X-Session-ID", HOST_SESSION_ID);

        const res = await request(app)
            .post(`${P}/game/${gameId}/reset`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(200);
        expect(res.body.gameState.phase).toBe("LOBBY");
    });
});

// ─── /debug/reset-server ─────────────────────────────────────────────────────

describe("POST /debug/reset-server", () => {
    it("clears active game when called by a host", async () => {
        // Create a game first
        await request(app)
            .post(`${P}/game/connect`)
            .set("X-Session-ID", HOST_SESSION_ID);

        const before = await kv.get("activeGame");
        expect(before).not.toBeNull();

        await request(app)
            .post(`${P}/debug/reset-server`)
            .set("X-Session-ID", HOST_SESSION_ID);

        const after = await kv.get("activeGame");
        expect(after).toBeNull();
    });

    it("returns 403 for a non-host", async () => {
        const res = await request(app)
            .post(`${P}/debug/reset-server`)
            .set("X-Session-ID", PLAYER_SESSION_ID);
        expect(res.status).toBe(403);
    });
});
