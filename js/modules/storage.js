// Read Bot Storage Module
// Handles page data caching with LRU (Least Recently Used) strategy

// Create a global storage object
var storage = {};

// Storage constants
const DB_KEY_PREFIX = 'readBotCache_';
const MAX_ITEMS = 20;
const RECENT_URLS_KEY = 'readBotRecentUrls';

// Save page data (extracted content and chat history)
storage.savePageData = async function(url, data) {
  if (!url) {
    console.error('Cannot save page data: URL is empty');
    return false;
  }
  
  try {
    // Get normalized URL as key
    const key = getKeyFromUrl(url);
    
    // Save the data
    await chrome.storage.local.set({ [key]: data });
    
    // Update LRU list of URLs
    await updateRecentUrls(url);
    
    return true;
  } catch (error) {
    console.error('Error saving page data:', error);
    return false;
  }
}

// Get page data for a URL
storage.getPageData = async function(url) {
  if (!url) {
    console.error('Cannot get page data: URL is empty');
    return null;
  }
  
  try {
    // Get normalized URL as key
    const key = getKeyFromUrl(url);
    
    // Get the data
    const result = await chrome.storage.local.get(key);
    
    if (result[key]) {
      // Update LRU list of URLs (move this URL to most recent)
      await updateRecentUrls(url);
      return result[key];
    }
    
    return null;
  } catch (error) {
    console.error('Error getting page data:', error);
    return null;
  }
}

// Update chat history for a URL
storage.updateChatHistory = async function(url, newMessages) {
  if (!url) {
    console.error('Cannot update chat history: URL is empty');
    return false;
  }
  
  try {
    // Get existing page data
    const pageData = await storage.getPageData(url);
    
    if (pageData) {
      // Update chat history
      pageData.chatHistory = newMessages;
      
      // Save updated page data
      return await storage.savePageData(url, pageData);
    }
    
    return false;
  } catch (error) {
    console.error('Error updating chat history:', error);
    return false;
  }
}

// Get list of recent URLs (for LRU)
storage.getRecentUrls = async function() {
  try {
    const result = await chrome.storage.local.get(RECENT_URLS_KEY);
    return result[RECENT_URLS_KEY] || [];
  } catch (error) {
    console.error('Error getting recent URLs:', error);
    return [];
  }
}

// Clear data for a specific URL
storage.clearUrlData = async function(url) {
  if (!url) {
    console.error('Cannot clear data: URL is empty');
    return false;
  }
  
  try {
    // Get normalized URL as key
    const key = getKeyFromUrl(url);
    
    // Remove the data
    await chrome.storage.local.remove(key);
    
    // Update recent URLs list
    let recentUrls = await storage.getRecentUrls();
    recentUrls = recentUrls.filter(item => normalizeUrl(item) !== normalizeUrl(url));
    await chrome.storage.local.set({ [RECENT_URLS_KEY]: recentUrls });
    
    return true;
  } catch (error) {
    console.error('Error clearing URL data:', error);
    return false;
  }
}

// Update recent URLs list (LRU)
async function updateRecentUrls(url) {
  try {
    // Get normalized URL
    const normalizedUrl = normalizeUrl(url);
    
    // Get current list of recent URLs
    let recentUrls = await storage.getRecentUrls();
    
    // Remove the URL if it already exists
    recentUrls = recentUrls.filter(item => normalizeUrl(item) !== normalizedUrl);
    
    // Add the URL to the front of the list (most recent)
    recentUrls.unshift(url);
    
    // Trim the list if it exceeds MAX_ITEMS
    if (recentUrls.length > MAX_ITEMS) {
      // Get URLs to remove
      const urlsToRemove = recentUrls.slice(MAX_ITEMS);
      
      // Remove old data
      for (const oldUrl of urlsToRemove) {
        const oldKey = getKeyFromUrl(oldUrl);
        await chrome.storage.local.remove(oldKey);
      }
      
      // Trim the list
      recentUrls = recentUrls.slice(0, MAX_ITEMS);
    }
    
    // Save updated list
    await chrome.storage.local.set({ [RECENT_URLS_KEY]: recentUrls });
  } catch (error) {
    console.error('Error updating recent URLs:', error);
  }
}

// Normalize URL for consistency
function normalizeUrl(url) {
  try {
    // Basic normalization: trim, convert to lowercase
    return url.trim().toLowerCase();
  } catch (error) {
    console.error('Error normalizing URL:', error);
    return url; // Return original if error
  }
}

// Get storage key from URL
function getKeyFromUrl(url) {
  // Create a consistent key for storage
  return `${DB_KEY_PREFIX}${normalizeUrl(url)}`;
}

// Clear all cached data
storage.clearAllCachedData = async function() {
  try {
    // Get all keys with our prefix
    const result = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(result).filter(key => 
      key.startsWith(DB_KEY_PREFIX) || key === RECENT_URLS_KEY
    );
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing cached data:', error);
    return false;
  }
} 