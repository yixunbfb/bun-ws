import { Database } from "bun:sqlite";

// Initialize database
const db = new Database("bun-ws.db");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    api_url TEXT,
    api_key TEXT,
    model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME DEFAULT (datetime('now', '+7 days')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`);

// Helper functions
export function hashPassword(password) {
	return Bun.hash.sha256(password, "hex");
}

export function createUser(username, password) {
	const passwordHash = hashPassword(password);

	try {
		const stmt = db.prepare(
			"INSERT INTO users (username, password_hash) VALUES (?, ?)",
		);
		const result = stmt.run(username, passwordHash);
		return { success: true, userId: result.lastInsertId };
	} catch (error) {
		if (error.message.includes("UNIQUE constraint failed")) {
			return { success: false, error: "Username already exists" };
		}
		return { success: false, error: error.message };
	}
}

export function authenticateUser(username, password) {
	const passwordHash = hashPassword(password);

	const stmt = db.prepare(
		"SELECT id FROM users WHERE username = ? AND password_hash = ?",
	);
	const user = stmt.get(username, passwordHash);

	return user
		? { authenticated: true, userId: user.id }
		: { authenticated: false };
}

export function getUserSettings(userId) {
	const stmt = db.prepare(
		"SELECT api_url, api_key, model FROM user_settings WHERE user_id = ?",
	);
	const settings = stmt.get(userId);

	return settings || null;
}

export function setUserSettings(userId, api_url, api_key, model) {
	const existingStmt = db.prepare(
		"SELECT id FROM user_settings WHERE user_id = ?",
	);
	const existing = existingStmt.get(userId);

	if (existing) {
		const updateStmt = db.prepare(`
      UPDATE user_settings
      SET api_url = ?, api_key = ?, model = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `);
		updateStmt.run(api_url, api_key, model, userId);
	} else {
		const insertStmt = db.prepare(`
      INSERT INTO user_settings (user_id, api_url, api_key, model)
      VALUES (?, ?, ?, ?)
    `);
		insertStmt.run(userId, api_url, api_key, model);
	}

	return { success: true };
}

export function getUserSettingsByUserId(userId) {
	const stmt = db.prepare(
		"SELECT api_url, api_key, model FROM user_settings WHERE user_id = ?",
	);
	const settings = stmt.get(userId);

	return settings || null;
}

export function createSession(userId) {
	const token = Bun.randomUUID();
	const stmt = db.prepare(
		"INSERT INTO sessions (user_id, token) VALUES (?, ?)",
	);
	stmt.run(userId, token);
	return token;
}

export function validateSession(token) {
	const stmt = db.prepare(`
    SELECT s.user_id, s.expires_at, u.username
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now', 'localtime')
  `);
	return stmt.get(token);
}

export function deleteSession(token) {
	const stmt = db.prepare("DELETE FROM sessions WHERE token = ?");
	stmt.run(token);
}

export function getSettingsByToken(token) {
	const session = validateSession(token);
	if (!session) return null;
	return getUserSettingsByUserId(session.user_id);
}

export function saveSettingsByToken(token, api_url, api_key, model) {
	const session = validateSession(token);
	if (!session) return { success: false, error: "Invalid session" };
	setUserSettings(session.user_id, api_url, api_key, model);
	return { success: true };
}

export function getAllUserSettings(userId) {
	const userStmt = db.prepare("SELECT id, username FROM users WHERE id = ?");
	const userData = userStmt.get(userId);

	if (!userData) {
		return null;
	}

	const settings = getUserSettings(userId);

	return {
		userId: userData.id,
		username: userData.username,
		settings: settings,
	};
}

export default db;
