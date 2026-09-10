// In-memory rate limiter using a Map at true module scope.
// Survives Next.js dev-mode hot reloads because it's not re-instantiated per import.
// No Redis — see DOCUMENTATION.md Section 5 for the tradeoff.
// Implemented in step 10.
