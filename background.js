// Background service worker for the extension

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Gemini to Markdown extension installed');
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    handleDownload(request.data);
    sendResponse({ success: true });
  }
  return true;
});

function handleDownload(data) {
  // Handle the download process
  const { markdown, filename } = data;
  
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('Download failed:', chrome.runtime.lastError);
    } else {
      console.log('Download started:', downloadId);
    }
  });
}
