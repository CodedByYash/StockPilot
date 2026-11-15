// Runs before Jest requires any test file, which is what guarantees this
// runs before modules-under-test (like middleware/auth.ts, which reads
// process.env.JWT_SECRET into a module-level constant at import time).
// Setting env vars inside a test file is too late for that — imports in
// the test file are already resolved by the time its own top-level code
// runs, so a module-level constant in the imported code would have
// already captured whatever the env var was (or wasn't) at that point.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';
