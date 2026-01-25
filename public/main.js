// Utility functions for DOM selection
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Helper function to update all configuration elements
function updateConfigElements(backendConfig) {
    $('#uuid').textContent = backendConfig.UUID || 'Unknown';
    $('#ws-path').textContent = backendConfig.WSPATH || '/';
    $('#sub-path').textContent = backendConfig.SUB_PATH || '/';
    $('#domain').textContent = backendConfig.DOMAIN || 'Unknown';
    $('#backend-port').textContent = backendConfig.PORT || 'Unknown';
    $('#isp').textContent = backendConfig.isp || 'Unknown';
}

// Helper function to set all elements to error state
function setErrorState(errorMessage) {
    $('#uuid').textContent = 'API Error';
    $('#ws-path').textContent = 'API Error';
    $('#sub-path').textContent = 'API Error';
    $('#domain').textContent = 'API Error';
    $('#backend-port').textContent = 'API Error';
    $('#isp').textContent = 'API Error';
    if (errorMessage) {
        $('#subscription-url').textContent = errorMessage;
    }
}

// Helper function to update server status
function updateServerStatus(isRunning) {
    const statusElement = $('#server-status');
    if (isRunning) {
        statusElement.innerHTML = '<div class="status-dot"></div>Server Running';
        statusElement.classList.remove('unknown');
    } else {
        statusElement.innerHTML = '<div class="status-dot"></div>Server Unknown';
        statusElement.classList.add('unknown');
    }
}

// Get current host information (moved into getCurrentServerAddress())
// Optimize port inference: if the port is empty, and the protocol is https, the port is usually 443
// If the port is empty, and the protocol is http, the port is usually 80 (but when deployed to bun-ws, the internal port might be 8333)
// So do the following: if the port is empty, we try to use 443 as the TLS/HTTPS standard port, and 8333 for development.

// Update config information using the getCurrentServerAddress() helper
$('#server-address').textContent = getCurrentServerAddress();

// 2. Function to fetch backend configuration from API
// We need to derive the SUB_PATH for the API endpoint itself.
// For this, we'll try to guess it based on a default UUID or a previously known one.
// If the SUB_PATH we guess is wrong, the fetch will likely fail (404).
const DEFAULT_UUID = '8ea48d91-eab2-4dfa-9169-859b0d43b3dc'; // Fallback UUID if not known
let derivedSubPath = DEFAULT_UUID.slice(9, 13); // Derive SUB_PATH from the fallback UUID

// If we received a UUID from a previous successful call (e.g., stored in a variable or localStorage),
// we could try to use that for a more accurate derivation.
// For simplicity, we will always use the DEFAULT_UUID to derive the path for the first attempt.
// This means if the server's UUID is not the default one, the first call might fail.
const configApiUrl = `/${derivedSubPath}-json`;

async function fetchBackendConfig() {
    try {
        const response = await fetch(configApiUrl);
        
        if (!response.ok) {
            // Provide more specific error messages for common issues like 404 due to incorrect SUB_PATH
            if (response.status === 404) {
                throw new Error(`Failed to fetch config from ${configApiUrl}! Status: ${response.status}. Server might be offline or using a different UUID configuration.`);
            }
            throw new Error(`Failed to fetch config from ${configApiUrl}! status: ${response.status}`);
        }
        
        const backendConfig = await response.json();
        
        // Update DOM elements with the fetched config
        updateConfigElements(backendConfig);
        
        // Return the config for use in other parts of the script, e.g., subscriptionUrl
        return backendConfig;
    } catch (error) {
        console.error('Error fetching backend configuration:', error);
        // If API fails, display fallback/default values
        setErrorState();
        
        // Update server status to unknown (orange)
        updateServerStatus(false);
        
        // Throw the error so that subscriptionUrl generation can also handle it if needed
        throw error; 
    }
}

// Call the async function and handle the returned config
fetchBackendConfig()
    .then(backendConfig => {
        // If fetch was successful, backendConfig will hold the data
        // Update ISP from the config fetched
        $('#isp').textContent = backendConfig.isp || 'Unknown';

        // Update Backend Port from the config fetched
        $('#backend-port').textContent = backendConfig.PORT || 'Unknown';
        
        // Re-generate subscriptionUrl using the fetched config data
        const serverAddress = getCurrentServerAddress(); // Assuming getCurrentServerAddress() correctly determines address/port
        const subscriptionPathFromApi = backendConfig.SUB_PATH;
        const subscriptionUrl = `${window.location.protocol}//${serverAddress}/${subscriptionPathFromApi}`;
        $('#subscription-url').textContent = subscriptionUrl;
        
        // Log success
        // console.log('Backend config loaded successfully:', backendConfig);

        // Update server status to running (green) as API call was successful
        updateServerStatus(true);
    })
    .catch(error => {
        // If fetch failed, the catch block inside fetchBackendConfig already displayed error messages for basic config items.
        // Here, we can set a fallback subscription URL or an error message
        const serverAddress = getCurrentServerAddress(); // Assuming getCurrentServerAddress() correctly determines address/port for fallback
        setErrorState(`API Error: Cannot load subscription URL from ${configApiUrl}`);
        console.error('Failed to setup subscription URL and ISP due to config fetch error:', error);
    });

