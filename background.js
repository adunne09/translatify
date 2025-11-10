// Background service worker for handling API calls
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL_ID = "claude-haiku-4-5-20251001";
const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_TRANSLATION_MAX_TOKENS = 2048;

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateText") {
        handleTranslation(request.text, request.sourceLanguage, request.destinationLanguage, request.apiKey)
            .then(translatedText => {
                sendResponse({ success: true, translatedText });
            })
            .catch(error => {
                console.error("Background: Translation error:", error);
                sendResponse({ success: false, error: error.message });
            });
        // Return true to indicate async response
        return true;
    }
});

async function handleTranslation(text, sourceLanguage, destinationLanguage, apiKey) {
    if (!apiKey) {
        throw new Error("Anthropic API key is missing");
    }

    const detectedSourceLanguage = sourceLanguage === "auto"
        ? "auto-detected language"
        : sourceLanguage;

    // Updated prompt to avoid copyright concerns
    const systemPrompt = "You are a multilingual text translation assistant. Translate the provided text line-by-line, preserving the original structure and line breaks.";

    const userPrompt = `Translate this text from ${detectedSourceLanguage} to ${destinationLanguage}.
Keep each line separate and maintain the exact same number of lines.
If a line contains only punctuation (like ♪) or doesn't need translation, keep it as is.
For empty lines, return an empty line.
Do not add any commentary, line numbers, or additional formatting.

Text to translate:
${text}`;

    // Debug: Log the full request details
    console.log("Background: API Request Details:", {
        sourceLanguage: sourceLanguage,
        destinationLanguage: destinationLanguage,
        detectedSourceLanguage: detectedSourceLanguage,
        textLength: text.length,
        lineCount: text.split('\n').length,
        systemPrompt: systemPrompt,
        userPrompt: userPrompt,
        fullText: text
    });

    const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_API_VERSION,
            "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
            model: ANTHROPIC_MODEL_ID,
            max_tokens: ANTHROPIC_TRANSLATION_MAX_TOKENS,
            system: systemPrompt,
            messages: [
                {
                    role: "user",
                    content: userPrompt
                }
            ]
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Background: Anthropic API request failed", response.status, errorBody);
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const translatedContent = Array.isArray(data?.content)
        ? data.content
            .filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => part.text)
            .join("")
            .trim()
        : null;

    if (!translatedContent) {
        console.error("Background: Anthropic API returned an unexpected response shape.", data);
        throw new Error("Invalid API response format");
    }

    // Debug: Log the successful response
    console.log("Background: API Response:", {
        originalLineCount: text.split('\n').length,
        translatedLineCount: translatedContent.split('\n').length,
        translatedContent: translatedContent
    });

    return translatedContent;
}