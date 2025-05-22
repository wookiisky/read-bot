// Read Bot LLM Service Module
// Handles calling different LLM APIs

// Create a global llmService object
var llmService = {};

// Call LLM API with provided messages and config
llmService.callLLM = async function(
  messages, 
  llmConfig, 
  systemPrompt, 
  imageBase64, 
  streamCallback, 
  doneCallback, 
  errorCallback
) {
  // Log the call (without sensitive data)
  console.log(`Calling LLM API: ${llmConfig.provider}, Model: ${llmConfig.model}, messags: ${messages}`);
  
  try {
    switch (llmConfig.provider) {
      case 'gemini':
        return await callGemini(
          messages, 
          llmConfig, 
          systemPrompt, 
          imageBase64, 
          streamCallback, 
          doneCallback, 
          errorCallback
        );
      case 'openai':
        return await callOpenAI(
          messages, 
          llmConfig, 
          systemPrompt, 
          imageBase64, 
          streamCallback, 
          doneCallback, 
          errorCallback
        );
      default:
        throw new Error(`Unsupported LLM provider: ${llmConfig.provider}`);
    }
  } catch (error) {
    console.error(`Error calling ${llmConfig.provider} API:`, error);
    errorCallback(error);
  }
}

// Call Gemini API
async function callGemini(
  messages, 
  llmConfig, 
  systemPrompt, 
  imageBase64, 
  streamCallback, 
  doneCallback, 
  errorCallback
) {
  const apiKey = llmConfig.apiKey;
  const model = llmConfig.model || 'gemini-pro';
  
  if (!apiKey) {
    const error = new Error('Gemini API key is required');
    errorCallback(error);
    return;
  }
  
  try {
    // Build the request body
    let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // Add streaming parameter if callbacks are provided
    if (streamCallback && doneCallback) {
      apiUrl += '&alt=sse';
    }
    
    // Build the contents array
    const contents = [];
    
    // Add system prompt as a user message if provided
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      
      // Add an empty assistant response to maintain the conversation flow
      contents.push({
        role: 'model',
        parts: [{ text: 'I understand. I will analyze the provided content.' }]
      });
    }
    
    // Convert messages to Gemini format
    for (const message of messages) {
      const role = message.role === 'assistant' ? 'model' : 'user';
      
      // Handle multimodal input (image + text) for the last user message
      if (role === 'user' && imageBase64 && message === messages[messages.length - 1] && model.includes('vision')) {
        // For multi-modal input
        const parts = [];
        
        // Add text if present
        if (message.content) {
          parts.push({ text: message.content });
        }
        
        // Add image
        const imageData = imageBase64.split(',')[1]; // Remove the data:image/xxx;base64, prefix
        parts.push({
          inlineData: {
            mimeType: imageBase64.split(';')[0].split(':')[1], // Extract MIME type
            data: imageData
          }
        });
        
        contents.push({ role, parts });
      } else {
        // Regular text-only message
        contents.push({
          role,
          parts: [{ text: message.content }]
        });
      }
    }
    
    // Build the request body
    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    };
    
    // If streaming
    if (streamCallback && doneCallback) {
      await handleGeminiStream(
        apiUrl,
        requestBody,
        streamCallback,
        doneCallback,
        errorCallback
      );
    } else {
      // Non-streaming request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      
      // Extract the response text
      const responseText = data.candidates[0].content.parts[0].text;
      
      // Call the done callback with the full response
      doneCallback(responseText);
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    errorCallback(error);
  }
}

// Handle Gemini streaming response
async function handleGeminiStream(apiUrl, requestBody, streamCallback, doneCallback, errorCallback) {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API streaming error: ${response.status} - ${errorText}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Decode the chunk and add it to the buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process SSE format
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: ' prefix
          
          if (data === '[DONE]') {
            // Stream completed
            doneCallback(fullResponse);
            return;
          }
          
          try {
            const parsedData = JSON.parse(data);
            
            if (parsedData.candidates && parsedData.candidates[0]?.content?.parts?.[0]?.text) {
              const textChunk = parsedData.candidates[0].content.parts[0].text;
              fullResponse += textChunk;
              streamCallback(textChunk);
            }
          } catch (e) {
            console.error('Error parsing Gemini stream data:', e, data);
            // Do not rethrow, continue processing the stream
          }
        }
      }
    }
    
    // If we get here, the stream ended without a [DONE] marker
    doneCallback(fullResponse);
  } catch (error) {
    console.error('Error handling Gemini stream:', error);
    errorCallback(error);
  }
}

// Call OpenAI API
async function callOpenAI(
  messages, 
  llmConfig, 
  systemPrompt, 
  imageBase64, 
  streamCallback, 
  doneCallback, 
  errorCallback
) {
  const apiKey = llmConfig.apiKey;
  const baseUrl = llmConfig.baseUrl || 'https://api.openai.com';
  const model = llmConfig.model || 'gpt-3.5-turbo';
  
  if (!apiKey) {
    const error = new Error('OpenAI API key is required');
    errorCallback(error);
    return;
  }
  
  try {
    // Build API URL
    const apiUrl = `${baseUrl}/v1/chat/completions`;
    
    // Prepare messages array for OpenAI format
    const openaiMessages = [];
    
    // Add system prompt if provided
    if (systemPrompt) {
      openaiMessages.push({
        role: 'system',
        content: systemPrompt
      });
    }
    
    // Convert messages to OpenAI format
    for (const message of messages) {
      // For the last user message, check if there's an image to include
      if (
        message.role === 'user' && 
        imageBase64 && 
        message === messages[messages.length - 1] && 
        ['gpt-4-vision-preview', 'gpt-4o', 'gpt-4o-mini'].includes(model)
      ) {
        // For multi-modal input
        openaiMessages.push({
          role: 'user',
          content: [
            // Text content
            { type: 'text', text: message.content },
            
            // Image content
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
                detail: 'auto'
              }
            }
          ]
        });
      } else {
        // Regular text-only message
        openaiMessages.push({
          role: message.role,
          content: message.content
        });
      }
    }
    
    // Build request body
    const requestBody = {
      model: model,
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 4000,
      stream: !!streamCallback
    };
    
    // Make API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    // Handle streaming response
    if (streamCallback) {
      await handleOpenAIStream(response, streamCallback, doneCallback, errorCallback);
    } else {
      // Handle regular response
      const data = await response.json();
      const responseText = data.choices[0].message.content;
      doneCallback(responseText);
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    errorCallback(error);
  }
}

// Handle OpenAI streaming response
async function handleOpenAIStream(response, streamCallback, doneCallback, errorCallback) {
  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullResponse = '';
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Decode the chunk and add it to the buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: ' prefix
          
          if (data === '[DONE]') {
            // Stream completed
            doneCallback(fullResponse);
            return;
          }
          
          try {
            const parsedData = JSON.parse(data);
            
            if (parsedData.choices && parsedData.choices[0].delta && parsedData.choices[0].delta.content) {
              const textChunk = parsedData.choices[0].delta.content;
              fullResponse += textChunk;
              streamCallback(textChunk);
            }
          } catch (e) {
            console.error('Error parsing OpenAI stream data:', e, data);
          }
        }
      }
    }
    
    // If we get here, the stream ended without a [DONE] marker
    doneCallback(fullResponse);
  } catch (error) {
    console.error('Error handling OpenAI stream:', error);
    errorCallback(error);
  }
} 