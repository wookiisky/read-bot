// Read Bot Popup JavaScript
// Handles UI interaction and communication with the background script

// Current page URL and extracted content
let currentUrl = '';
let extractedContent = '';
let chatHistory = [];
let imageBase64 = null;

// DOM Elements
const extractedContentElem = document.getElementById('extractedContent');
const loadingIndicator = document.getElementById('loadingIndicator');
const extractionError = document.getElementById('extractionError');
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const jinaExtractBtn = document.getElementById('jinaExtractBtn');
const downloadExtractBtn = document.getElementById('downloadExtractBtn');
const readabilityExtractBtn = document.getElementById('readabilityExtractBtn');
const quickInputsContainer = document.getElementById('quickInputs');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');

// Initialize when the panel loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Side panel loaded');
  
  // Apply configured size for side panel
  await applyPanelSize();
  
  // Initial loading of content
  await loadCurrentPageData();
  
  // Load quick inputs from config
  loadQuickInputs();
  
  // Set up event listeners
  setupEventListeners();
});

// Load data for current page
async function loadCurrentPageData() {
  // Get current tab URL
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    currentUrl = tabs[0].url;
    console.log('Current URL:', currentUrl);
    
    // Show loading state
    showLoading();
    
    // Load page data from background script
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PAGE_DATA',
        url: currentUrl
      });
      
      if (response.type === 'PAGE_DATA_LOADED') {
        // Data loaded successfully
        await handlePageDataLoaded(response.data);
      } else if (response.type === 'PAGE_DATA_ERROR') {
        // Error loading data
        showExtractionError(response.error);
      }
    } catch (error) {
      console.error('Error requesting page data:', error);
      showExtractionError('Failed to communicate with the background script');
    }
  } else {
    showExtractionError('No active tab found');
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Send message button
  sendBtn.addEventListener('click', sendUserMessage);
  
  // Enter key in input box sends message
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage();
    }
  });
  
  // Export conversation
  exportBtn.addEventListener('click', exportConversation);
  
  // Clear conversation and context
  clearBtn.addEventListener('click', clearConversationAndContext);
  
  // Extraction method buttons
  jinaExtractBtn.addEventListener('click', () => reExtractContent('jina'));
  downloadExtractBtn.addEventListener('click', () => reExtractContent('downloadApi'));
  readabilityExtractBtn.addEventListener('click', () => reExtractContent('readability'));
  
  // Image paste handling
  userInput.addEventListener('paste', handleImagePaste);
  
  // Remove attached image
  removeImageBtn.addEventListener('click', removeAttachedImage);
  
  // Listen for messages from background script (for streaming LLM responses and tab changes)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LLM_STREAM_CHUNK') {
      handleStreamChunk(message.chunk);
    } else if (message.type === 'LLM_STREAM_END') {
      handleStreamEnd(message.fullResponse);
    } else if (message.type === 'LLM_ERROR') {
      handleLlmError(message.error);
    } else if (message.type === 'TAB_CHANGED' || message.type === 'TAB_UPDATED') {
      // Tab changed or updated, reload data if URL different
      if (message.url !== currentUrl) {
        console.log(`Tab changed/updated. New URL: ${message.url}`);
        currentUrl = message.url;
        loadCurrentPageData(); // Load data for the new URL without reloading the panel
      }
    }
  });
}

// Handle page data loaded from background script
async function handlePageDataLoaded(data) {
  hideLoading();
  
  if (data && data.content) {
    extractedContent = data.content;
    await displayExtractedContent(extractedContent);
  }
  
  if (data && data.chatHistory) {
    chatHistory = data.chatHistory;
    displayChatHistory(chatHistory);
  }
}

// Display the extracted content in the UI
async function displayExtractedContent(content) {
  if (!content) {
    showExtractionError('No content extracted');
    return;
  }
  
  // Display raw markdown content instead of rendering it
  extractedContentElem.innerHTML = `<pre style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(content)}</pre>`;
  
  // Apply the configured content display height
  await applyContentDisplayHeight();
}