// Modified getCurrentServerAddress() if it doesn't exist or needs adjustment
function getCurrentServerAddress() {
    const currentHost = window.location.hostname;
    let currentPort = window.location.port;

    if (!currentPort) {
        if (window.location.protocol === 'https:') {
            currentPort = '443';
        } else if (currentHost === 'localhost' || currentHost.startsWith('127.')) {
            currentPort = '8333'; // Assume local development port is 8333
        } else {
            currentPort = '80'; // Production environment assumes standard HTTP port, but the actual mapping might be different.
        }
    }

    return currentHost === 'localhost' ?
        `localhost:${currentPort}` :
        `${currentHost}:${currentPort}`;
}


// Copy subscription link functionality
async function copySubscription() {
    const subscriptionText = $('#subscription-url').textContent;
    
    try {
        await navigator.clipboard.writeText(subscriptionText);
        const copyBtn = $('.copy-btn');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✅ Copied!';
        copyBtn.classList.add('success');
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.classList.remove('success');
        }, 2000);
    } catch (err) {
        // Fallback to traditional copy method
        const textArea = document.createElement('textarea');
        textArea.value = subscriptionText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        const copyBtn = $('.copy-btn');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✅ Copied!';
        copyBtn.classList.add('success');
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.classList.remove('success');
        }, 2000);
    }
}

// Smooth scrolling for anchor links
$$('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = $(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Click subscription link card to open subscription page/section
const subscriptionCard = $('.subscription-section');
if (subscriptionCard) {
    subscriptionCard.addEventListener('click', (e) => {
        // If clicking on the subscription-url itself or the copy button, do nothing to maintain its original functionality
        if (e.target.closest('#subscription-url')) {
            // Allow the #subscription-url click to be handled by the specific event listener below
            return;
        }
        if (e.target.closest('.copy-btn')) {
            // Allow the copy button's default behavior
            return;
        }
        subscriptionCard.scrollIntoView({
            behavior: 'smooth'
        });
    });
}

// Make the subscription URL itself clickable to open the link
const subscriptionUrlElement = $('#subscription-url');
if (subscriptionUrlElement) {
    subscriptionUrlElement.style.cursor = 'pointer'; // Add cursor style to indicate it's clickable
    subscriptionUrlElement.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent the click from bubbling up to subscriptionCard's listener
        const urlToOpen = subscriptionUrlElement.textContent;
        if (urlToOpen) {
            window.open(urlToOpen, '_blank', 'noopener,noreferrer'); // Open link in new tab/window, recommended for external links
            // Or use window.location.href = urlToOpen; to open in the current tab
        }
    });
}

// Navigation bar scroll effect
window.addEventListener('scroll', () => {
    const nav = $('nav');
    if (window.scrollY > 100) {
        nav.style.background = 'rgba(5, 8, 20, 0.8)';
        nav.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
    } else {
        nav.style.background = 'rgba(5, 8, 20, 0.6)';
        nav.style.boxShadow = 'none';
    }
});

// 4. Function for manual config loading
async function loadConfigFromInput() {
    const inputField = $('#manual-sub-path');
    const userInputSubPath = inputField.value.trim();

    if (!userInputSubPath) {
        alert('Please enter a subscription path.');
        return;
    }

    const configApiUrl = `/${userInputSubPath}-json`;
    
    // Display a loading state
    $('#uuid').textContent = 'Loading...';
    $('#ws-path').textContent = 'Loading...';
    $('#sub-path').textContent = 'Loading...';
    $('#domain').textContent = 'Loading...';
    $('#backend-port').textContent = 'Loading...';
    $('#isp').textContent = 'Loading...';
    $('#subscription-url').textContent = `Loading for ${configApiUrl}...`;

    try {
        const response = await fetch(configApiUrl);

        if (!response.ok) {
            updateServerStatus(false);
            if (response.status === 404) {
                // Update server status to unknown (orange) before throwing error
                throw new Error(`Failed to fetch config from ${configApiUrl}! Status: ${response.status}. Please check if the Subscription Path is correct.`);
            }
            // Update server status to unknown (orange) before throwing error
            // updateServerStatus(false);
            throw new Error(`Failed to fetch config from ${configApiUrl}! status: ${response.status}`);
        }

        const backendConfig = await response.json();

        // Update DOM elements with the fetched config
        updateConfigElements(backendConfig);

        // Update subscription link
        const serverAddress = getCurrentServerAddress();
        const subscriptionUrl = `${window.location.protocol}//${serverAddress}/${backendConfig.SUB_PATH}`;
        $('#subscription-url').textContent = subscriptionUrl;

        // Update server status to running (green) as API call was successful
        updateServerStatus(true);
        
        console.log('Config loaded successfully from manual input:', backendConfig);
    } catch (error) {
        console.error('Error loading config from manual input:', error);
        setErrorState(`Error for ${configApiUrl}`);
        
        // Alert user about the error for immediate feedback
        alert(error.message);
    }
}

// Page load animation
document.addEventListener('DOMContentLoaded', () => {
    const cards = $$('.card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 200 + index * 100);
    });
});