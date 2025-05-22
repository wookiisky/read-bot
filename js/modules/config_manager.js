// Read Bot Config Manager Module
// Handles configuration loading, saving, and default values

// Create a global configManager object
var configManager = {};

// Storage key for config
const STORAGE_KEY = 'readBotConfig';

// Get default configuration
configManager.getDefaultConfig = async function() {
  try {
    const response = await fetch('/options/default_options.json');
    if (!response.ok) {
      throw new Error(`无法加载默认设置：${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('加载默认设置文件失败:', error);
    // 返回硬编码的默认值作为备用
    return {
      defaultExtractionMethod: 'readability',
      jinaApiKey: '',
      downloadApiEndpoint: '',
      llm: {
        defaultProvider: 'openai',
        providers: {
          openai: {
            apiKey: '',
            baseUrl: 'https://api.openai.com',
            model: 'gpt-3.5-turbo'
          },
          gemini: {
            apiKey: '',
            model: 'gemini-pro'
          }
        }
      },
      systemPrompt: 'You are a helpful assistant. The user is interacting with content from a webpage. The extracted content is provided below:\n{CONTENT}\n\nAnswer the user\'s questions based on this content and your general knowledge.',
      quickInputs: [
        { displayText: '总结内容', sendText: 'Please summarize the following content:\n{CONTENT}' },
        { displayText: '提取要点', sendText: 'Extract key points from this content:\n{CONTENT}' }
      ],
      contentDisplayHeight: 300
    };
  }
}

// Initialize configuration if needed
configManager.initializeIfNeeded = async function() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    
    if (!result[STORAGE_KEY]) {
      console.log('初始化默认配置');
      const defaultConfig = await configManager.getDefaultConfig();
      await configManager.saveConfig(defaultConfig);
    }
  } catch (error) {
    console.error('初始化配置错误:', error);
  }
}

// Get current configuration
configManager.getConfig = async function() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    
    if (result[STORAGE_KEY]) {
      // Merge with default config to ensure all fields exist
      // (in case new fields were added in an update)
      const defaultConfig = await configManager.getDefaultConfig();
      return { ...defaultConfig, ...result[STORAGE_KEY] };
    } else {
      // No config found, initialize and return default
      const defaultConfig = await configManager.getDefaultConfig();
      await configManager.saveConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('获取配置错误:', error);
    return await configManager.getDefaultConfig();
  }
}

// Save configuration
configManager.saveConfig = async function(newConfig) {
  console.log('ConfigManager: saveConfig called with:', newConfig);

  try {
    await chrome.storage.sync.set({ [STORAGE_KEY]: newConfig });
    console.log('ConfigManager: 配置成功保存到 chrome.storage.sync');
    return true;
  } catch (error) {
    console.error('ConfigManager: 保存配置到 chrome.storage.sync 错误:', error);
    return false;
  }
}

// Reset configuration to defaults
configManager.resetConfig = async function() {
  try {
    const defaultConfig = await configManager.getDefaultConfig();
    await configManager.saveConfig(defaultConfig);
    console.log('配置已重置为默认值');
    return true;
  } catch (error) {
    console.error('重置配置错误:', error);
    return false;
  }
} 