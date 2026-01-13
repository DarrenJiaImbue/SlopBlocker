/**
 * SlopBlocker Options Page Script
 * Handles settings management for the extension
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const apiKeyInput = document.getElementById('apiKey');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  const testApiKeyBtn = document.getElementById('testApiKey');
  const apiKeyStatus = document.getElementById('apiKeyStatus');
  const contentPreferences = document.getElementById('contentPreferences');
  const harmThreshold = document.getElementById('harmThreshold');
  const thresholdValue = document.getElementById('thresholdValue');
  const enableToggle = document.getElementById('enableToggle');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const saveStatus = document.getElementById('saveStatus');

  // Load current settings
  async function loadSettings() {
    try {
      const settings = await chrome.storage.local.get([
        'apiKey',
        'contentPreferences',
        'harmThreshold',
        'enabled',
      ]);

      if (settings.apiKey) {
        apiKeyInput.value = settings.apiKey;
      }
      if (settings.contentPreferences) {
        contentPreferences.value = settings.contentPreferences;
      }
      if (settings.harmThreshold !== undefined) {
        harmThreshold.value = settings.harmThreshold;
        thresholdValue.textContent = settings.harmThreshold;
      }
      if (settings.enabled !== undefined) {
        enableToggle.checked = settings.enabled;
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  // Toggle API key visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleApiKeyBtn.textContent = '🙈';
    } else {
      apiKeyInput.type = 'password';
      toggleApiKeyBtn.textContent = '👁️';
    }
  });

  // Test API key
  testApiKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showApiKeyStatus('Please enter an API key', 'error');
      return;
    }

    testApiKeyBtn.disabled = true;
    testApiKeyBtn.textContent = 'Testing...';
    showApiKeyStatus('Validating API key...', 'info');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_API_KEY',
        apiKey: apiKey,
      });

      if (response.valid) {
        showApiKeyStatus('API key is valid!', 'success');
      } else {
        showApiKeyStatus(`Invalid API key: ${response.error}`, 'error');
      }
    } catch (e) {
      showApiKeyStatus(`Error testing key: ${e.message}`, 'error');
    } finally {
      testApiKeyBtn.disabled = false;
      testApiKeyBtn.textContent = 'Test Key';
    }
  });

  // Show API key status message
  function showApiKeyStatus(message, type) {
    apiKeyStatus.textContent = message;
    apiKeyStatus.className = `status-message ${type}`;
    apiKeyStatus.style.display = 'block';

    if (type === 'success') {
      setTimeout(() => {
        apiKeyStatus.style.display = 'none';
      }, 5000);
    }
  }

  // Update threshold display
  harmThreshold.addEventListener('input', () => {
    thresholdValue.textContent = harmThreshold.value;
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', async () => {
    const settings = {
      apiKey: apiKeyInput.value.trim(),
      contentPreferences: contentPreferences.value.trim(),
      harmThreshold: parseFloat(harmThreshold.value),
      enabled: enableToggle.checked,
    };

    // Validate
    if (!settings.apiKey) {
      showSaveStatus('Please enter an API key', 'error');
      return;
    }

    if (!settings.contentPreferences) {
      showSaveStatus('Please enter your content preferences', 'error');
      return;
    }

    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = 'Saving...';

    try {
      await chrome.storage.local.set(settings);

      // Notify background script
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        settings: settings,
      });

      showSaveStatus('Settings saved successfully!', 'success');
    } catch (e) {
      showSaveStatus(`Error saving: ${e.message}`, 'error');
    } finally {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.textContent = 'Save Settings';
    }
  });

  // Show save status message
  function showSaveStatus(message, type) {
    saveStatus.textContent = message;
    saveStatus.className = `save-status ${type}`;

    if (type === 'success') {
      setTimeout(() => {
        saveStatus.textContent = '';
        saveStatus.className = 'save-status';
      }, 3000);
    }
  }

  // Enable toggle immediate effect
  enableToggle.addEventListener('change', async () => {
    try {
      await chrome.storage.local.set({ enabled: enableToggle.checked });
    } catch (e) {
      console.error('Failed to update enabled state:', e);
    }
  });

  // Load settings on page load
  await loadSettings();
});
