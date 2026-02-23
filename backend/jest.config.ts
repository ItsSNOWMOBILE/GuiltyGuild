import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.ts"],
    // setupFiles run before each test file is loaded, so env vars
    // are set before db.ts is first require()'d.
    setupFiles: ["./tests/setup.ts"],
    globals: {
        "ts-jest": {
            tsconfig: {
                // Match production tsconfig but include test helpers
                target: "ES2022",
                module: "CommonJS",
                esModuleInterop: true,
                strict: true,
                skipLibCheck: true,
            },
        },
    },
    // Give async DB init and HTTP requests enough time
    testTimeout: 15000,
};

export default config;
