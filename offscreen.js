// offscreen.js

// Listen for messages from the service worker.
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message, sender, sendResponse) {
  if (message.target !== 'offscreen') {
    return false; // Not for us
  }

  switch (message.type) {
    case 'extract-content':
      try {
        const article = processWithReadability(message.htmlString);
        if (article && article.content) {
          const markdown = htmlToMarkdown(article.content);
          const fullContent = `# ${article.title}\n\n${markdown}`;
          sendResponse({ success: true, content: fullContent });
        } else {
          sendResponse({ success: false, error: 'Readability failed to parse content or extract title/content.' });
        }
      } catch (e) {
        console.error('Error in offscreen document during Readability processing:', e);
        sendResponse({ success: false, error: e.toString() });
      }
      return true; // Indicates an asynchronous response.
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`);
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      return false;
  }
}

function processWithReadability(htmlString) {
  if (!self.Readability) {
    console.error('Readability library not loaded in offscreen document.');
    throw new Error('Readability library not loaded.');
  }
  // Readability expects a DOM document. Create one from the string.
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  // Update the document URI if available, otherwise Readability might have issues.
  // For now, we'll use a generic base URL. Consider passing the actual URL if needed.
  if (doc.baseURI === "about:blank" && doc.head) {
    let base = doc.createElement('base');
    base.href = 'http://localhost/'; // Or a more relevant base URL
    doc.head.appendChild(base);
  }

  const reader = new self.Readability(doc);
  return reader.parse();
}


// Convert HTML to Markdown (Copied from content_extractor.js)
function htmlToMarkdown(html) {
  try {
    // Simple conversion for common HTML elements
    let markdown = html;
    
    markdown = markdown.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    markdown = markdown.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
    markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
    markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    markdown = markdown.replace(/<a href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gi, (match, content) => content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n');
    markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gi, (match, content) => content.replace(/<li[^>]*>(.*?)<\/li>/gi, (liMatch, liContent, offset) => `${offset / liMatch.length + 1}. ${liContent}\n`) + '\n');
    markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n'); // Fallback for LI outside UL/OL though less common
    markdown = markdown.replace(/<img src="(.*?)"[^>]* alt="(.*?)"[^>]*>/gi, '![$2]($1)');
    markdown = markdown.replace(/<img src="(.*?)"[^>]*>/gi, '![]($1)');
    markdown = markdown.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
    markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n');
    markdown = markdown.replace(/<hr[^>]*>/gi, '\n---\n\n');
    markdown = markdown.replace(/<br[^>]*>/gi, '\n');
    
    markdown = markdown.replace(/<[^>]*>/g, '');
    markdown = decodeHtmlEntities(markdown);
    markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return markdown.trim();
  } catch (error) {
    console.error('Error converting HTML to Markdown:', error);
    return html; 
  }
}

// Decode HTML entities (Copied from content_extractor.js)
function decodeHtmlEntities(text) {
  if (typeof document === 'undefined') {
    // This function cannot run in a Worker without a 'document' object.
    // Handle this case, perhaps by returning text as is or throwing an error.
    // For Offscreen document, 'document' will be available.
    console.warn('decodeHtmlEntities called in an environment without `document`. This should be in an offscreen document.');
    return text; // Or throw an error, depending on desired behavior
  }
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
} 