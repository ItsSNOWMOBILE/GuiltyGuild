// Runs before each test file's modules are loaded.
// Setting these here ensures db.ts opens :memory: instead of a file,
// and server.ts skips its httpServer.listen() call.
process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";
