// DOM Utility functions
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => context.querySelectorAll(selector);

// Message groups for sticky headers
let currentMessageGroup = null;
let lastUserMessage = null;

// Notification System
const NotificationTypes = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

const NotificationIcons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
};

function showNotification(message, type = NotificationTypes.INFO, title = '', duration = 3000) {
    const container = $('#notification-container');
    if (!container) {
        console.error('Notification container not found');
        return;
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icon = document.createElement('div');
    icon.className = 'notification-icon';
    icon.textContent = NotificationIcons[type] || 'ℹ';

    const content = document.createElement('div');
    content.className = 'notification-content';

    if (title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'notification-title';
        titleEl.textContent = title;
        content.appendChild(titleEl);
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'notification-message';
    messageEl.textContent = message;
    content.appendChild(messageEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '×';
    closeBtn.setAttribute('aria-label', 'Close notification');

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
    closeBtn.addEventListener('click', () => {
        clearTimeout(timeoutId);
        removeNotification(notification);
    });

    return notification;
}

function removeNotification(notification) {
    if (!notification || !notification.parentElement) return;

    notification.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 300);
}

// Initialize chat functionality
document.addEventListener('DOMContentLoaded', () => {
    const messageInput = $('#message-input');
    const sendBtn = $('#send-btn');
    const chatMessages = $('#chat-messages');
    const configDialog = $('#config-dialog');
    const openConfigBtn = $('#open-config-btn');
    const cancelConfigBtn = $('#cancel-config-btn');
    const configForm = $('#config-form');
    const apiKeyInput = $('#api-key');
    const apiKeyStatus = $('#api-key-status');
    const apiKeyStatusText = $('#api-key-status-text');
    const typingIndicator = $('#typing-indicator');
    const themeToggle = $('#theme-toggle');

    // Debug: Check if critical elements exist
    if (!themeToggle) {
        console.error('Theme toggle button not found!');
    }
    if (!openConfigBtn) {
        console.error('Config button not found!');
    }
    if (!configDialog) {
        console.error('Config dialog not found!');
    }

    const API_KEY_STORAGE_KEY = 'ai_api_key';
    const AI_URL_STORAGE_KEY = 'ai_api_url';
    const MODEL_STORAGE_KEY = 'ai_model';

    // Theme management
    function loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeToggleUI(savedTheme);
    }

    function updateThemeToggleUI(theme) {
        const lightIcon = themeToggle.querySelector('.light-icon');
        const darkIcon = themeToggle.querySelector('.dark-icon');

        if (theme === 'light') {
            lightIcon.style.display = 'none';
            darkIcon.style.display = 'inline';
            themeToggle.title = 'Switch to dark mode';
        } else {
            lightIcon.style.display = 'inline';
            darkIcon.style.display = 'none';
            themeToggle.title = 'Switch to light mode';
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            console.log('Theme toggle clicked');
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeToggleUI(newTheme);
            console.log('Theme changed to:', newTheme);
        });
    }

    // Load saved theme
    loadTheme();

    // Load configuration from localStorage and update UI
    let currentApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    let currentAiUrl = localStorage.getItem(AI_URL_STORAGE_KEY) || 'https://api.openai.com/v1/chat/completions';
    let currentModel = localStorage.getItem(MODEL_STORAGE_KEY) || 'gpt-3.5-turbo';
    updateApiKeyStatusUI();

    // --- API Key Configuration Dialog Logic ---
    if (openConfigBtn) {
        openConfigBtn.addEventListener('click', () => {
            console.log('Config button clicked');
            // Pre-fill all fields with current values
            const aiUrlInput = $('#ai-url');
            const modelInput = $('#model');

            if (aiUrlInput) aiUrlInput.value = currentAiUrl || 'https://api.openai.com/v1/chat/completions';
            if (apiKeyInput) apiKeyInput.value = currentApiKey || '';
            if (modelInput) modelInput.value = currentModel || 'gpt-3.5-turbo';

            if (configDialog) {
                configDialog.classList.add('active');
                console.log('Dialog opened, active class added');
            }
            if (aiUrlInput) aiUrlInput.focus();
        });
    }

    if (cancelConfigBtn) {
        cancelConfigBtn.addEventListener('click', () => {
            console.log('Cancel button clicked');
            if (configDialog) configDialog.classList.remove('active');
            if (apiKeyInput) apiKeyInput.value = '';
        });
    }

    if (configDialog) {
        configDialog.addEventListener('click', (e) => {
            if (e.target === configDialog) {
                console.log('Dialog overlay clicked');
                configDialog.classList.remove('active');
                if (apiKeyInput) apiKeyInput.value = '';
            }
        });
    }

    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newAiUrl = $('#ai-url').value.trim();
        const newApiKey = apiKeyInput.value.trim();
        const newModel = $('#model').value.trim();

        if (!newApiKey) {
            showNotification('API Key cannot be empty.', NotificationTypes.WARNING, 'Validation Error');
            return;
        }

        // Show loading state
        const saveBtn = $('.btn-save');
        const originalBtnText = saveBtn.textContent;
        saveBtn.textContent = 'Testing...';
        saveBtn.disabled = true;

        try {
            // Test the configuration by calling the server endpoint
            const response = await fetch('/api/ai-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    settings: {
                        apiUrl: newAiUrl,
                        apiKey: newApiKey,
                        model: newModel
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to validate API settings');
            }

            // Save all settings to localStorage
            localStorage.setItem(API_KEY_STORAGE_KEY, newApiKey);
            localStorage.setItem(AI_URL_STORAGE_KEY, newAiUrl);
            localStorage.setItem(MODEL_STORAGE_KEY, newModel);
            
            // Update current variables
            currentApiKey = newApiKey;
            currentAiUrl = newAiUrl;
            currentModel = newModel;
            
            updateApiKeyStatusUI();
            configDialog.classList.remove('active');
            
            // Clear form
            apiKeyInput.value = '';
            $('#ai-url').value = '';
            $('#model').value = '';
            
            addMessageToChat('System', 'AI Settings configured successfully! ' + data.message, 'assistant');
            showNotification('AI Settings configured successfully!', NotificationTypes.SUCCESS, 'Success');
        } catch (error) {
            console.error('Error configuring AI settings:', error);
            showNotification(error.message, NotificationTypes.ERROR, 'Configuration Error');
        } finally {
            // Restore button state
            saveBtn.textContent = originalBtnText;
            saveBtn.disabled = false;
        }
    });

    function updateApiKeyStatusUI() {
        if (currentApiKey) {
            apiKeyStatusText.textContent = 'API Key Configured';
            $('.dot', apiKeyStatus).classList.remove('not-configured');
            $('.dot', apiKeyStatus).classList.add('configured');
            sendBtn.disabled = false;
        } else {
            apiKeyStatusText.textContent = 'API Key Not Configured';
            $('.dot', apiKeyStatus).classList.remove('configured');
            $('.dot', apiKeyStatus).classList.add('not-configured');
            sendBtn.disabled = true;
        }
    }

    // --- Chat Logic Functions ---
    function createMessageGroup(messageText) {
        // Create message group container
        const messageGroup = document.createElement('div');
        messageGroup.classList.add('message-group');
        
        // Create sticky header for the question
        const questionHeader = document.createElement('div');
        questionHeader.classList.add('question-header');
        questionHeader.innerHTML = `
            <span>Q: ${messageText}</span>
            <button class="hide-header-btn" title="Hide header">×</button>
        `;
        
        // Add hide functionality
        const hideBtn = questionHeader.querySelector('.hide-header-btn');
        hideBtn.addEventListener('click', () => {
            questionHeader.classList.add('hidden');
        });
        
        messageGroup.appendChild(questionHeader);
        
        // Store reference for scroll handling
        currentMessageGroup = questionHeader;
        
        return messageGroup;
    }

    function addMessageToChat(sender, content, type) {
        let messageGroup;
        
        // For user messages, create a new message group
        if (type === 'user') {
            lastUserMessage = content;
            messageGroup = createMessageGroup(content);
            chatMessages.appendChild(messageGroup);
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type);

        const iconDiv = document.createElement('div');
        iconDiv.classList.add('message-icon');
        iconDiv.textContent = type === 'user' ? '😊' : '🤖';

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        const messageText = document.createElement('div');
        messageText.classList.add('message-text');
        messageText.textContent = content;
        
        contentDiv.appendChild(messageText);
        messageDiv.appendChild(iconDiv);
        messageDiv.appendChild(contentDiv);

        // Add to the current message group or create one if needed
        if (type === 'user') {
            messageGroup.appendChild(messageDiv);
        } else {
            // Find the last message group or create one
            const lastGroup = chatMessages.querySelector('.message-group:last-child');
            if (lastGroup) {
                lastGroup.appendChild(messageDiv);
            } else {
                // Create a group for assistant responses without a preceding question
                const assistantGroup = document.createElement('div');
                assistantGroup.classList.add('message-group');
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
        typingIndicator.classList.toggle('active', show);
        if (show) {
            chatMessages.appendChild(typingIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // Sticky header scroll handling
    function updateStickyHeaders() {
        const header = $('.question-header');
        if (!header || header.classList.contains('hidden')) return;
        
        const chatContainerRect = chatMessages.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        
        // Show/hide based on scroll position
        const shouldHide = chatMessages.scrollTop > 100;
        header.style.opacity = shouldHide ? '1' : '0.9';
    }

    // Enhanced scroll handling for sticky headers
    chatMessages.addEventListener('scroll', () => {
        updateStickyHeaders();
        
        // Auto-hide typing indicator when scrolling up
        if (chatMessages.scrollTop < chatMessages.scrollHeight - chatMessages.clientHeight - 100) {
            // User is scrolling up, typing indicator should be hidden
            $('.question-header')?.classList.add('hidden');
        }
    });

    async function sendMessage() {
        const userMessageText = messageInput.value.trim();
        if (!userMessageText) return;

        if (!currentApiKey) {
            showNotification('Please configure your AI API Key first.', NotificationTypes.WARNING, 'API Key Required');
            // Open config dialog automatically
            if (openConfigBtn) {
                openConfigBtn.click();
            }
            return;
        }

        addMessageToChat('You', userMessageText, 'user');
        messageInput.value = '';
        setTypingIndicator(true);
        sendBtn.disabled = true;
        
        // Hide any previous sticky headers (keep only current one visible)
        $$('.question-header').forEach(header => {
            if (header !== currentMessageGroup) {
                header.classList.add('hidden');
            }
        });

        try {
            const response = await fetch('/api/ai-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    apiKey: currentApiKey,
                    message: userMessageText,
                    aiUrl: currentAiUrl,
                    model: currentModel
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
            setTypingIndicator(false);
            sendBtn.disabled = false;
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

    // Auto-resize textarea functionality
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    });

    // Close dialog on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && configDialog.classList.contains('active')) {
            configDialog.classList.remove('active');
            apiKeyInput.value = '';
        }
    });

    // Welcome message
    if (chatMessages.children.length === 0) {
        setTimeout(() => {
            addMessageToChat('System', 'Welcome to bun-ws AI Chat! Please configure your AI API Key to start chatting.', 'assistant');
        }, 300);
    }

    // Prevent zoom on input focus (mobile)
    messageInput.addEventListener('touchstart', (e) => {
        if (window.innerWidth <= 768) {
            document.body.style.fontSize = '16px';
        }
    });

    // Focus input on load
    setTimeout(() => {
        messageInput.focus();
    }, 100);
});

// Utility function for external use (if needed)
window.scrollToBottom = function() {
    const chatMessages = $('#chat-messages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
};

// Export theme functions for potential external use
window.toggleTheme = function() {
    const themeToggle = $('#theme-toggle');
    if (themeToggle) {
        themeToggle.click();
    }
};