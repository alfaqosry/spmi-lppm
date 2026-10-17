/**
 * Setup global Vitest.
 * AUTH_SECRET dummy (>= 32 karakter) agar modul auth tidak memakai nilai dev.
 */
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-0123456789";