// Helper function to escape HTML special characters
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Display chat history in the UI
function displayChatHistory(history) {
  chatContainer.innerHTML = '';
  
  if (!history || history.length === 0) {
    return;
  }
  
  history.forEach(message => {
    appendMessageToUI(message.role, message.content);
  });
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Append a new message to the chat UI
function appendMessageToUI(role, content) {
  console.log(`Appending message: role=${role}, content=${content ? content.substring(0, 50) + '...' : 'empty'}`);
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role === 'user' ? 'user-message' : 'assistant-message'}`;
  
  const roleDiv = document.createElement('div');
  roleDiv.className = 'message-role';
  roleDiv.textContent = '';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  // If this is a new assistant message (being streamed), add a placeholder
  if (role === 'assistant' && content === '') {
    contentDiv.innerHTML = '<div class="spinner"></div>';
    messageDiv.dataset.streaming = 'true';
  } else {
    // Render markdown for content
    try {
      contentDiv.innerHTML = window.marked.parse(content);
      console.log('Markdown parsed successfully');
    } catch (error) {
      console.error('Error parsing markdown:', error);
      contentDiv.textContent = content; // Fallback to plain text
    }
  }
  
  messageDiv.appendChild(roleDiv);
  messageDiv.appendChild(contentDiv);
  
  // 为assistant消息添加操作按钮
  if (role === 'assistant' && content) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'message-buttons';
    
    // 复制文本按钮
    const copyTextButton = document.createElement('button');
    copyTextButton.className = 'message-action-btn';
    copyTextButton.innerHTML = '<i class="material-icons">content_copy</i>';
    copyTextButton.title = '复制文本';
    copyTextButton.dataset.content = content;
    copyTextButton.onclick = () => copyMessageText(content);
    
    // 复制markdown按钮
    const copyMarkdownButton = document.createElement('button');
    copyMarkdownButton.className = 'message-action-btn';
    copyMarkdownButton.innerHTML = '<i class="material-icons">code</i>';
    copyMarkdownButton.title = '复制Markdown';
    copyMarkdownButton.dataset.content = content;
    copyMarkdownButton.onclick = () => copyMessageMarkdown(content);
    
    buttonContainer.appendChild(copyTextButton);
    buttonContainer.appendChild(copyMarkdownButton);
    messageDiv.appendChild(buttonContainer);
  }
  
  chatContainer.appendChild(messageDiv);
  console.log('Message added to chat container');
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  return messageDiv;
}

// Send user message to LLM
async function sendUserMessage() {
  const userMessage = userInput.value.trim();
  
  if (!userMessage) {
    return;
  }
  
  console.log('Sending user message:', userMessage);
  
  // Clear input
  userInput.value = '';
  
  // Add user message to UI
  console.log('Appending user message to UI...');
  appendMessageToUI('user', userMessage);
  console.log('User message appended to UI');
  
  // Create a placeholder for the assistant's response
  const assistantMessage = appendMessageToUI('assistant', '');
  
  // Add message to chat history (will be updated with full response later)
  chatHistory.push({ role: 'user', content: userMessage });
  
  try {
    // Get system prompt template from config
    const config = await getConfig();
    const systemPromptTemplate = config.systemPrompt;
    
    // Prepare messages array for LLM
    const messages = chatHistory.map(msg => ({ role: msg.role, content: msg.content }));
    
    console.log('Sending message to background script...');
    // Send message to background script
    await chrome.runtime.sendMessage({
      type: 'SEND_LLM_MESSAGE',
      payload: {
        messages,
        systemPromptTemplate,
        extractedPageContent: extractedContent,
        imageBase64,
        currentUrl
      }
    });
    console.log('Message sent to background script');
    
    // Clear any attached image after sending
    removeAttachedImage();
  } catch (error) {
    console.error('Error sending message:', error);
    handleLlmError('Failed to send message to LLM');
  }
}

// Handle streaming chunk from LLM
function handleStreamChunk(chunk) {
  // Find the message that's currently streaming
  const streamingMessage = chatContainer.querySelector('[data-streaming="true"] .message-content');
  
  if (streamingMessage) {
    // Remove spinner if it exists
    const spinner = streamingMessage.querySelector('.spinner');
    if (spinner) {
      spinner.remove();
    }
    
    // Append the new chunk and re-render markdown
    const currentContent = streamingMessage.innerHTML ? 
                           window.marked.parse(window.marked.parseInline(streamingMessage.innerHTML)) + chunk : 
                           chunk;
    
    streamingMessage.innerHTML = window.marked.parse(currentContent);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// Handle the end of a stream
function handleStreamEnd(fullResponse) {
  // Find the message that was streaming
  const streamingMessageContainer = chatContainer.querySelector('[data-streaming="true"]');
  
  if (streamingMessageContainer) {
    // Update the content with the full response
    const contentDiv = streamingMessageContainer.querySelector('.message-content');
    contentDiv.innerHTML = window.marked.parse(fullResponse);
    
    // Remove the streaming flag
    streamingMessageContainer.removeAttribute('data-streaming');
    
    // 为助手消息添加操作按钮
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'message-buttons';
    
    // 复制文本按钮
    const copyTextButton = document.createElement('button');
    copyTextButton.className = 'message-action-btn';
    copyTextButton.innerHTML = '<i class="material-icons">content_copy</i>';
    copyTextButton.title = '复制文本';
    copyTextButton.onclick = () => copyMessageText(fullResponse);
    
    // 复制markdown按钮
    const copyMarkdownButton = document.createElement('button');
    copyMarkdownButton.className = 'message-action-btn';
    copyMarkdownButton.innerHTML = '<i class="material-icons">code</i>';
    copyMarkdownButton.title = '复制Markdown';
    copyMarkdownButton.onclick = () => copyMessageMarkdown(fullResponse);
    
    buttonContainer.appendChild(copyTextButton);
    buttonContainer.appendChild(copyMarkdownButton);
    
    // 确保按钮被添加到正确的位置
    streamingMessageContainer.appendChild(buttonContainer);
    
    // Add to chat history (assistant response)
    chatHistory.push({ role: 'assistant', content: fullResponse });
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// Handle LLM API error
function handleLlmError(error) {
  // Find the message that was streaming, if any
  const streamingMessage = chatContainer.querySelector('[data-streaming="true"]');
  
  if (streamingMessage) {
    // Update with error
    const contentDiv = streamingMessage.querySelector('.message-content');
    contentDiv.innerHTML = `<span style="color: var(--error-color);">Error: ${error}</span>`;
    
    // Remove streaming flag
    streamingMessage.removeAttribute('data-streaming');
  } else {
    // Create a new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'chat-message assistant-message';
    errorDiv.innerHTML = `
      <div class="message-role"></div>
      <div class="message-content">
        <span style="color: var(--error-color);">Error: ${error}</span>
      </div>
    `;
    chatContainer.appendChild(errorDiv);
  }
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Re-extract content using a different method
async function reExtractContent(method) {
  console.log(`Re-extracting with ${method}`);
  showLoading();
  
  // Update active button styling
  jinaExtractBtn.classList.toggle('active', method === 'jina');
  downloadExtractBtn.classList.toggle('active', method === 'downloadApi');
  readabilityExtractBtn.classList.toggle('active', method === 'readability');
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'RE_EXTRACT_CONTENT',
      url: currentUrl,
      method: method
    });
    
    if (response.type === 'CONTENT_UPDATED') {
      // Content updated successfully
      extractedContent = response.content;
      await displayExtractedContent(extractedContent);
      hideLoading();
    } else if (response.type === 'CONTENT_UPDATE_ERROR') {
      // Error updating content
      showExtractionError(response.error);
    }
  } catch (error) {
    console.error('Error re-extracting content:', error);
    showExtractionError('Failed to communicate with the background script');
  }
}

// Load quick input buttons from config
async function loadQuickInputs() {
  try {
    const config = await getConfig();
    
    if (config && config.quickInputs && config.quickInputs.length > 0) {
      quickInputsContainer.innerHTML = '';
      
      config.quickInputs.forEach((quickInput, index) => {
        const button = document.createElement('button');
        button.className = 'quick-input-btn';
        button.textContent = quickInput.displayText;
        button.dataset.index = index;
        button.dataset.sendText = quickInput.sendText;
        
        button.addEventListener('click', () => {
          // 直接发送快捷按钮的消息
          sendQuickMessage(quickInput.displayText, quickInput.sendText);
        });
        
        quickInputsContainer.appendChild(button);
      });
    }
  } catch (error) {
    console.error('Error loading quick inputs:', error);
  }
}

// 发送快捷按钮消息的新函数
async function sendQuickMessage(displayText, sendTextTemplate) {
  // 气泡中展示原始的displayText
  const userMessage = displayText;
  
  // 清空输入框（如果有内容）
  userInput.value = '';
  
  // 将用户消息添加到UI
  console.log('Appending quick message to UI:', userMessage);
  appendMessageToUI('user', userMessage);
  
  // 创建助手回复的占位符
  const assistantMessage = appendMessageToUI('assistant', '');
  
  // 将原始消息添加到聊天历史
  chatHistory.push({ role: 'user', content: userMessage });
  
  try {
    // 获取系统提示词模板
    const config = await getConfig();
    const systemPromptTemplate = config.systemPrompt;
    
    // 替换sendText中的{CONTENT}占位符
    const actualSendText = sendTextTemplate.replace('{CONTENT}', extractedContent || '');
    
    // 准备发送给LLM的消息
    // 注意：我们使用实际替换后的文本作为最后一条消息，但UI中显示原始文本
    const messages = chatHistory.slice(0, -1).map(msg => ({ role: msg.role, content: msg.content }));
    messages.push({ role: 'user', content: actualSendText });
    
    console.log('Sending quick message to background script...');
    // 发送消息到后台脚本
    await chrome.runtime.sendMessage({
      type: 'SEND_LLM_MESSAGE',
      payload: {
        messages,
        systemPromptTemplate,
        extractedPageContent: extractedContent,
        imageBase64,
        currentUrl
      }
    });
    console.log('Quick message sent to background script');
  } catch (error) {
    console.error('Error sending quick message:', error);
    handleLlmError('Failed to send message to LLM');
  }
}

// Get config from background script
async function getConfig() {
  try {
    console.log('Popup: Requesting config from service worker...');
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CONFIG'
    });
    console.log('Popup: Received response from service worker for GET_CONFIG:', response);
    
    if (response && response.type === 'CONFIG_LOADED' && response.config) {
      return response.config;
    } else {
      console.error('Popup: Error loading config or config missing in response. Response:', response);
      return null;
    }
  } catch (error) {
    console.error('Popup: Error requesting config via sendMessage:', error);
    return null;
  }
}

// Handle image paste into the input
function handleImagePaste(e) {
  const items = e.clipboardData.items;
  
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      const reader = new FileReader();
      
      reader.onload = function(event) {
        imageBase64 = event.target.result;
        displayAttachedImage(imageBase64);
      };
      
      reader.readAsDataURL(blob);
      
      // Prevent default paste behavior for the image
      e.preventDefault();
      return;
    }
  }
}

// Display the attached image in the UI
function displayAttachedImage(dataUrl) {
  imagePreview.innerHTML = `<img src="${dataUrl}" alt="Attached image">`;
  imagePreviewContainer.classList.remove('hidden');
}

// Remove the attached image
function removeAttachedImage() {
  imagePreview.innerHTML = '';
  imagePreviewContainer.classList.add('hidden');
  imageBase64 = null;
}

// Export conversation as markdown
function exportConversation() {
  if (chatHistory.length === 0) {
    return;
  }
  
  let markdownContent = `# Read Bot Conversation\n\n`;
  markdownContent += `URL: ${currentUrl}\n\n`;
  markdownContent += `Extracted content summary:\n\`\`\`\n${extractedContent.substring(0, 300)}${extractedContent.length > 300 ? '...' : ''}\n\`\`\`\n\n`;
  markdownContent += `## Conversation\n\n`;
  
  chatHistory.forEach(message => {
    markdownContent += `### \n\n`;
    markdownContent += `${message.content}\n\n`;
  });
  
  // Create a blob and download
  const blob = new Blob([markdownContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `readbot-conversation-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// Show loading state
function showLoading() {
  loadingIndicator.classList.remove('hidden');
  extractedContentElem.classList.add('hidden');
  extractionError.classList.add('hidden');
}

// Hide loading state
function hideLoading() {
  loadingIndicator.classList.add('hidden');
  extractedContentElem.classList.remove('hidden');
}

// Show extraction error
function showExtractionError(error) {
  loadingIndicator.classList.add('hidden');
  extractedContentElem.classList.add('hidden');
  extractionError.classList.remove('hidden');
  
  // 保存错误信息但不显示，用于调试
  extractionError.dataset.errorMsg = error;
  
  // 清空现有内容
  extractionError.innerHTML = '';
  
  // 添加重试按钮
  const retryButton = document.createElement('button');
  retryButton.className = 'retry-button';
  retryButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 12h7V5l-2.35 1.35z"/>
    </svg>
  `;
  
  // 点击重试按钮时调用 readability 方法重新提取内容
  retryButton.addEventListener('click', () => {
    reExtractContent('readability');
  });
  
  extractionError.appendChild(retryButton);
}

// Apply configured panel size - updated for side panel
async function applyPanelSize() {
  try {
    const config = await getConfig();
    const panelWidth = config.panelWidth || 400; // Default width if not configured
    
    // Side panels typically have width controlled by Chrome, but we can set min-width
    document.documentElement.style.setProperty('--panel-width', `${panelWidth}px`);
    
    // Height is typically controlled by the browser window
    document.documentElement.style.height = '100%';
  } catch (error) {
    console.error('Error applying panel size:', error);
  }
}

// Apply the configured content display height
async function applyContentDisplayHeight() {
  let config = null;
  try {
    config = await getConfig();
    if (config && typeof config.contentDisplayHeight === 'number') {
      const height = config.contentDisplayHeight;
      console.log(`Popup: Applying content display height: ${height}px`);
      extractedContentElem.style.maxHeight = `${height}px`;
      extractedContentElem.style.overflowY = 'auto';
    } else {
      console.warn('Popup: Content display height settings not found, invalid, or not a number in config. Using default. Config was:', config);
      extractedContentElem.style.maxHeight = '300px';
      extractedContentElem.style.overflowY = 'auto';
    }
  } catch (error) {
    console.error('Popup: Failed to apply content display height due to an unexpected error:', error, 'Config value during error was:', config);
    extractedContentElem.style.maxHeight = '300px';
    extractedContentElem.style.overflowY = 'auto';
  }
}

// Clear conversation and context
async function clearConversationAndContext() {
  if (!currentUrl) {
    return;
  }
  
  try {
    // Clear UI
    chatContainer.innerHTML = '';
    chatHistory = [];
    
    // Send request to clear data for this URL
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_URL_DATA',
      url: currentUrl
    });
    
    if (response && response.success) {
      console.log('Data cleared successfully for URL:', currentUrl);
    } else {
      console.error('Error clearing data:', response.error);
    }
  } catch (error) {
    console.error('Error in clear conversation and context:', error);
  }
}

// 复制助手消息的纯文本
function copyMessageText(content) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = window.marked.parse(content);
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  
  navigator.clipboard.writeText(textContent)
    .then(() => showCopyToast('文本已复制到剪贴板'))
    .catch(err => console.error('复制文本失败:', err));
}

// 复制助手消息的Markdown
function copyMessageMarkdown(content) {
  navigator.clipboard.writeText(content)
    .then(() => showCopyToast('Markdown已复制到剪贴板'))
    .catch(err => console.error('复制Markdown失败:', err));
}

// 显示复制成功的提示
function showCopyToast(message) {
  // 创建toast元素
  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = message;
  
  // 添加到文档
  document.body.appendChild(toast);
  
  // 2秒后移除
  setTimeout(() => {
    toast.classList.add('fadeout');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 2000);
} 