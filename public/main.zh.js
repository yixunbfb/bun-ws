// 添加简化的选择器助手函数
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Helper function to update all configuration elements
function updateConfigElements(backendConfig) {
    $('#uuid').textContent = backendConfig.UUID || '未知';
    $('#ws-path').textContent = backendConfig.WSPATH || '/';
    $('#sub-path').textContent = backendConfig.SUB_PATH || '/';
    $('#domain').textContent = backendConfig.DOMAIN || '未知';
    $('#backend-port').textContent = backendConfig.PORT || '未知';
    $('#isp').textContent = backendConfig.isp || '未知';
}

// Helper function to set all elements to error state
function setErrorState(errorMessage) {
    $('#uuid').textContent = 'API 错误';
    $('#ws-path').textContent = 'API 错误';
    $('#sub-path').textContent = 'API 错误';
    $('#domain').textContent = 'API 错误';
    $('#backend-port').textContent = 'API 错误';
    $('#isp').textContent = 'API 错误';
    if (errorMessage) {
        $('#subscription-url').textContent = errorMessage;
    }
}

// Helper function to update server status
function updateServerStatus(isRunning) {
    const statusElement = $('#server-status');
    if (isRunning) {
        statusElement.innerHTML = '<div class="status-dot"></div>服务器运行中';
        statusElement.classList.remove('unknown');
    } else {
        statusElement.innerHTML = '<div class="status-dot"></div>服务器未知';
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
                throw new Error(`无法从 ${configApiUrl} 获取配置！状态: ${response.status}。服务器可能已离线或使用不同的 UUID 配置。`);
            }
            throw new Error(`无法从 ${configApiUrl} 获取配置！状态: ${response.status}`);
        }
        
        const backendConfig = await response.json();
        
        // Update DOM elements with the fetched config
        updateConfigElements(backendConfig); 

        // Return the config for use in other parts of the script, e.g., subscriptionUrl
        return backendConfig;
    } catch (error) {
        console.error('获取后端配置时出错:', error);
        // If API fails, display fallback/default values
        setErrorState();
        
        // Update server status to unknown (orange)
        updateServerStatus(false);
        
        // Throw the error so that subscriptionUrl generation can also handle it if needed
        throw error; 
    }
}

// Call the async function and handle the returned config
fetchBackendConfig().then(backendConfig => {
    // This block will execute ONLY if fetchBackendConfig is successful
    // If fetchBackendConfig fails, the catch block in the function will handle it,
    // preventing this 'then' block from executing and subsequently updateSubscriptionUrl()
    
    // After successful call, update the derivedSubPath to use the correct one from the backend
    derivedSubPath = backendConfig.SUB_PATH;
    
    // 3. Generate subscription URL and display it
    // We only generate/update the subscription URL when backendConfig is received successfully.
    // If backendConfig fails, we will not update the URL and it will show the default hardcoded one or previous error state.
    updateSubscriptionUrl(backendConfig); 

    // Update server status to running (green) as API call was successful
    updateServerStatus(true);
    
    
}).catch(error => {
    // 如果在 fetchBackendConfig 或 updateSubscriptionUrl 中发生错误，会在这里捕获
    console.error('初始化配置时出错:', error);
    
        // 设置默认的 API 错误显示
        setErrorState('配置获取失败');
});

// Get current server address function
function getCurrentServerAddress() {
    let host = window.location.hostname;
    let port = window.location.port;

    // 特殊处理: 如果端口为空，且协议为 https，则端口通常为 443
    if (!port) {
        if (window.location.protocol === 'https:') {
            port = '443';
        } else if (window.location.protocol === 'http:') {
            // 对于 HTTP，在 bun-ws 部署时内部端口可能为 8333
            // 但在本地开发时通常为 80 (如果未指定)
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                port = '8333'; // bun-ws 的默认开发端口
            } else {
                port = '80';
            }
        }
    }

    // 优化显示: 如果端口是标准端口 (80 for http, 443 for https)，则在显示时省略端口
    if (
        (port === '80' && window.location.protocol === 'http:') ||
        (port === '443' && window.location.protocol === 'https:')
    ) {
        return host; // 返回不带端口的主机名
    } else {
        return `${host}:${port}`; // 返回带端口的主机名
    }
}

function updateSubscriptionUrl(backendConfig) {
    try {
        const serverAddress = getCurrentServerAddress();
        // 使用从后端配置获得的 SUB_PATH，而不是从 DEFAULT_UUID 推导出的路径
        const subscriptionUrl = `${window.location.protocol}//${serverAddress}/${backendConfig.SUB_PATH}`;
        document.getElementById('subscription-url').textContent = subscriptionUrl;
    } catch (error) {
        console.error('更新订阅链接时出错:', error);
        document.getElementById('subscription-url').textContent = '生成链接失败';
    }
}

// Copy subscription link functionality
async function copySubscription() {
    const subscriptionText = document.getElementById('subscription-url').textContent;
    
    try {
        await navigator.clipboard.writeText(subscriptionText);
        const copyBtn = $('.copy-btn');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✅ 已复制!';
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
        copyBtn.innerHTML = '✅ 已复制!';
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
    subscriptionCard.addEventListener('click', function() {
        const subscriptionSection = $('#subscription');
        if (subscriptionSection) {
            subscriptionSection.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
}

// Manual config load functionality
async function loadConfigFromInput() {
    const inputField = $('#manual-sub-path');
    const userInputSubPath = inputField.value.trim();

    if (!userInputSubPath) {
        alert('请输入订阅路径。');
        return;
    }

    const configApiUrl = `/${userInputSubPath}-json`;
    
    // Display a loading state
    $('#uuid').textContent = '加载中...';
    $('#ws-path').textContent = '加载中...';
    $('#sub-path').textContent = '加载中...';
    $('#domain').textContent = '加载中...';
    $('#backend-port').textContent = '加载中...';
    $('#isp').textContent = '加载中...';
    $('#subscription-url').textContent = `正在加载 ${configApiUrl}...`;

    try {
        const response = await fetch(configApiUrl);

        if (!response.ok) {
            if (response.status === 404) {
                // API 调用失败，更新服务器状态为未知 (橙色)，然后再抛出错误
                updateServerStatus(false);
                throw new Error(`无法从 ${configApiUrl} 获取配置！状态: ${response.status}。请检查订阅路径是否正确。`);
            }
            // API 调用失败，更新服务器状态为未知 (橙色)，然后再抛出错误
            updateServerStatus(false);
            throw new Error(`无法从 ${configApiUrl} 获取配置！状态: ${response.status}`);
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
        
        console.log('配置加载成功:', backendConfig);
    } catch (error) {
        console.error('加载配置时出错:', error);
        setErrorState(`错误: ${configApiUrl}`);
        
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