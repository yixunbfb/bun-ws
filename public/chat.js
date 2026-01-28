// DOM Utility functions (ensure they are available)
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => context.querySelectorAll(selector);

// Theme management functions
const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        this.setTheme(savedTheme);
        this.setupEventListeners();
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.updateToggleButton(theme);
    },

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    },

    updateToggleButton(theme) {
        const themeToggle = $('#theme-toggle');
        const themeIcon = themeToggle?.querySelector('.theme-icon');
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    },

    setupEventListeners() {
        const themeToggle = $('#theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme manager
    ThemeManager.init();

    const chatViewContainer = $('#chat-view');
    const mainContent = $('.main-content .container'); // The original content container
    const navChatLink = $('#nav-chat-link'); // Link in the navigation

    let chatUIInjected = false; // Flag to ensure chat UI is only injected once

    // --- Chat UI HTML Template ---
    // This is the HTML structure from the original chat.html
    const chatUIHTML = `
        <header class="chat-header">
            <div class="container" style="display: flex; justify-content: space-between; align-items: center;">
                <h1 style="display: flex; align-items: center; gap: 0.5rem; margin: 0;">
                    <span id="back-to-main-btn" style="font-size: 1.5rem; cursor: pointer; opacity: 0.7; transition: opacity 0.3s ease;" title="Back to Main">←</span>
                    bun-ws AI Chat
                </h1>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span class="api-key-status" id="api-key-status">
                        <span class="dot not-configured"></span>
                        <span id="api-key-status-text">API Key Not Configured</span>
                    </span>
                    <button class="config-btn" id="open-config-btn">
                        ⚙️ Configure Key
                    </button>
                </div>
            </div>
        </header>

        <main class="chat-container">
            <div id="chat-messages">
                <!-- Messages will be added here dynamically -->
            </div>

            <div class="typing-indicator" id="typing-indicator">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
                AI is typing...
            </div>

            <div class="input-area">
                <input type="text" id="message-input" placeholder="Type your message here..." />
                <button class="send-btn" id="send-btn" disabled>➤</button>
            </div>
        </main>

        <!-- API Key Configuration Dialog -->
        <div class="dialog-overlay" id="config-dialog">
            <div class="dialog-content">
                <h2>Configure AI API Key</h2>
                <p>Enter your OpenAI API key to enable AI chat functionality. This key will be stored locally in your browser.</p>
                <form id="config-form">
                    <div class="form-group">
                        <label for="api-key">API Key</label>
                        <input type="password" id="api-key" placeholder="sk-..." autocomplete="off" />
                    </div>
                    <div class="dialog-actions">
                        <button type="button" class="btn-cancel" id="cancel-config-btn">Cancel</button>
                        <button type="submit" class="btn-save">Save</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // --- View Management Functions ---
    function showChatView() {
        if (!chatUIInjected) {
            chatViewContainer.innerHTML = chatUIHTML;
            chatUIInjected = true;
            initializeChatComponents(); // Initialize chat event listeners after injection
        }
        chatViewContainer.classList.remove('hidden');
        // Hide all direct children of .main-content .container except #chat-view
        $$('> *:not(#chat-view)', mainContent).forEach(el => el.classList.add('hidden'));
        document.body.classList.add('chat-active'); // Add class to body for global styles
        chatViewContainer.querySelector('#message-input').focus(); // Focus input for immediate typing
    }

    function hideChatView() {
        chatViewContainer.classList.add('hidden');
        $$('> *:not(#chat-view)', mainContent).forEach(el => el.classList.remove('hidden'));
        document.body.classList.remove('chat-active');
    }

    // --- Chat Component Initialization & Logic ---
    function initializeChatComponents() {
        // These elements are now available after injection
        const messageInput = $('#message-input', chatViewContainer);
        const sendBtn = $('#send-btn', chatViewContainer);
        const chatMessages = $('#chat-messages', chatViewContainer);
        const configDialog = $('#config-dialog', chatViewContainer);
        const openConfigBtn = $('#open-config-btn', chatViewContainer);
        const cancelConfigBtn = $('#cancel-config-btn', chatViewContainer);
        const configForm = $('#config-form', chatViewContainer);
        const apiKeyInput = $('#api-key', chatViewContainer);
        const apiKeyStatus = $('#api-key-status', chatViewContainer);
        const apiKeyStatusText = $('#api-key-status-text', chatViewContainer);
        const typingIndicator = $('#typing-indicator', chatViewContainer);
        const backToMainBtn = $('#back-to-main-btn', chatViewContainer); // Back button in chat header

        // AI Settings Management with client isolation
        const SETTINGS_STORAGE_KEY = 'ai_settings_' + (window.location.hostname + window.location.pathname);
        
        // Default settings
        let currentSettings = {
            apiKey: '',
            apiUrl: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-3.5-turbo'
        };

        // Load settings from localStorage and update UI
        loadAISettings();
        updateApiKeyStatusUI();

        // AI Settings Functions
        function loadAISettings() {
            try {
                const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
                if (savedSettings) {
                    const parsed = JSON.parse(savedSettings);
                    currentSettings = { ...currentSettings, ...parsed };
                }
                
                // Also try to get server defaults
                fetch('/api/ai-settings')
                    .then(response => response.json())
                    .then(serverSettings => {
                        if (serverSettings.apiUrl && !currentSettings.apiUrl) {
                            currentSettings.apiUrl = serverSettings.apiUrl;
                        }
                        if (serverSettings.model && !currentSettings.model) {
                            currentSettings.model = serverSettings.model;
                        }
                    })
                    .catch(console.error);
            } catch (error) {
                console.error('Error loading AI settings:', error);
            }
        }

        function saveAISettings() {
            try {
                localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
                
                // Validate settings with server
                fetch('/api/ai-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: currentSettings })
                }).catch(console.error);
            } catch (error) {
                console.error('Error saving AI settings:', error);
            }
        }

        function updateSettingsUI() {
            // Update form fields
            $('#api-url', configDialog).value = currentSettings.apiUrl || '';
            $('#api-key', configDialog).value = currentSettings.apiKey || '';
            $('#ai-model', configDialog).value = currentSettings.model || 'gpt-3.5-turbo';
            
            // Show/hide custom model field
            const customModelGroup = $('#custom-model-group', configDialog);
            const customModelInput = $('#custom-model', configDialog);
            if (currentSettings.model === 'custom' && currentSettings.customModel) {
                customModelGroup.style.display = 'block';
                customModelInput.value = currentSettings.customModel || '';
            } else {
                customModelGroup.style.display = 'none';
                customModelInput.value = '';
            }
            
            // Update status display
            updateApiKeyStatusUI();
        }

        function updateApiKeyStatusUI() {
            const hasApiKey = currentSettings.apiKey && currentSettings.apiKey.length > 0;
            const hasValidUrl = currentSettings.apiUrl && currentSettings.apiUrl.startsWith('http');
            
            if (hasApiKey && hasValidUrl) {
                apiKeyStatusText.textContent = `Configured (${currentSettings.model})`;
                $('.dot', apiKeyStatus).classList.remove('not-configured');
                $('.dot', apiKeyStatus).classList.add('configured');
                sendBtn.disabled = false;
            } else {
                apiKeyStatusText.textContent = 'Settings Incomplete';
                $('.dot', apiKeyStatus).classList.remove('configured');
                $('.dot', apiKeyStatus).classList.add('not-configured');
                sendBtn.disabled = true;
            }
        }

        // --- Settings Configuration Dialog Logic ---
        openConfigBtn.addEventListener('click', () => {
            updateSettingsUI(); // Refresh UI with current settings
            configDialog.classList.add('active');
            $('#api-url', configDialog).focus();
        });

        cancelConfigBtn.addEventListener('click', () => {
            configDialog.classList.remove('active');
            // Reset form to current settings on cancel
            updateSettingsUI();
        });

        configDialog.addEventListener('click', (e) => {
            if (e.target === configDialog) {
                configDialog.classList.remove('active');
                updateSettingsUI(); // Reset form
            }
        });

        // Handle model selection change
        $('#ai-model', configDialog).addEventListener('change', function() {
            const customModelGroup = $('#custom-model-group', configDialog);
            const customModelInput = $('#custom-model', configDialog);
            
            if (this.value === 'custom') {
                customModelGroup.style.display = 'block';
                customModelInput.focus();
            } else {
                customModelGroup.style.display = 'none';
                customModelInput.value = '';
            }
        });

        configForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const newApiUrl = $('#api-url', configDialog).value.trim();
            const newApiKey = $('#api-key', configDialog).value.trim();
            const selectedModel = $('#ai-model', configDialog).value;
            const customModel = $('#custom-model', configDialog).value.trim();
            
            // Validation
            if (!newApiUrl || !newApiUrl.startsWith('http')) {
                alert('Please enter a valid API URL starting with http/https.');
                return;
            }
            
            if (!newApiKey) {
                alert('API Key cannot be empty.');
                return;
            }
            
            if (selectedModel === 'custom' && !customModel) {
                alert('Please enter a custom model name.');
                return;
            }
            
            // Update settings
            currentSettings = {
                ...currentSettings,
                apiUrl: newApiUrl,
                apiKey: newApiKey,
                model: selectedModel === 'custom' ? customModel : selectedModel,
                customModel: selectedModel === 'custom' ? customModel : undefined
            };
            
            // Save settings
            saveAISettings();
            updateApiKeyStatusUI();
            configDialog.classList.remove('active');
            
            // Clear sensitive fields
            $('#api-key', configDialog).value = '';
            addMessageToChat('System', `AI settings configured successfully! Model: ${currentSettings.model}`, 'assistant');
        });

        // --- Chat Logic Functions ---
        // Fixed question header functionality
        let fixedQuestionHeader = null;
        let lastUserMessage = null;

        function addMessageToChat(sender, content, type) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', type);

            const iconDiv = document.createElement('div');
            iconDiv.classList.add('message-icon');
            iconDiv.textContent = type === 'user' ? '😊' : '🤖';

            const bubbleDiv = document.createElement('div');
            bubbleDiv.classList.add('message-bubble');
            bubbleDiv.textContent = content;

            const timestampDiv = document.createElement('div');
            timestampDiv.classList.add('message-timestamp');
            timestampDiv.textContent = new Date().toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            messageDiv.appendChild(iconDiv);
            messageDiv.appendChild(bubbleDiv);
            messageDiv.appendChild(timestampDiv);
            chatMessages.appendChild(messageDiv);

            // Store the last user message for fixed header functionality
            if (type === 'user') {
                lastUserMessage = messageDiv;
            }

            chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom

            // Update fixed question header when new message is added
            updateFixedQuestionHeader();
        }

        function setTypingIndicator(show) {
            typingIndicator.style.display = show ? 'flex' : 'none';
        }

        // Fixed Question Header functionality
        function setupScrollListener() {
            const chatMessages = $('#chat-messages', chatViewContainer);
            const fixedHeader = $('#fixed-question-header');
            
            chatMessages.addEventListener('scroll', () => {
                updateFixedQuestionHeader();
            });
        }

        function updateFixedQuestionHeader() {
            const chatMessages = $('#chat-messages', chatViewContainer);
            const fixedHeader = $('#fixed-question-header');
            const fixedQuestionText = $('#fixed-question-text');
            const fixedQuestionTime = $('#fixed-question-time');

            if (!lastUserMessage || !fixedHeader || !fixedQuestionText || !fixedQuestionTime) {
                return;
            }

            // Check if user has scrolled up far enough to show the fixed header
            const scrollThreshold = 100; // Pixels from top before showing header
            const shouldShow = chatMessages.scrollTop > scrollThreshold && 
                             lastUserMessage.offsetTop < chatMessages.scrollTop;

            if (shouldShow) {
                // Get the question text from the last user message
                const questionText = lastUserMessage.querySelector('.message-bubble').textContent;
                const timestamp = lastUserMessage.querySelector('.message-timestamp').textContent;
                
                fixedQuestionText.textContent = questionText.length > 50 
                    ? questionText.substring(0, 50) + '...' 
                    : questionText;
                fixedQuestionTime.textContent = timestamp;
                
                fixedHeader.classList.add('active');
            } else {
                fixedHeader.classList.remove('active');
            }
        }

        async function sendMessage() {
            const userMessageText = messageInput.value.trim();
            if (!userMessageText) return;

             if (!currentSettings.apiKey || !currentSettings.apiUrl) {
                 alert('Please configure your AI settings first.');
                 return;
             }

            addMessageToChat('You', userMessageText, 'user');
            messageInput.value = ''; // Clear input
            setTypingIndicator(true); // Show typing indicator
            sendBtn.disabled = true; // Disable send button during request

            try {
                const response = await fetch('/api/ai-chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        apiKey: currentSettings.apiKey,
                        apiUrl: currentSettings.apiUrl,
                        model: currentSettings.model,
                        message: userMessageText
                    })
                });

                if (!response.ok) {
                    throw new Error(`AI API request failed with status: ${response.status}, message: ${await response.text()}`);
                }

                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                addMessageToChat('AI', data.reply, 'assistant');
            } catch (error) {
                console.error('Error communicating with AI:', error);
                addMessageToChat('System', `Error: ${error.message}`, 'assistant');
            } finally {
                setTypingIndicator(false); // Hide typing indicator
                sendBtn.disabled = false; // Re-enable send button
            }
        }

        // Event Listeners for sending messages
        sendBtn.addEventListener('click', sendMessage);

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Back to main page button listener
        backToMainBtn.addEventListener('click', hideChatView);

        // Setup scroll listener for fixed question header
        setupScrollListener();

        // Initial message to guide user (only show if chat view is active initially or injected)
        if (!chatViewContainer.classList.contains('hidden')) {
            addMessageToChat('System', 'Welcome to bun-ws AI Chat! Please configure your AI API Key to start chatting.', 'assistant');
        }
    }


    // Initial message to guide user if chat view is active (e.g., page loaded directly into chat)
    // This check is less relevant now as chat is integrated, but can be useful for direct linking
    // if (window.location.hash === '#chat' && chatUIInjected) {
    //    showChatView();
    // }
});

// Initial message to guide user if chat view is accessed somehow without injection (e.g., page loaded directly)
// This is a fallback and might not be perfectly accurate without explicit integration
// addMessageToChat('System', 'Welcome to bun-ws AI Chat! This is an integrated view.', 'assistant');
