# AGENTS.md - Guidelines for AI Coding Agents

This document provides guidelines for AI coding agents working on the bun-ws project.

## Project Overview

bun-ws is a high-performance WebSocket proxy server built on Bun runtime with VLESS/Trojan protocol support. It's a JavaScript ES modules project using native Bun APIs.

## Build, Lint, and Test Commands

### Core Commands
```bash
bun run start       # Start production server
bun run dev         # Start server with hot reload (watch mode)
bun run build       # Check build status (static files in public/)
bun test            # Run all tests
bun test <file>     # Run specific test file
bun test <pattern>  # Run tests matching pattern
bunx @biomejs/biome check .  # Run Biome linter
```

### Development Workflow
1. Run `bun run dev` for active development
2. Run `bun test` before committing changes
3. Run `bunx @biomejs/biome check .` to verify code quality

## Code Style Guidelines

### General Principles
- Write clear, self-documenting code with descriptive names
- Keep functions focused and single-responsibility
- Handle errors gracefully with meaningful error messages
- Add JSDoc comments for public/exported functions

### Imports and Modules
- Use ES modules (`import`/`export`) exclusively
- Group imports: Bun stdlib → External packages → Local modules
- Use absolute paths for Bun stdlib (e.g., `import { serve } from "bun"`)
- Use relative paths for local imports (e.g., `import db from "./db.js"`)

Example:
```javascript
import { serve } from "bun";
import { join } from "path";
import { createHash } from "crypto";
import { connect } from "net";
import db from "./db.js";
```

### Naming Conventions
- **Variables/Constants**: camelCase (e.g., `userId`, `apiKey`)
- **Constants**: UPPER_SNAKE_CASE for true constants (e.g., `DEFAULT_PORT`)
- **Functions**: camelCase, verb-first (e.g., `getUserSettings`)
- **Classes**: PascalCase (if used)
- **Files**: kebab-case (e.g., `user-service.js`)

### Types and Variables
- Use `const` by default, `let` only when reassignment is necessary
- Use descriptive variable names that indicate purpose
- Avoid magic numbers; use named constants
- Use template literals for string interpolation

### Error Handling
- Use `try/catch` blocks for async operations
- Throw errors with descriptive messages
- Handle promise rejections explicitly
- Log errors with context before returning error responses

Example:
```javascript
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  console.error(`Operation failed: ${error.message}`);
  throw new Error(`Failed to complete operation: ${error.message}`);
}
```

### Response Handling
- Return `Response` objects directly from API handlers
- Include appropriate HTTP status codes
- Set `Content-Type` headers correctly
- Return JSON responses with proper structure

Example:
```javascript
return new Response(JSON.stringify({ error: "Message required" }), {
  status: 400,
  headers: { "Content-Type": "application/json" },
});
```

### Security Considerations
- Never log or expose API keys or sensitive credentials
- Validate all inputs from clients
- Use environment variables for configuration
- Never commit `.env` files or secrets

### Code Formatting (Biome)
Biome is configured as the primary linter. Run `bunx @biomejs/biome check .` before committing.

Key Biome rules:
- Strict TypeScript-like checking for JavaScript
- Enforces modern JavaScript patterns
- Catches potential bugs and anti-patterns
- Checks for accessibility issues

### File Organization
- Keep related functionality in the same file
- Export functions at the bottom or with explicit `export` keywords
- Use `index.js` as the entry point
- Put database utilities in `db.js`
- Static assets go in `public/` directory

### Testing
- Create test files with `.test.js` extension
- Use Bun's built-in test runner
- Group related tests with `describe()` blocks
- Test both success and error cases

### Git Workflow
- Write clear commit messages describing the "why"
- Keep commits focused and atomic
- Run linting and tests before committing
- Create feature branches for non-trivial changes

## Environment Variables

The project uses these environment variables (see `.env`):
- `UUID`: VLESS/Trojan user ID
- `DOMAIN`: Server domain
- `WSPATH`: WebSocket path component
- `SUB_PATH`: Subscription path
- `PORT`: Server port (default: 8333)
- `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`: AI API configuration

## Key Files

- `index.js`: Main server entry point and WebSocket handling
- `db.js`: SQLite database utilities and user management
- `public/`: Static frontend files
- `bun-ws.db`: SQLite database file

## Common Patterns

### WebSocket Connection Handling
```javascript
function establishTcpConnection(ws, host, port, payload) {
  resolveHost(host).then((ip) => {
    const remoteSocket = connect({ host: ip, port });
    ws.data.socket = remoteSocket;
    remoteSocket.on("data", (chunk) => ws.send(chunk));
  });
}
```

### Protocol Handler Pattern
```javascript
function handleVlessConnection(ws, msg) {
  try {
    if (msg.length <= 17 || msg[0] !== 0) return false;
    // ... process message
    return true;
  } catch (e) {
    return false;
  }
}
```

## Dependencies

- `bun`: Runtime (^1.0.0)
- Linting: `@biomejs/biome`
- No other runtime dependencies required
