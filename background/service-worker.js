// Read Bot service worker script
// Handles background processes, messaging, and coordinates between UI and functionality

// Import required modules using importScripts instead of dynamic import
importScripts('../js/modules/config_manager.js');
importScripts('../js/modules/storage.js');
importScripts('../js/modules/content_extractor.js');
importScripts('../js/modules/llm_service.js');

// Helper function to safely send messages
function safeSendMessage(message) {
  // Check if there are any listeners before sending message
  chrome.runtime.sendMessage(
    message,
    // Add a callback to catch and silence the error
    () => {
      if (chrome.runtime.lastError) {
        // Quietly handle the error - this is expected when popup is closed
        console.log('Message destination unavailable, this is normal when popup is closed');
      }
    }
  );
}

// Helper function to safely send messages to tabs
function safeSendTabMessage(tabId, message, callback) {
  chrome.tabs.sendMessage(
    tabId, 
    message,
    (response) => {
      // Handle potential error
      if (chrome.runtime.lastError) {
        console.log(`Tab message error: ${chrome.runtime.lastError.message}`);
        // Call callback with null if provided
        if (callback) callback(null);
        return;
      }
      
      // Normal case - call callback with response
      if (callback) callback(response);
    }
  );
}

// Set up event listeners when extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Read Bot extension installed or updated');
  
  // Initialize default configurations if not already set
  await configManager.initializeIfNeeded();
  
  // Initialize side panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  
  // Optional: Set up context menu items
  // chrome.contextMenus.create({
  //   id: 'readBotMain',
  //   title: 'Read Bot',
  //   contexts: ['page', 'selection']
  // });
});

// Initialize side panel when extension starts
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Tab activation listener to update side panel
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      // Notify sidebar about tab change
      safeSendMessage({ 
        type: 'TAB_CHANGED', 
        url: tab.url,
        tabId: activeInfo.tabId
      });
    }
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
});

// Tab URL change listener
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    safeSendMessage({
      type: 'TAB_UPDATED',
      url: tab.url,
      tabId: tabId
    });
  }
});

