// Read Bot Content Extractor Module
// Handles various methods for extracting content from web pages

// Create a global contentExtractor object
var contentExtractor = {};

// Import utils.js using importScripts
// Ensure utils.js does not rely on DOM APIs if used solely in the service worker context.
// If utils.js also has DOM-dependent parts, they might need adjustment or to be moved to offscreen.
importScripts('../js/utils.js'); 

const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';

// Main extract function
contentExtractor.extract = async function(url, htmlString, method, config) {
  console.log(`Extracting content from ${url} using method: ${method}`);
  
  if (!url) {
    throw new Error('URL is required for extraction');
  }
  
  try {
    switch (method) {
      case 'jina':
        return await extractWithJina(url, config.jinaApiKey);
      case 'downloadApi':
        // This might also need htmlToMarkdown if the API returns HTML.
        // For now, assuming it returns markdown or plain text, or htmlToMarkdown is part of it.
        return await extractWithDownloadApi(url, config.downloadApiEndpoint);
      case 'readability':
        return await extractWithReadabilityViaOffscreen(htmlString, url);
      default:
        throw new Error(`Unknown extraction method: ${method}`);
    }
  } catch (error) {
    console.error(`Error extracting content with ${method}:`, error);
    throw error; // Re-throw to be caught by the caller in service-worker.js
  }
}

// Helper function to manage the offscreen document
async function getOrCreateOffscreenDocument() {
    // Check if an offscreen document is already active.
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
    });

    if (existingContexts.length > 0) {
        return existingContexts[0].documentId; // Should ideally match a specific documentId if managing multiple.
    }

    // Create an offscreen document.
    // We can specify multiple reasons, but for now, just DOM_PARSER is sufficient for Readability.
    await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Parse HTML content with Readability.js'
    });
    // Note: createDocument resolves when the document has been created and loaded.
    // We might need to query again to get the documentId if not returned directly or needed for specific targeting.
}

// Extract with Readability.js via Offscreen Document
async function extractWithReadabilityViaOffscreen(htmlString, pageUrl) {
  if (!htmlString) {
    throw new Error('HTML content is required for Readability extraction');
  }

  try {
    await getOrCreateOffscreenDocument();
    
    // Send a message to the offscreen document to process the HTML.
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'extract-content',
      htmlString: htmlString,
      pageUrl: pageUrl // Sending pageUrl in case offscreen.js needs it for base URI or other logic
    });

    if (response && response.success) {
      return response.content;
    } else {
      const errorMessage = response && response.error ? response.error : 'Unknown error from offscreen document';
      console.error('Error from offscreen document:', errorMessage);
      throw new Error(`Failed to extract content with Readability via offscreen: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Error with Readability (offscreen) extraction:', error);
    // Optional: Consider closing the offscreen document on error if it's not meant to be persistent.
    // await chrome.offscreen.closeDocument(); 
    throw new Error(`Failed to extract content with Readability: ${error.message}`);
  }
}

// Extract with Jina AI
async function extractWithJina(url, apiKey) {
  if (!apiKey) {
    throw new Error('Jina AI API key is required');
  }
  
  try {
    // Try using the r.jina.ai service first
    const rJinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    
    const response = await fetch(rJinaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // If r.jina.ai fails, try s.jina.ai
      return await extractWithJinaS(url, apiKey);
    }
    
    const data = await response.json();
    
    if (data.content) {
      return data.content;
    } else {
      throw new Error('No content returned from Jina AI r.jina.ai service');
    }
  } catch (error) {
    console.error('Error with r.jina.ai service, falling back to s.jina.ai:', error);
    return await extractWithJinaS(url, apiKey);
  }
}

// Extract with Jina AI's s.jina.ai service
async function extractWithJinaS(url, apiKey) {
  try {
    const response = await fetch('https://s.jina.ai/', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
      throw new Error(`Jina AI s.jina.ai service returned: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.content) {
      return data.content;
    } else {
      throw new Error('No content returned from Jina AI s.jina.ai service');
    }
  } catch (error) {
    console.error('Error with s.jina.ai service:', error);
    throw new Error(`Failed to extract content with Jina AI: ${error.message}`);
  }
}

// Extract with Download API
async function extractWithDownloadApi(url, apiEndpoint) {
  if (!apiEndpoint) {
    throw new Error('Download API endpoint is required');
  }
  
  try {
    const response = await fetch(`${apiEndpoint}?url=${encodeURIComponent(url)}`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`Download API returned: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text(); 
    // If htmlToMarkdown was used here, it needs to be adapted for offscreen document.
    // For now, assuming it returns markdown directly or this step is handled differently.
    // const markdown = htmlToMarkdown(html); // This would fail if htmlToMarkdown was here and relied on DOM.
    return html; // Returning raw HTML/text for now. Adapt if Markdown conversion is needed.

  } catch (error) {
    console.error('Error with Download API:', error);
    throw new Error(`Failed to extract content with Download API: ${error.message}`);
  }
}

// Removed loadReadability, htmlToMarkdown, and decodeHtmlEntities as they are moved or handled by offscreen.js 