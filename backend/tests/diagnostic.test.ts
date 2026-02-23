// Quick module-loading sanity check – run this in isolation first
test("env vars are set by setupFiles", () => {
    console.log("DB_PATH =", process.env.DB_PATH);
    console.log("NODE_ENV =", process.env.NODE_ENV);
    expect(process.env.DB_PATH).toBe(":memory:");
});

test("db.ts exports are available", () => {
    // Use require to see if module loads
    let kv: any;
    try {
        kv = require("../db");
        console.log("db exports:", Object.keys(kv));
    } catch (err: any) {
        console.error("db.ts failed to load:", err.message);
    }
    expect(kv).toBeDefined();
    expect(typeof kv.deleteByPrefix).toBe("function");
});

test("server.ts exports are available", () => {
    let serverMod: any;
    try {
        serverMod = require("../server");
        console.log("server exports:", Object.keys(serverMod));
    } catch (err: any) {
        console.error("server.ts failed to load:", err.message, err.stack);
    }
    expect(serverMod).toBeDefined();
    expect(typeof serverMod.app).toBe("function");
});