// Message handling from popup.js and content_script.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Using async function for promise handling
  const handleMessage = async () => {
    console.log('Service worker received message:', message.type);
    
    try {
      const { type, ...data } = message;
      
      switch (type) {
        case 'GET_PAGE_DATA': {
          const { url } = data;
          const cachedData = await storage.getPageData(url);
          
          if (cachedData) {
            return { type: 'PAGE_DATA_LOADED', data: cachedData };
          } else {
            // Need to extract content
            const config = await configManager.getConfig();
            const defaultMethod = config.defaultExtractionMethod;
            
            try {
              // Request content from content script if needed
              let htmlContent = null;
              if (defaultMethod === 'readability') {
                // We need HTML content from the content script
                htmlContent = await new Promise((resolve, reject) => {
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (chrome.runtime.lastError) {
                      console.error('Error querying tabs:', chrome.runtime.lastError.message);
                      return reject(new Error(chrome.runtime.lastError.message));
                    }
                    if (tabs.length === 0) {
                      console.warn('No active tab found for GET_HTML_CONTENT');
                      resolve(null);
                      return;
                    }
                    
                    safeSendTabMessage(
                      tabs[0].id, 
                      { type: 'GET_HTML_CONTENT' },
                      (response) => {
                        if (chrome.runtime.lastError) {
                           console.error('Error getting HTML from tab:', chrome.runtime.lastError.message);
                           resolve(null);
                        } else {
                           resolve(response?.htmlContent || null);
                        }
                      }
                    );
                  });
                });
              }
              
              // 确保在 readability 方法下有 HTML 内容可用
              if (defaultMethod === 'readability' && !htmlContent) {
                console.warn('HTML content not available for Readability extraction - possibly page still loading');
                return { 
                  type: 'PAGE_DATA_ERROR', 
                  error: 'page_loading' 
                };
              }
              
              const extractedContent = await contentExtractor.extract(url, htmlContent, defaultMethod, config);
              
              if (extractedContent) {
                const newPageData = { content: extractedContent, chatHistory: [] };
                await storage.savePageData(url, newPageData);
                return { type: 'PAGE_DATA_LOADED', data: newPageData };
              } else {
                return { type: 'PAGE_DATA_ERROR', error: 'Failed to extract content (content might be null or extraction failed)' };
              }
            } catch (error) {
              console.error('Error extracting content:', error);
              return { type: 'PAGE_DATA_ERROR', error: error.message || 'Failed to extract content' };
            }
          }
        }
        
        case 'RE_EXTRACT_CONTENT': {
          const { url, method } = data;
          const config = await configManager.getConfig();
          
          let htmlContent = null;
          if (method === 'readability') {
            htmlContent = await new Promise((resolve, reject) => {
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                 if (chrome.runtime.lastError) {
                    console.error('Error querying tabs:', chrome.runtime.lastError.message);
                    return reject(new Error(chrome.runtime.lastError.message));
                  }
                if (tabs.length === 0) {
                  console.warn('No active tab found for GET_HTML_CONTENT (re-extract)');
                  resolve(null);
                  return;
                }
                
                safeSendTabMessage(
                  tabs[0].id, 
                  { type: 'GET_HTML_CONTENT' },
                  (response) => {
                     if (chrome.runtime.lastError) {
                        console.error('Error getting HTML from tab (re-extract): ', chrome.runtime.lastError.message);
                        resolve(null);
                     } else {
                        resolve(response?.htmlContent || null);
                     }
                  }
                );
              });
            });
          }
          
          try {
            // 确保在 readability 方法下有 HTML 内容可用
            if (method === 'readability' && !htmlContent) {
              console.warn('HTML content not available for Readability re-extraction - possibly page still loading');
              return { 
                type: 'CONTENT_UPDATE_ERROR', 
                error: 'page_loading' 
              };
            }
            
            const extractedContent = await contentExtractor.extract(url, htmlContent, method, config);
            
            if (extractedContent) {
              const existingData = await storage.getPageData(url) || { chatHistory: [] };
              const newPageData = { 
                content: extractedContent, 
                chatHistory: existingData.chatHistory 
              };
              
              await storage.savePageData(url, newPageData);
              return { type: 'CONTENT_UPDATED', content: extractedContent };
            } else {
              return { type: 'CONTENT_UPDATE_ERROR', error: 'Failed to re-extract content' };
            }
          } catch (error) {
            console.error('Error re-extracting content:', error);
            return { type: 'CONTENT_UPDATE_ERROR', error: error.message || 'Failed to re-extract content' };
          }
        }
        
        case 'SEND_LLM_MESSAGE': {
          const { messages, systemPromptTemplate, extractedPageContent, imageBase64, currentUrl } = data.payload;
          const config = await configManager.getConfig();
          const llmConfig = {
            provider: config.llm.defaultProvider,
            ...config.llm.providers[config.llm.defaultProvider]
          };
          
          // Replace {CONTENT} placeholder in system prompt with extracted content
          const systemPrompt = systemPromptTemplate.replace('{CONTENT}', extractedPageContent || '');
          
          let assistantResponse = '';
          let error = null;
          
          try {
            // Create a stream callback to send chunks to popup
            const streamCallback = (chunk) => {
              assistantResponse += chunk;
              safeSendMessage({ type: 'LLM_STREAM_CHUNK', chunk });
            };
            
            const doneCallback = async (fullResponse) => {
              // Save to storage
              const existingData = await storage.getPageData(currentUrl) || { content: extractedPageContent, chatHistory: [] };
              
              // Extract the last user message
              const userMessage = messages[messages.length - 1].content;
              
              // Add the new exchange to chat history
              existingData.chatHistory.push(
                { role: 'user', content: userMessage },
                { role: 'assistant', content: fullResponse }
              );
              
              await storage.savePageData(currentUrl, existingData);
              
              // Signal completion to popup
              safeSendMessage({ type: 'LLM_STREAM_END', fullResponse });
            };
            
            const errorCallback = (err) => {
              error = err;
              safeSendMessage({ type: 'LLM_ERROR', error: err.message || 'Error calling LLM' });
            };
            
            // Call the LLM service
            await llmService.callLLM(
              messages, 
              llmConfig, 
              systemPrompt, 
              imageBase64, 
              streamCallback, 
              doneCallback, 
              errorCallback
            );
            
            // For synchronous response:
            return { type: 'LLM_REQUEST_RECEIVED' };
          } catch (err) {
            console.error('Error calling LLM:', err);
            return { type: 'LLM_ERROR', error: err.message || 'Error calling LLM' };
          }
        }
        
        case 'CLEAR_URL_DATA': {
          const { url } = data;
          if (!url) {
            return { success: false, error: 'No URL provided' };
          }
          
          try {
            const success = await storage.clearUrlData(url);
            return { success, error: success ? null : 'Failed to clear data' };
          } catch (error) {
            console.error('Error clearing URL data:', error);
            return { success: false, error: error.message || 'Unknown error clearing data' };
          }
        }
        
        case 'GET_CONFIG':
          return { 
            type: 'CONFIG_LOADED', 
            config: await configManager.getConfig() 
          };
          
        case 'SAVE_CONFIG':
          await configManager.saveConfig(data.config);
          return { type: 'CONFIG_SAVED' };
          
        default:
          return { type: 'UNKNOWN_MESSAGE', error: `Unknown message type: ${type}` };
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { type: 'ERROR', error: error.message || 'Unknown error in service worker' };
    }
  };
  
  // Handle async response pattern
  handleMessage().then(sendResponse).catch(error => {
    // Catch any unhandled promise rejections from handleMessage
    console.error('Unhandled error in handleMessage promise:', error);
    sendResponse({ type: 'ERROR', error: error.message || 'Critical unhandled error in service worker' });
  });
  return true; // Crucial for asynchronous sendResponse
}); 