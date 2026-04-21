// DOM Utility functions
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => context.querySelectorAll(selector);

// Message groups for sticky headers
const currentMessageGroup = null;
let _lastUserMessage = null;

// Notification System
const NotificationTypes = {
	SUCCESS: "success",
	ERROR: "error",
	WARNING: "warning",
	INFO: "info",
};

const NotificationIcons = {
	success: "✓",
	error: "✕",
	warning: "⚠",
	info: "ℹ",
};

function showNotification(
	message,
	type = NotificationTypes.INFO,
	title = "",
	duration = 3000,
) {
	const container = $("#notification-container");
	if (!container) {
		console.error("Notification container not found");
		return;
	}

	// Create notification element
	const notification = document.createElement("div");
	notification.className = `notification ${type}`;

	const icon = document.createElement("div");
	icon.className = "notification-icon";
	icon.textContent = NotificationIcons[type] || "ℹ";

	const content = document.createElement("div");
	content.className = "notification-content";

	if (title) {
		const titleEl = document.createElement("div");
		titleEl.className = "notification-title";
		titleEl.textContent = title;
		content.appendChild(titleEl);
	}

	const messageEl = document.createElement("div");
	messageEl.className = "notification-message";
	messageEl.textContent = message;
	content.appendChild(messageEl);

	const closeBtn = document.createElement("button");
	closeBtn.className = "notification-close";
	closeBtn.innerHTML = "×";
	closeBtn.setAttribute("aria-label", "Close notification");

	notification.appendChild(icon);
	notification.appendChild(content);
	notification.appendChild(closeBtn);

	// Add to container
	container.appendChild(notification);

	// Auto remove after duration
	const timeoutId = setTimeout(() => {
		removeNotification(notification);
	}, duration);

	// Close button handler
	closeBtn.addEventListener("click", () => {
		clearTimeout(timeoutId);
		removeNotification(notification);
	});

	return notification;
}

function removeNotification(notification) {
	if (!notification || !notification.parentElement) return;

	notification.style.animation = "fadeOut 0.3s ease";
	setTimeout(() => {
		if (notification.parentElement) {
			notification.parentElement.removeChild(notification);
		}
	}, 300);
}

