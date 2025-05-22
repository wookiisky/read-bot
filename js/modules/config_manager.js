// Read Bot Config Manager Module
// Handles configuration loading, saving, and default values

// Create a global configManager object
var configManager = {};

// Storage key for config
const STORAGE_KEY = 'readBotConfig';

// Get default configuration
configManager.getDefaultConfig = function() {
  return {
    defaultExtractionMethod: 'readability', // 'jina', 'downloadApi'
    jinaApiKey: '',
    downloadApiEndpoint: '',
    llm: {
      defaultProvider: 'openai', // 'gemini'
      providers: {
        openai: {
          apiKey: '',
          baseUrl: 'https://api.openai.com',
          model: 'gpt-3.5-turbo'
        },
        gemini: {
          apiKey: '',
          model: 'gemini-pro' // or gemini-pro-vision for multimodal
        }
      }
    },
    systemPrompt: 'You are a helpful assistant. The user is interacting with content from a webpage. The extracted content is provided below:\n{CONTENT}\n\nAnswer the user\'s questions based on this content and your general knowledge.',
    quickInputs: [
      { displayText: '总结内容', sendText: 'Please summarize the following content:\n{CONTENT}' },
      { displayText: '提取要点', sendText: 'Extract key points from this content:\n{CONTENT}' }
    ],
    contentDisplayHeight: 300 // Default content display area height in pixels
  };
}

// Initialize configuration if needed
configManager.initializeIfNeeded = async function() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    
    if (!result[STORAGE_KEY]) {
      console.log('Initializing default config');
      await configManager.saveConfig(configManager.getDefaultConfig());
    }
  } catch (error) {
    console.error('Error initializing config:', error);
  }
}

// Get current configuration
configManager.getConfig = async function() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    
    if (result[STORAGE_KEY]) {
      // Merge with default config to ensure all fields exist
      // (in case new fields were added in an update)
      return { ...configManager.getDefaultConfig(), ...result[STORAGE_KEY] };
    } else {
      // No config found, initialize and return default
      const defaultConfig = configManager.getDefaultConfig();
      await configManager.saveConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('Error getting config:', error);
    return configManager.getDefaultConfig();
  }
}

// Save configuration
configManager.saveConfig = async function(newConfig) {
  console.log('ConfigManager: saveConfig called with:', newConfig);

  try {
    await chrome.storage.sync.set({ [STORAGE_KEY]: newConfig });
    console.log('ConfigManager: Config saved successfully to chrome.storage.sync.');
    return true;
  } catch (error) {
    console.error('ConfigManager: Error saving config to chrome.storage.sync:', error);
    return false;
  }
}

// Reset configuration to defaults
configManager.resetConfig = async function() {
  try {
    const defaultConfig = configManager.getDefaultConfig();
    await configManager.saveConfig(defaultConfig);
    console.log('Config reset to defaults');
    return true;
  } catch (error) {
    console.error('Error resetting config:', error);
    return false;
  }
} 