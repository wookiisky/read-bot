// Read Bot Options Page JavaScript

// DOM Elements
const form = document.getElementById('settingsForm');
const defaultExtractionMethod = document.getElementById('defaultExtractionMethod');
const jinaApiKey = document.getElementById('jinaApiKey');
const downloadApiEndpoint = document.getElementById('downloadApiEndpoint');
const defaultLlmProvider = document.getElementById('defaultLlmProvider');
const openaiApiKey = document.getElementById('openaiApiKey');
const openaiBaseUrl = document.getElementById('openaiBaseUrl');
const openaiModel = document.getElementById('openaiModel');
const geminiApiKey = document.getElementById('geminiApiKey');
const geminiModel = document.getElementById('geminiModel');
const systemPrompt = document.getElementById('systemPrompt');
const quickInputsContainer = document.getElementById('quickInputsContainer');
const addQuickInputBtn = document.getElementById('addQuickInputBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const saveNotification = document.getElementById('saveNotification');
const quickInputTemplate = document.getElementById('quickInputTemplate');
const contentDisplayHeight = document.getElementById('contentDisplayHeight');

// Initialize the options page
async function init() {
  // Load current settings
  await loadSettings();
  
  // Set up event listeners
  setupEventListeners();
}

// Set up event listeners
function setupEventListeners() {
  // Default extraction method toggle
  defaultExtractionMethod.addEventListener('change', toggleExtractionMethodSettings);
  
  // Default LLM provider toggle
  defaultLlmProvider.addEventListener('change', toggleLlmSettings);
  
  // Add quick input button
  addQuickInputBtn.addEventListener('click', addQuickInput);
  
  // Save settings button
  saveBtn.addEventListener('click', saveSettings);
  
  // Reset settings button
  resetBtn.addEventListener('click', resetSettings);
  
  // Quick input remove button delegation
  quickInputsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-quick-input-btn')) {
      removeQuickInput(e.target.closest('.quick-input-item'));
    }
  });
}

// Load settings from storage
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CONFIG'
    });
    
    if (response && response.type === 'CONFIG_LOADED') {
      const config = response.config;
      
      // Content extraction settings
      defaultExtractionMethod.value = config.defaultExtractionMethod || 'readability';
      jinaApiKey.value = config.jinaApiKey || '';
      downloadApiEndpoint.value = config.downloadApiEndpoint || '';
      
      // LLM settings
      defaultLlmProvider.value = config.llm.defaultProvider || 'openai';
      
      // OpenAI settings
      if (config.llm.providers.openai) {
        openaiApiKey.value = config.llm.providers.openai.apiKey || '';
        openaiBaseUrl.value = config.llm.providers.openai.baseUrl || 'https://api.openai.com';
        openaiModel.value = config.llm.providers.openai.model || 'gpt-3.5-turbo';
      }
      
      // Gemini settings
      if (config.llm.providers.gemini) {
        geminiApiKey.value = config.llm.providers.gemini.apiKey || '';
        geminiModel.value = config.llm.providers.gemini.model || 'gemini-pro';
      }
      
      // Content display height
      contentDisplayHeight.value = config.contentDisplayHeight || 300;
      
      // System prompt
      systemPrompt.value = config.systemPrompt || '';
      
      // Quick inputs
      renderQuickInputs(config.quickInputs || []);
      
      // Toggle appropriate settings based on current values
      toggleExtractionMethodSettings();
      toggleLlmSettings();
    } else {
      console.error('Failed to load config');
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    // Collect all settings
    const config = {
      defaultExtractionMethod: defaultExtractionMethod.value,
      jinaApiKey: jinaApiKey.value,
      downloadApiEndpoint: downloadApiEndpoint.value,
      llm: {
        defaultProvider: defaultLlmProvider.value,
        providers: {
          openai: {
            apiKey: openaiApiKey.value,
            baseUrl: openaiBaseUrl.value,
            model: openaiModel.value
          },
          gemini: {
            apiKey: geminiApiKey.value,
            model: geminiModel.value
          }
        }
      },
      systemPrompt: systemPrompt.value,
      quickInputs: getQuickInputs(),
      contentDisplayHeight: parseInt(contentDisplayHeight.value) || 300
    };
    
    // Send to background script
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_CONFIG',
      config: config
    });
    
    if (response && response.type === 'CONFIG_SAVED') {
      showSaveNotification();
    } else {
      console.error('Failed to save config');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Reset settings to defaults
async function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
    try {
      // Send a message to reset config
      const response = await chrome.runtime.sendMessage({
        type: 'RESET_CONFIG'
      });
      
      if (response && response.type === 'CONFIG_RESET') {
        // Reload the page to show default settings
        location.reload();
      } else {
        console.error('Failed to reset config');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
    }
  }
}

// Toggle visibility of extraction method specific settings
function toggleExtractionMethodSettings() {
  const method = defaultExtractionMethod.value;
  
  // Jina API Key group
  const jinaGroup = document.getElementById('jinaApiKeyGroup');
  jinaGroup.style.display = method === 'jina' ? 'block' : 'none';
  
  // Download API Endpoint group
  const downloadGroup = document.getElementById('downloadApiEndpointGroup');
  downloadGroup.style.display = method === 'downloadApi' ? 'block' : 'none';
}

// Toggle visibility of LLM provider specific settings
function toggleLlmSettings() {
  const provider = defaultLlmProvider.value;
  
  // OpenAI settings
  const openaiSettings = document.getElementById('openaiSettings');
  openaiSettings.style.display = provider === 'openai' ? 'block' : 'none';
  
  // Gemini settings
  const geminiSettings = document.getElementById('geminiSettings');
  geminiSettings.style.display = provider === 'gemini' ? 'block' : 'none';
}

// Add a new quick input
function addQuickInput(displayText = '', sendText = '') {
  // Clone the template
  const template = quickInputTemplate.content.cloneNode(true);
  
  // Set values if provided
  if (displayText) {
    template.querySelector('.quick-input-display').value = displayText;
  }
  
  if (sendText) {
    template.querySelector('.quick-input-send').value = sendText;
  }
  
  // Add to container
  quickInputsContainer.appendChild(template);
}

// Remove a quick input
function removeQuickInput(item) {
  item.remove();
}

// Get all quick inputs as an array
function getQuickInputs() {
  const items = quickInputsContainer.querySelectorAll('.quick-input-item');
  const quickInputs = [];
  
  items.forEach(item => {
    const displayText = item.querySelector('.quick-input-display').value.trim();
    const sendText = item.querySelector('.quick-input-send').value.trim();
    
    if (displayText && sendText) {
      quickInputs.push({
        displayText,
        sendText
      });
    }
  });
  
  return quickInputs;
}

// Render quick inputs from config
function renderQuickInputs(quickInputs) {
  // Clear existing quick inputs
  quickInputsContainer.innerHTML = '';
  
  // Add each quick input
  quickInputs.forEach(input => {
    addQuickInput(input.displayText, input.sendText);
  });
  
  // Add an empty one if none exist
  if (quickInputs.length === 0) {
    addQuickInput();
  }
}

// Show save notification
function showSaveNotification() {
  saveNotification.classList.add('show');
  
  setTimeout(() => {
    saveNotification.classList.remove('show');
  }, 3000);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', init); 