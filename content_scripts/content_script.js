// Read Bot content script
// Runs in the context of web pages
// Handles content extraction and communication with the background script

// Store any Readability.js script we might inject
let readabilityScript = null;

// 标记页面是否已完全加载
let pageLoaded = document.readyState === 'complete';

// 监听页面加载完成事件
window.addEventListener('load', () => {
  pageLoaded = true;
  console.log('Page fully loaded');
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.type);
  
  if (message.type === 'GET_HTML_CONTENT') {
    // 检查页面是否已完全加载
    if (pageLoaded) {
      sendResponse({
        htmlContent: document.documentElement.outerHTML
      });
    } else {
      // 如果页面尚未加载完成，等待加载完成后再返回内容
      console.log('Page not fully loaded yet, waiting...');
      
      // 设置一个超时，防止无限等待
      const timeout = setTimeout(() => {
        console.log('Timeout reached, sending current HTML content');
        sendResponse({
          htmlContent: document.documentElement.outerHTML,
          warning: 'Page was not fully loaded (timeout)'
        });
      }, 5000); // 5秒超时
      
      // 监听load事件，页面加载完成后立即响应
      window.addEventListener('load', () => {
        clearTimeout(timeout);
        console.log('Page loaded, sending HTML content');
        sendResponse({
          htmlContent: document.documentElement.outerHTML
        });
      }, { once: true });
      
      return true; // 保持消息通道开放，以异步方式响应
    }
    return true;
  }
  
  if (message.type === 'EXTRACT_WITH_READABILITY') {
    try {
      // Load Readability.js if not already loaded
      if (!window.Readability) {
        // We would normally inject the script here, but for this extension
        // we'll be using the imported version in the background script
        console.log('Readability.js not available in content script.');
      }
      
      // If Readability is available, use it
      if (window.Readability) {
        const documentClone = document.cloneNode(true);
        const article = new window.Readability(documentClone).parse();
        
        sendResponse({
          title: article.title,
          content: article.content,
          textContent: article.textContent,
          excerpt: article.excerpt
        });
      } else {
        // Fallback to basic extraction
        sendResponse({
          title: document.title,
          content: document.body.innerHTML,
          textContent: document.body.innerText,
          excerpt: document.body.innerText.substring(0, 200)
        });
      }
    } catch (error) {
      console.error('Error extracting content with Readability:', error);
      sendResponse({
        error: error.message || 'Error extracting content with Readability'
      });
    }
    return true;
  }
});

// Log when the content script has loaded
console.log('Read Bot content script loaded on:', document.location.href); 