// Initialize chat functionality
document.addEventListener("DOMContentLoaded", () => {
	const messageInput = $("#message-input");
	const sendBtn = $("#send-btn");
	const chatMessages = $("#chat-messages");
	const configDialog = $("#config-dialog");
	const openConfigBtn = $("#open-config-btn");
	const cancelConfigBtn = $("#cancel-config-btn");
	const configForm = $("#config-form");
	const apiKeyInput = $("#api-key");
	const apiKeyStatus = $("#api-key-status");
	const apiKeyStatusText = $("#api-key-status-text");
	const typingIndicator = $("#typing-indicator");
	const themeToggle = $("#theme-toggle");
	const dialogTitle = $(".dialog-content h2");
	const dialogDescription = $(".dialog-content p");
	const _usernameInput = $("#username");
	const _passwordInput = $("#password");
	const _usernameGroup = $("#username-group");
	const _passwordGroup = $("#password-group");
	const authModeToggle = $("#auth-mode-toggle");
	let isLoginMode = true;

	// Debug: Check if critical elements exist
	if (!themeToggle) {
		console.error("Theme toggle button not found!");
	}
	if (!openConfigBtn) {
		console.error("Config button not found!");
	}
	if (!configDialog) {
		console.error("Config dialog not found!");
	}

	const API_KEY_STORAGE_KEY = "ai_api_key";
	const AI_URL_STORAGE_KEY = "ai_api_url";
	const MODEL_STORAGE_KEY = "ai_model";
	const AUTH_TOKEN_STORAGE_KEY = "auth_token";
	const USER_MODE_STORAGE_KEY = "user_mode"; // 'local' or 'cloud'
	const USERNAME_STORAGE_KEY = "cloud_username";

	// Initialize user mode and auth token
	let authToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || null;
	let userMode = localStorage.getItem(USER_MODE_STORAGE_KEY) || "local"; // default to local mode

	// Theme management
	function loadTheme() {
		const savedTheme = localStorage.getItem("theme") || "dark";
		document.documentElement.setAttribute("data-theme", savedTheme);
		updateThemeToggleUI(savedTheme);
	}

	function updateThemeToggleUI(theme) {
		if (!themeToggle) return; // Exit if themeToggle element doesn't exist

		const themeIcon = themeToggle.querySelector(".theme-icon");

		if (themeIcon) {
			if (theme === "light") {
				themeIcon.textContent = "☀️";
				themeToggle.title = "Switch to dark mode";
			} else {
				themeIcon.textContent = "🌙";
				themeToggle.title = "Switch to light mode";
			}
		}
	}

	if (themeToggle) {
		themeToggle.addEventListener("click", () => {
			const currentTheme =
				document.documentElement.getAttribute("data-theme") || "dark";
			const newTheme = currentTheme === "dark" ? "light" : "dark";

			document.documentElement.setAttribute("data-theme", newTheme);
			localStorage.setItem("theme", newTheme);
			updateThemeToggleUI(newTheme);
		});
	}

	// Load saved theme
	loadTheme();

	// Load configuration from localStorage and update UI
	let currentApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
	let currentAiUrl =
		localStorage.getItem(AI_URL_STORAGE_KEY) ||
		"https://api.openai.com/v1/chat/completions";
	let currentModel = localStorage.getItem(MODEL_STORAGE_KEY) || "gpt-3.5-turbo";

	// Check if there are mode-related elements in the HTML
	const modeToggles = $$(".mode-toggle");

	if (modeToggles.length > 0) {
		// If mode toggles exist in the UI, initialize with saved value
		userMode = localStorage.getItem(USER_MODE_STORAGE_KEY) || "local";

		// Add event listeners for mode toggles
		modeToggles.forEach((button) => {
			button.addEventListener("click", () => {
				const mode = button.getAttribute("data-mode");
				userMode = mode;
				localStorage.setItem(USER_MODE_STORAGE_KEY, mode);
				updateUserModeUI();
			});
		});

		// Initialize UI with saved mode
		updateUserModeUI();
	}

	// Set up mode toggle UI update function
	function updateUserModeUI() {
		const modeToggle = $(`.mode-toggle[data-mode="${userMode}"]`);
		if (modeToggle) {
			$$(".mode-toggle").forEach((btn) => btn.classList.remove("active"));
			modeToggle.classList.add("active");
		}

		updateApiKeyStatusUI();
		updateDialogForMode();
	}

	// --- API Key Configuration Dialog Logic ---
	if (openConfigBtn) {
		openConfigBtn.addEventListener("click", async () => {
			updateDialogForMode();

			const apiUrlInput = $("#api-url");
			const modelInput = $("#ai-model");
			const customModelInput = $("#custom-model");
			const customModelGroup = $("#custom-model-group");

			if (userMode === "cloud" && authToken) {
				// Load settings from server for cloud mode
				try {
					const response = await fetch("/api/user-settings", {
						method: "GET",
						headers: {
							Authorization: `Bearer ${authToken}`,
						},
					});

					if (response.ok) {
						const data = await response.json();
						if (data.settings) {
							if (apiUrlInput) apiUrlInput.value = data.settings.apiUrl || "";
							if (data.settings.hasApiKey) currentApiKey = "saved";
							if (modelInput) {
								const model = data.settings.model || "gpt-3.5-turbo";
								if (
									[
										"gpt-3.5-turbo",
										"gpt-4",
										"gpt-4-turbo",
										"gpt-4o",
										"claude-3-sonnet",
										"claude-3-opus",
									].includes(model)
								) {
									modelInput.value = model;
									customModelGroup.style.display = "none";
								} else {
									modelInput.value = "custom";
									customModelGroup.style.display = "block";
									if (customModelInput) customModelInput.value = model;
								}
							}
						}
					} else {
						// Token invalid, clear it and switch to local mode
						authToken = null;
						localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
						userMode = "local";
						localStorage.setItem(USER_MODE_STORAGE_KEY, "cloud");
						updateUserModeUI();
					}
				} catch (error) {
					console.error("Error loading cloud settings:", error);
				}
			} else if (userMode === "local") {
				// Load from localStorage for local mode
				if (apiUrlInput)
					apiUrlInput.value =
						currentAiUrl || "https://api.openai.com/v1/chat/completions";
				// Keep apiKey input empty for security, but remember it's configured
				if (apiKeyInput) apiKeyInput.value = "";
				if (modelInput) {
					if (
						[
							"gpt-3.5-turbo",
							"gpt-4",
							"gpt-4-turbo",
							"gpt-4o",
							"claude-3-sonnet",
							"claude-3-opus",
						].includes(currentModel)
					) {
						modelInput.value = currentModel;
						customModelGroup.style.display = "none";
					} else {
						modelInput.value = "custom";
						customModelGroup.style.display = "block";
						if (customModelInput) customModelInput.value = currentModel;
					}
				}
				// Update API key status text to show it's already configured
				if (currentApiKey) {
					apiKeyStatusText.textContent = "Local Mode - API Key Configured";
					$(".dot", apiKeyStatus)?.classList.remove("not-configured");
					$(".dot", apiKeyStatus)?.classList.add("configured");
				}
			}

			if (configDialog) {
				configDialog.classList.add("active");
			}
			if (apiUrlInput) apiUrlInput.focus();
		});
	}

	if (cancelConfigBtn) {
		cancelConfigBtn.addEventListener("click", () => {
			if (configDialog) configDialog.classList.remove("active");
			if (apiKeyInput) apiKeyInput.value = "";
		});
	}

	if (authModeToggle) {
		authModeToggle.addEventListener("click", () => {
			isLoginMode = !isLoginMode;
			authModeToggle.textContent = isLoginMode
				? "Switch to Register"
				: "Switch to Login";
			$("#save-settings-btn").textContent = isLoginMode ? "Login" : "Register";
			dialogTitle.textContent = isLoginMode ? "Login" : "Create Account";
			dialogDescription.textContent = isLoginMode
				? "Login to access your cloud settings."
				: "Create an account to save your AI settings in the cloud.";
		});
	}

	if (configDialog) {
		configDialog.addEventListener("click", (e) => {
			if (e.target === configDialog) {
				configDialog.classList.remove("active");
				if (apiKeyInput) apiKeyInput.value = "";
			}
		});
	}

	// Model select change handler - show/hide custom model input
	const modelInput = $("#ai-model");
	const customModelGroup = $("#custom-model-group");
	if (modelInput && customModelGroup) {
		modelInput.addEventListener("change", () => {
			if (modelInput.value === "custom") {
				customModelGroup.style.display = "block";
			} else {
				customModelGroup.style.display = "none";
			}
		});
	}

	function updateDialogForMode() {
		const authFields = $("#auth-fields");
		const apiFields = $("#api-fields");
		const saveBtn = $("#save-settings-btn");

		if (userMode === "cloud") {
			if (!authToken) {
				// Show login/register form
				authFields.style.display = "block";
				apiFields.style.display = "none";
				dialogTitle.textContent = isLoginMode ? "Login" : "Create Account";
				dialogDescription.textContent = isLoginMode
					? "Login to access your cloud settings."
					: "Create an account to save your AI settings in the cloud.";
				saveBtn.textContent = isLoginMode ? "Login" : "Register";
			} else {
				// Show API settings form for cloud mode
				authFields.style.display = "none";
				apiFields.style.display = "block";
				dialogTitle.textContent = "Configure AI Settings";
				dialogDescription.textContent =
					"Configure your AI API settings. These settings are stored securely on the server.";
				saveBtn.textContent = "Save Settings";
			}
		} else {
			// Local mode - show API settings form
			authFields.style.display = "none";
			apiFields.style.display = "block";
			dialogTitle.textContent = "Configure AI Settings";
			dialogDescription.textContent = "Configure your AI API settings.";
			saveBtn.textContent = "Save Settings";
		}
	}

	configForm.addEventListener("submit", async (e) => {
		e.preventDefault();

		if (userMode === "cloud" && !authToken) {
			// Handle login/register
			const username = $("#username").value.trim();
			const password = $("#password").value.trim();

			if (!username || !password) {
				showNotification(
					"Username and password are required.",
					NotificationTypes.WARNING,
					"Validation Error",
				);
				return;
			}

			const endpoint = isLoginMode ? "/api/login" : "/api/register";
			const btn = $("#save-settings-btn");
			const originalText = btn.textContent;
			btn.textContent = isLoginMode ? "Logging in..." : "Creating account...";
			btn.disabled = true;

			try {
				const response = await fetch(endpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ username, password }),
				});

				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "Authentication failed");
				}

				authToken = data.token;
				localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
				localStorage.setItem(USERNAME_STORAGE_KEY, username);
				localStorage.setItem(USER_MODE_STORAGE_KEY, "cloud");
				userMode = "cloud";

				showNotification(
					isLoginMode ? "Login successful!" : "Account created successfully!",
					NotificationTypes.SUCCESS,
					"Success",
				);
				updateUserModeUI();
				configDialog.classList.remove("active");

				// Clear form
				$("#username").value = "";
				$("#password").value = "";

				// Refresh dialog to show API settings
				updateDialogForMode();
			} catch (error) {
				showNotification(
					error.message,
					NotificationTypes.ERROR,
					"Authentication Error",
				);
			} finally {
				btn.textContent = originalText;
				btn.disabled = false;
			}
			return;
		}

		// Handle API settings save (local mode or cloud mode with token)
		const newAiUrl = $("#api-url").value.trim();
		const newApiKey = apiKeyInput.value.trim();
		const newModel = $("#ai-model").value.trim();
		const customModel = $("#custom-model").value.trim();

		if (!newApiKey && userMode === "local") {
			// Keep existing API key if not changed
			if (currentApiKey) {
				// Keep using the saved API key
			} else {
				showNotification(
					"API Key cannot be empty.",
					NotificationTypes.WARNING,
					"Validation Error",
				);
				return;
			}
		}

		if (!newApiKey && userMode === "cloud") {
			showNotification(
				"API Key cannot be empty.",
				NotificationTypes.WARNING,
				"Validation Error",
			);
			return;
		}

		// Show loading state
		const saveBtn = $(".btn-save");
		const originalBtnText = saveBtn.textContent;
		saveBtn.textContent = "Saving...";
		saveBtn.disabled = true;

		try {
			if (userMode === "cloud" && authToken) {
				// Save to server for cloud mode
				const response = await fetch("/api/user-settings", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${authToken}`,
					},
					body: JSON.stringify({
						apiUrl: newAiUrl || "",
						apiKey: newApiKey,
						model: newModel === "custom" ? customModel : newModel,
					}),
				});

				const data = await response.json();

				if (!response.ok) {
					if (response.status === 401) {
						// Token invalid
						authToken = null;
						localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
						showNotification(
							"Session expired. Please login again.",
							NotificationTypes.WARNING,
							"Session Expired",
						);
						updateUserModeUI();
						return;
					}
					throw new Error(data.error || "Failed to save settings");
				}

				currentApiKey = newApiKey;
				currentAiUrl = newAiUrl;
				currentModel = newModel === "custom" ? customModel : newModel;
			} else {
				// Save to localStorage for local mode
				// Only update API key if user provided a new one
				const finalApiKey = newApiKey || currentApiKey;
				localStorage.setItem(API_KEY_STORAGE_KEY, finalApiKey);
				localStorage.setItem(AI_URL_STORAGE_KEY, newAiUrl);
				localStorage.setItem(
					MODEL_STORAGE_KEY,
					newModel === "custom" ? customModel : newModel,
				);

				currentApiKey = finalApiKey;
				currentAiUrl = newAiUrl;
				currentModel = newModel === "custom" ? customModel : newModel;
			}

			updateApiKeyStatusUI();
			configDialog.classList.remove("active");

			// Clear form
			apiKeyInput.value = "";
			$("#api-url").value = "";
			$("#ai-model").value = "";
			$("#custom-model").value = "";

			showNotification(
				"AI Settings saved successfully!",
				NotificationTypes.SUCCESS,
				"Success",
			);
		} catch (error) {
			console.error("Error saving AI settings:", error);
			showNotification(error.message, NotificationTypes.ERROR, "Save Error");
		} finally {
			// Restore button state
			saveBtn.textContent = originalBtnText;
			saveBtn.disabled = false;
		}
	});

	function updateApiKeyStatusUI() {
		if (modeToggles.length > 0) {
			// If mode toggles exist, show status based on mode
			if (userMode === "local") {
				if (currentApiKey) {
					apiKeyStatusText.textContent = "Local Mode - API Key Configured";
					$(".dot", apiKeyStatus).classList.remove("not-configured");
					$(".dot", apiKeyStatus).classList.add("configured");
					sendBtn.disabled = false;
				} else {
					apiKeyStatusText.textContent = "Local Mode - API Key Not Configured";
					$(".dot", apiKeyStatus).classList.remove("configured");
					$(".dot", apiKeyStatus).classList.add("not-configured");
					sendBtn.disabled = true;
				}
			} else {
				// Cloud mode
				if (authToken) {
					const username = localStorage.getItem(USERNAME_STORAGE_KEY) || "User";
					apiKeyStatusText.textContent = `Cloud Mode - ${username}`;
					$(".dot", apiKeyStatus).classList.remove("not-configured");
					$(".dot", apiKeyStatus).classList.add("configured");
					sendBtn.disabled = false;
				} else {
					apiKeyStatusText.textContent = "Cloud Mode - Not Authenticated";
					$(".dot", apiKeyStatus).classList.remove("configured");
					$(".dot", apiKeyStatus).classList.add("not-configured");
					sendBtn.disabled = true;
				}
			}
		} else {
			// If no mode toggles, just check for API key
			if (currentApiKey) {
				apiKeyStatusText.textContent = "API Key Configured";
				$(".dot", apiKeyStatus).classList.remove("not-configured");
				$(".dot", apiKeyStatus).classList.add("configured");
				sendBtn.disabled = false;
			} else {
				apiKeyStatusText.textContent = "API Key Not Configured";
				$(".dot", apiKeyStatus).classList.remove("configured");
				$(".dot", apiKeyStatus).classList.add("not-configured");
				sendBtn.disabled = true;
			}
		}
	}

	// --- Chat Logic Functions ---
	function createMessageGroup(_messageText) {
		// Create message group container
		const messageGroup = document.createElement("div");
		messageGroup.classList.add("message-group");

		return messageGroup;
	}

	function addMessageToChat(_sender, content, type) {
		let messageGroup;

		// For user messages, create a new message group
		if (type === "user") {
			_lastUserMessage = content;
			messageGroup = createMessageGroup(content);
			chatMessages.appendChild(messageGroup);
		}

		const messageDiv = document.createElement("div");
		messageDiv.classList.add("message", type);

		const iconDiv = document.createElement("div");
		iconDiv.classList.add("message-icon");
		iconDiv.textContent = type === "user" ? "😊" : "🤖";

		const contentDiv = document.createElement("div");
		contentDiv.classList.add("message-content");

		const messageText = document.createElement("div");
		messageText.classList.add("message-text");
		messageText.textContent = content;

		contentDiv.appendChild(messageText);
		messageDiv.appendChild(iconDiv);
		messageDiv.appendChild(contentDiv);

		// Add to the current message group or create one if needed
		if (type === "user") {
			messageGroup.appendChild(messageDiv);
		} else {
			// Find the last message group or create one
			const lastGroup = chatMessages.querySelector(".message-group:last-child");
			if (lastGroup) {
				lastGroup.appendChild(messageDiv);
			} else {
				// Create a group for assistant responses without a preceding question
				const assistantGroup = document.createElement("div");
				assistantGroup.classList.add("message-group");
				assistantGroup.appendChild(messageDiv);
				chatMessages.appendChild(assistantGroup);
			}
		}

		// Smooth scroll to bottom
		chatMessages.scrollTop = chatMessages.scrollHeight;

		// Update sticky header visibility after DOM update
		setTimeout(updateStickyHeaders, 100);
	}

	function setTypingIndicator(show) {
		typingIndicator.classList.toggle("active", show);
		if (show) {
			chatMessages.appendChild(typingIndicator);
			chatMessages.scrollTop = chatMessages.scrollHeight;
		}
	}

	// Sticky header scroll handling
	function updateStickyHeaders() {
		const header = $(".question-header");
		if (!header || header.classList.contains("hidden")) return;

		const _chatContainerRect = chatMessages.getBoundingClientRect();
		const _headerRect = header.getBoundingClientRect();

		// Show/hide based on scroll position
		const shouldHide = chatMessages.scrollTop > 100;
		header.style.opacity = shouldHide ? "1" : "0.9";
	}

	// Enhanced scroll handling for sticky headers
	chatMessages.addEventListener("scroll", () => {
		updateStickyHeaders();

		// Auto-hide typing indicator when scrolling up
		if (
			chatMessages.scrollTop <
			chatMessages.scrollHeight - chatMessages.clientHeight - 100
		) {
			// User is scrolling up, typing indicator should be hidden
			$(".question-header")?.classList.add("hidden");
		}
	});

	async function sendMessage() {
		const userMessageText = messageInput.value.trim();
		if (!userMessageText) return;

		// Check if user is authenticated and in the right mode
		if (modeToggles.length > 0) {
			// With mode toggles, check based on current mode
			if (userMode === "local" && !currentApiKey) {
				showNotification(
					"Please configure your AI API Key first.",
					NotificationTypes.WARNING,
					"API Key Required",
				);
				// Open config dialog automatically
				if (openConfigBtn) {
					openConfigBtn.click();
				}
				return;
			} else if (userMode === "cloud" && !authToken) {
				showNotification(
					"Please authenticate in cloud mode first.",
					NotificationTypes.WARNING,
					"Authentication Required",
				);
				// Open config dialog automatically
				if (openConfigBtn) {
					openConfigBtn.click();
				}
				return;
			}
		} else {
			// Without mode toggles, just check for API key
			if (!currentApiKey) {
				showNotification(
					"Please configure your AI API Key first.",
					NotificationTypes.WARNING,
					"API Key Required",
				);
				// Open config dialog automatically
				if (openConfigBtn) {
					openConfigBtn.click();
				}
				return;
			}
		}

		addMessageToChat("You", userMessageText, "user");
		messageInput.value = "";
		setTypingIndicator(true);
		sendBtn.disabled = true;

		// Hide any previous sticky headers (keep only current one visible)
		$$(".question-header").forEach((header) => {
			if (header !== currentMessageGroup) {
				header.classList.add("hidden");
			}
		});

		try {
			let reply;

			// Direct API call to AI service if in local mode
			if (userMode === "local") {
				try {
					// Determine if this is an OpenAI-compatible API or requires different key handling
					const isStandardOpenAIAPI =
						currentAiUrl.includes("openai.com") ||
						currentAiUrl.includes("api.openai.com");

					const requestBody = {
						model: currentModel,
						messages: [{ role: "user", content: userMessageText }],
						max_tokens: 150,
						temperature: 0.7,
					};

					// For some APIs like MiniMax, Anthropic, etc., the API key might need to be in the request body
					if (!isStandardOpenAIAPI) {
						requestBody.api_key = currentApiKey;
					}

					const requestHeaders = {
						"Content-Type": "application/json",
					};

					// Only add Authorization header for OpenAI-style APIs
					if (isStandardOpenAIAPI) {
						requestHeaders.Authorization = `Bearer ${currentApiKey}`;
					} else {
						// For other APIs, use specific header if needed
						if (currentAiUrl.includes("minimax")) {
							requestHeaders.Authorization = `Bearer ${currentApiKey}`;
						} else if (currentAiUrl.includes("anthropic")) {
							requestHeaders["x-api-key"] = currentApiKey;
							requestHeaders["anthropic-version"] = "2023-06-01";
						} else {
							// Default to Authorization header if no specific format is known
							requestHeaders.Authorization = `Bearer ${currentApiKey}`;
						}
					}

					const aiResponse = await fetch(currentAiUrl, {
						method: "POST",
						headers: requestHeaders,
						body: JSON.stringify(requestBody),
					});

					if (!aiResponse.ok) {
						const errorData = await aiResponse.json().catch(() => ({
							error: {
								message: `HTTP ${aiResponse.status}: ${aiResponse.statusText}`,
							},
						}));
						throw new Error(
							errorData.error?.message ||
								`AI API request failed with status: ${aiResponse.status}`,
						);
					}

					const aiData = await aiResponse.json();
					reply =
						aiData.choices?.[0]?.message?.content?.trim() ||
						"AI did not provide a response.";
				} catch (networkError) {
					// Handle network errors (e.g., DNS resolution failure, network connectivity issues)
					if (
						networkError instanceof TypeError &&
						networkError.message.includes("fetch")
					) {
						throw new Error(
							`Network error: Unable to reach ${currentAiUrl}. Please check your API URL and network connection.`,
						);
					} else {
						throw networkError;
					}
				}
			} else {
				// Use backend API for cloud mode
				const response = await fetch("/api/ai-chat", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						message: userMessageText,
						useCloud: true,
						authToken: authToken,
					}),
				});

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(`AI API request failed: ${errorText}`);
				}

				const data = await response.json();

				if (data.error) {
					throw new Error(data.error);
				}

				reply = data.reply;
			}

			addMessageToChat("AI", reply, "assistant");
		} catch (error) {
			console.error("Error communicating with AI:", error);
			addMessageToChat("System", `Error: ${error.message}`, "assistant");
		} finally {
			setTypingIndicator(false);
			sendBtn.disabled = false;
		}
	}

	// Event Listeners for sending messages
	sendBtn.addEventListener("click", sendMessage);

	messageInput.addEventListener("keypress", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});

	// Auto-resize textarea functionality
	messageInput.addEventListener("input", () => {
		messageInput.style.height = "auto";
		messageInput.style.height = `${Math.min(messageInput.scrollHeight, 120)}px`;
	});

	// Close dialog on Escape key
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && configDialog.classList.contains("active")) {
			configDialog.classList.remove("active");
			apiKeyInput.value = "";
		}
	});

	// Welcome message
	if (chatMessages.children.length === 0) {
		setTimeout(() => {
			addMessageToChat(
				"System",
				"Welcome to bun-ws AI Chat! Please configure your AI API Key to start chatting.",
				"assistant",
			);
		}, 300);
	}

	// Prevent zoom on input focus (mobile)
	messageInput.addEventListener("touchstart", (_e) => {
		if (window.innerWidth <= 768) {
			document.body.style.fontSize = "16px";
		}
	});

	// Focus input on load
	setTimeout(() => {
		messageInput.focus();
	}, 100);
});

// Utility function for external use (if needed)
window.scrollToBottom = () => {
	const chatMessages = $("#chat-messages");
	if (chatMessages) {
		chatMessages.scrollTop = chatMessages.scrollHeight;
	}
};

// Export theme functions for potential external use
window.toggleTheme = () => {
	const themeToggle = $("#theme-toggle");
	if (themeToggle) {
		themeToggle.click();
	}
};
