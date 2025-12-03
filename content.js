// Content script that runs on Gemini pages
// This can be extended later for additional functionality

console.log('Gemini to Markdown extension loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractChat') {
    const chatData = extractChatData();
    sendResponse(chatData);
  }
  return true;
});

function extractChatData() {
  // This function extracts chat data from the Gemini page
  // Implementation will vary based on Gemini's actual DOM structure
  
  const title = document.querySelector('h1')?.textContent || 'Gemini Chat';
  const messages = [];

  // Try to find message containers
  // Note: These selectors may need to be updated based on Gemini's actual structure
  const messageElements = document.querySelectorAll('[role="article"], .message, [data-message]');
  
  messageElements.forEach(element => {
    const role = element.classList.contains('user-message') ? 'user' : 'model';
    const content = element.textContent || element.innerText;
    
    if (content && content.trim()) {
      messages.push({ role, content: content.trim() });
    }
  });

  return { title, messages };
}
