document.addEventListener('DOMContentLoaded', function() {
  const downloadBtn = document.getElementById('downloadBtn');
  const statusDiv = document.getElementById('status');

  downloadBtn.addEventListener('click', async () => {
    try {
      downloadBtn.disabled = true;
      showStatus('Extracting chat...', 'info');

      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on a Gemini page
      if (!tab.url.includes('gemini.google.com')) {
        showStatus('Please open a Gemini chat page', 'error');
        downloadBtn.disabled = false;
        return;
      }

      // Execute content script to extract chat data
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractChatContent
      });

      if (results && results[0] && results[0].result) {
        const chatData = results[0].result;
        
        if (!chatData.messages || chatData.messages.length === 0) {
          showStatus('No chat content found', 'error');
          downloadBtn.disabled = false;
          return;
        }

        // Convert to markdown
        const markdown = convertToMarkdown(chatData);
        
        // Download the file
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const filename = generateFilename(chatData.title);
        
        const downloadId = await chrome.downloads.download({
          url: url,
          filename: filename,
          saveAs: true
        });

        // Wait for download to complete or be cancelled before closing
        chrome.downloads.onChanged.addListener(function listener(delta) {
          if (delta.id === downloadId) {
            if (delta.state && delta.state.current !== 'in_progress') {
              chrome.downloads.onChanged.removeListener(listener);
              URL.revokeObjectURL(url);
              
              if (delta.state.current === 'complete') {
                showStatus('✓ Chat downloaded successfully!', 'success');
              }
              
              setTimeout(() => {
                window.close();
              }, 1000);
            }
          }
        });

        showStatus('Saving file...', 'info');
      } else {
        showStatus('Failed to extract chat content', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showStatus('Error: ' + error.message, 'error');
    } finally {
      downloadBtn.disabled = false;
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }

  function generateFilename(title) {
    const sanitized = title
      .replace(/[^a-z0-9\s]/gi, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 80);
    return `${sanitized}-Gemini.md`;
  }

  function convertToMarkdown(chatData) {
    const { title, messages } = chatData;
    const date = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });

    let markdown = `# ${title} - Gemini ${date}\n\n`;
    markdown += `---\n\n`;

    messages.forEach((message, index) => {
      const role = message.role === 'user' ? 'User' : 'Gemini';
      markdown += `## ${role}\n\n`;
      markdown += `${message.content}\n\n`;
      
      if (index < messages.length - 1) {
        markdown += `---\n\n`;
      }
    });

    return markdown;
  }
});

// This function will be injected into the page
function extractChatContent() {
  // Try to find the chat title - Gemini displays it in a span with class "conversation-title"
  let title = 'Gemini Conversation';
  
  // Try multiple selectors to find the chat title
  const titleSelectors = [
    'span.conversation-title',
    '.conversation-title',
    'div[data-test-id="conversation-title"]',
    'button[aria-label*="Rename"]',
    'mat-panel-title',
    'textarea[placeholder*="chat"]',
    '.chat-name',
    'h1'
  ];
  
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text = element.textContent?.trim() || element.value?.trim() || element.getAttribute('aria-label')?.replace('Rename ', '');
      if (text && text.length > 0 && text !== 'Chats' && !text.includes('New chat')) {
        title = text;
        break;
      }
    }
  }
  
  // Fallback: use first user message as title if still default
  if (title === 'Gemini Conversation') {
    const firstMessage = document.querySelector('[data-test-id*="user"] .markdown, .user-message');
    if (firstMessage) {
      const firstLine = firstMessage.textContent.trim().split('\n')[0];
      if (firstLine && firstLine.length > 0) {
        title = firstLine.substring(0, 100);
      }
    }
  }

  // Extract messages
  const messages = [];
  
  // Gemini uses different selectors - we'll try multiple approaches
  const messageContainers = document.querySelectorAll('[data-test-id*="conversation-turn"], .conversation-turn, [class*="message"]');
  
  messageContainers.forEach(container => {
    const isUser = container.querySelector('[data-test-id="user-message"]') 
      || container.classList.contains('user-message')
      || container.querySelector('[alt*="User"]');
    
    const isModel = container.querySelector('[data-test-id="model-message"]') 
      || container.classList.contains('model-message')
      || container.querySelector('[alt*="Gemini"]');

    const contentElement = container.querySelector('[data-message-text], .message-content, .markdown');
    
    if (contentElement) {
      messages.push({
        role: isUser ? 'user' : 'model',
        content: contentElement.innerText || contentElement.textContent
      });
    }
  });

  // Fallback: if no messages found, try a simpler approach
  if (messages.length === 0) {
    const allText = document.body.innerText;
    const firstLine = allText.split('\n').find(line => line.trim().length > 10);
    if (firstLine) {
      title = firstLine.substring(0, 100);
      messages.push({
        role: 'user',
        content: 'Chat content extraction failed. Please report this issue.'
      });
    }
  }

  return { title, messages };
}
