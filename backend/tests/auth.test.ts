
import request from "supertest";
import { app, P, HOST_SESSION_ID, PLAYER_SESSION_ID, seedSessions } from "./helpers";

beforeAll(async () => {
    await seedSessions();
});

describe("GET /config/discord", () => {
    it("returns clientId and redirectUri without auth", async () => {
        const res = await request(app).get(`${P}/config/discord`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("clientId");
        expect(res.body).toHaveProperty("redirectUri");
    });
});

describe("POST /auth/discord", () => {
    it("rejects missing code with 400", async () => {
        const res = await request(app)
            .post(`${P}/auth/discord`)
            .send({});
        expect(res.status).toBe(400);
    });

    it("rejects code that is too long with 400", async () => {
        const res = await request(app)
            .post(`${P}/auth/discord`)
            .send({ code: "x".repeat(201) });
        expect(res.status).toBe(400);
    });

    it("returns 500 when DISCORD_CLIENT_SECRET is absent", async () => {
        // In the test environment the secret is not set, so the endpoint should
        // admit misconfiguration rather than crashing.
        const res = await request(app)
            .post(`${P}/auth/discord`)
            .send({ code: "valid-looking-code" });
        expect(res.status).toBe(500);
    });
});

describe("GET /auth/verify", () => {
    it("returns 401 with no session header", async () => {
        const res = await request(app).get(`${P}/auth/verify`);
        expect(res.status).toBe(401);
    });

    it("returns 401 with a non-existent session", async () => {
        const res = await request(app)
            .get(`${P}/auth/verify`)
            .set("X-Session-ID", "ghost-session-id");
        expect(res.status).toBe(401);
    });

    it("returns 200 with user object for a valid host session", async () => {
        const res = await request(app)
            .get(`${P}/auth/verify`)
            .set("X-Session-ID", HOST_SESSION_ID);
        expect(res.status).toBe(200);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.username).toBe("TestHost");
    });

    it("returns 200 for a valid player session", async () => {
        const res = await request(app)
            .get(`${P}/auth/verify`)
            .set("X-Session-ID", PLAYER_SESSION_ID);
        expect(res.status).toBe(200);
        expect(res.body.user.username).toBe("TestPlayer");
    });
});

describe("GET /health", () => {
    it("returns ok", async () => {
        const res = await request(app).get(`${P}/health`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
    });
});
