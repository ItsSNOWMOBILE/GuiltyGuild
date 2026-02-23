
import request from "supertest";
import {
    app, P,
    HOST_SESSION_ID, HOST_USER_ID,
    OTHER_HOST_SESSION_ID,
    PLAYER_SESSION_ID,
    seedSessions, cleanQuizzes,
} from "./helpers";

beforeAll(async () => {
    await seedSessions();
});

afterEach(async () => {
    await cleanQuizzes();
});

// ─── Auth guard – all quiz routes require an allowed-host session ─────────────

describe("Quiz auth guards", () => {
    it("POST /quiz/create returns 403 for a player", async () => {
        const res = await request(app)
            .post(`${P}/quiz/create`)
            .set("X-Session-ID", PLAYER_SESSION_ID)
            .send({ name: "My Quiz", questions: [{ text: "Q", answers: ["A", "B"], correctAnswer: 0 }] });
        expect(res.status).toBe(403);
    });

    it("GET /quiz/list returns 403 for a player", async () => {
        const res = await request(app)
            .get(`${P}/quiz/list`)
            .set("X-Session-ID", PLAYER_SESSION_ID);
        expect(res.status).toBe(403);
    });

    it("GET /quiz/list returns 401 with no session", async () => {
        const res = await request(app).get(`${P}/quiz/list`);
        expect(res.status).toBe(401);
    });
});

// ─── Create ──────────────────────────────────────────────────────────────────

describe("POST /quiz/create", () => {
    it("creates a quiz and returns it", async () => {
        const res = await request(app)
            .post(`${P}/quiz/create`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({
                name: "Test Quiz",
                description: "A description",
                questions: [
                    { text: "Q1", answers: ["A", "B"], correctAnswer: 0 },
                ],
                timeLimitSeconds: 20,
            });
        expect(res.status).toBe(200);
        expect(res.body.quiz.name).toBe("Test Quiz");
        expect(res.body.quiz.createdBy).toBe(HOST_USER_ID);
        expect(res.body.quiz.id).toBeTruthy();
    });

    it("clamps timeLimitSeconds between 5 and 120", async () => {
        const res = await request(app)
            .post(`${P}/quiz/create`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({
                name: "Clamped",
                questions: [{ text: "Q", answers: ["A", "B"], correctAnswer: 0 }],
                timeLimitSeconds: 999,
            });
        expect(res.body.quiz.timeLimitSeconds).toBe(120);
    });
});

// ─── List ─────────────────────────────────────────────────────────────────────

describe("GET /quiz/list", () => {
    it("returns an empty array when no quizzes exist", async () => {
        const res = await request(app)
            .get(`${P}/quiz/list`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(200);
        expect(res.body.quizzes).toEqual([]);
    });

    it("returns all created quizzes", async () => {
        await request(app)
            .post(`${P}/quiz/create`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ name: "Q1", questions: [{ text: "Q", answers: ["A", "B"], correctAnswer: 0 }] });
        await request(app)
            .post(`${P}/quiz/create`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ name: "Q2", questions: [{ text: "Q", answers: ["A", "B"], correctAnswer: 0 }] });

        const res = await request(app)
            .get(`${P}/quiz/list`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.body.quizzes).toHaveLength(2);
    });
});

// ─── Get by ID ────────────────────────────────────────────────────────────────

describe("GET /quiz/:id", () => {
    it("returns 404 for unknown quiz", async () => {
        const res = await request(app)
            .get(`${P}/quiz/nonexistent`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(404);
    });

    it("returns the quiz for a valid id", async () => {
        const create = await request(app)
            .post(`${P}/quiz/create`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ name: "Fetch Me", questions: [{ text: "Q", answers: ["A", "B"], correctAnswer: 0 }] });
        const quizId = create.body.quiz.id;

        const res = await request(app)
            .get(`${P}/quiz/${quizId}`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(200);
        expect(res.body.quiz.name).toBe("Fetch Me");
    });
});

// ─── Update ───────────────────────────────────────────────────────────────────

describe("PUT /quiz/:id", () => {
    it("allows creator to update", async () => {
        const create = await request(app)
            .post(`${P}/quiz/create`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ name: "Old Name", questions: [{ text: "Q", answers: ["A", "B"], correctAnswer: 0 }] });
        const quizId = create.body.quiz.id;

        const res = await request(app)
            .put(`${P}/quiz/${quizId}`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ name: "New Name" });
        expect(res.status).toBe(200);
        expect(res.body.quiz.name).toBe("New Name");
    });

    it("returns 403 when a different host tries to edit", async () => {
        const create = await request(app)
            .post(`${P}/quiz/create`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ name: "Owned Quiz", questions: [{ text: "Q", answers: ["A", "B"], correctAnswer: 0 }] });
        const quizId = create.body.quiz.id;

        const res = await request(app)
            .put(`${P}/quiz/${quizId}`)
            .set("X-Session-ID", OTHER_HOST_SESSION_ID)
            .send({ name: "Stolen Name" });
        expect(res.status).toBe(403);
    });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

describe("DELETE /quiz/:id", () => {
    it("allows creator to delete", async () => {
        const create = await request(app)
            .post(`${P}/quiz/create`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ name: "Delete Me", questions: [{ text: "Q", answers: ["A", "B"], correctAnswer: 0 }] });
        const quizId = create.body.quiz.id;

        const del = await request(app)
            .delete(`${P}/quiz/${quizId}`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(del.status).toBe(200);

        // Verify it's gone
        const fetch = await request(app)
            .get(`${P}/quiz/${quizId}`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(fetch.status).toBe(404);
    });

    it("returns 403 when a different host tries to delete", async () => {
        const create = await request(app)
            .post(`${P}/quiz/create`)
            .set("X-Session-ID", HOST_SESSION_ID)
            .send({ name: "Protected", questions: [{ text: "Q", answers: ["A", "B"], correctAnswer: 0 }] });
        const quizId = create.body.quiz.id;

        const res = await request(app)
            .delete(`${P}/quiz/${quizId}`)
            .set("X-Session-ID", OTHER_HOST_SESSION_ID);
        expect(res.status).toBe(403);
    });
});
