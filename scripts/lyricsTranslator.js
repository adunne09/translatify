// API calls are now handled by the background service worker to avoid CORS issues
async function getAnthropicApiKey() {
    // Allow setting a global key for quick testing, otherwise fall back to storage.
    const globalKey = typeof globalThis !== "undefined" ? globalThis.ANTHROPIC_API_KEY : null;
    if (typeof globalKey === "string" && globalKey.trim().length > 0) {
        return globalKey.trim();
    }

    if (!chrome?.storage?.local?.get) {
        return null;
    }

    try {
        const result = await chrome.storage.local.get(["anthropicApiKey"]);
        const storedKey = result?.anthropicApiKey;
        if (typeof storedKey === "string" && storedKey.trim().length > 0) {
            return storedKey.trim();
        }
    } catch (error) {
        console.error("Translatify: Failed to read Anthropic API key from storage.", error);
    }

    return null;
}

async function translateText(text,sourceLanguage,destinationLanguage,apiKey) {
    if (!apiKey) {
        console.error("Translatify: Anthropic API key is missing. Store it in chrome.storage.local under 'anthropicApiKey' or set globalThis.ANTHROPIC_API_KEY.");
        return null;
    }

    try {
        // Send message to background script instead of making direct API call
        const response = await chrome.runtime.sendMessage({
            action: "translateText",
            text: text,
            sourceLanguage: sourceLanguage,
            destinationLanguage: destinationLanguage,
            apiKey: apiKey
        });

        if (response.success) {
            return response.translatedText;
        } else {
            console.error("Translatify: Translation failed:", response.error);
            return null;
        }
    } catch (error) {
        console.error("Translatify: Translation error:", error);
        return null;
    }
}

function restoreLyrics() {
    const lyricsWrapperList = document.querySelectorAll("div[data-testid='fullscreen-lyric']");
    if (lyricsWrapperList) {
        lyricsWrapperList.forEach((lyricsWrapper, index) => {
            lyricsWrapper.classList.remove("modifedLyricsWrapper");
            
            const lyrics = lyricsWrapper.querySelector(".newLyrics");

            if (lyrics) {
                const originalLyrics = lyricsWrapper.querySelector(".originalLyrics").innerText;
                lyrics.innerText = originalLyrics;
                lyrics.classList.remove("newLyrics");

                lyricsWrapper.querySelector(".originalLyrics").remove();
            }
        });
    }


    const tag = document.getElementById("translated");
    if (tag) {
        tag.remove();
    }
}


// 1ST METHOD



function getFullLyrics(lyricsList) {
    let fullLyrics = "";
    if (lyricsList) {
        fullLyrics = lyricsList.join(";");
    }
    return fullLyrics;
}


function getTranslatedLyricsToList(translatedLyrics) {
    if (translatedLyrics == null) {
        return null;
    }
    
    const translatedLyricsList = translatedLyrics.split(';');
    return translatedLyricsList;
}

function replaceLyrics(translatedLyricsList) {
    const lyricsWrapperList = document.querySelectorAll("div[data-testid='fullscreen-lyric']");
    if (lyricsWrapperList[0] != null && translatedLyricsList != null) {
            const tag= document.createElement("div");
            tag.id="translated";
            lyricsWrapperList[0].appendChild(tag);

            lyricsWrapperList.forEach((lyricsWrapper, index) => {
                lyricsWrapper.classList.add("modifedLyricsWrapper");
                const lyrics = lyricsWrapper.firstChild;
                const newLyrics = lyrics.cloneNode(true);
    
                lyrics.setAttribute("original",lyrics.innerText);
                lyrics.classList.add("originalLyrics");
    
                newLyrics.innerText = translatedLyricsList[index];
                lyricsWrapper.appendChild(newLyrics);
                newLyrics.classList.add("newLyrics");
    
            });
        
    }

}


async function translateAllWithAnthropic(sourceLanguage,destinationLanguage) {
    const apiKey = await getAnthropicApiKey();
    if (!apiKey) {
        console.error("Translatify: Unable to translate lyrics without an Anthropic API key.");
        return;
    }
    const lyricsList = getLyrics();
    const fullLyrics = getFullLyrics(lyricsList);
    const translatedLyrics = await translateText(fullLyrics,sourceLanguage,destinationLanguage,apiKey);
    const translatedLyricsList = getTranslatedLyricsToList(translatedLyrics);
    replaceLyrics(translatedLyricsList);
}


// 2ND METHOD

function getLyrics() {
    const lyricsWrapperList = document.querySelectorAll("div[data-testid='fullscreen-lyric']");
    const lyricsList = [];
    if (lyricsWrapperList) {
        lyricsWrapperList.forEach((lyricsWrapper) => {
            const lyrics = lyricsWrapper.firstChild.textContent;
            lyricsList.push(lyrics);
        });
    }
    return lyricsList;
}

async function replaceLyricAsync(translatedLine, index) {
    const lyricsWrapperList = document.querySelectorAll("div[data-testid='fullscreen-lyric']");
    if (lyricsWrapperList[0] != null && translatedLine != null) {
            const lyricsWrapper = lyricsWrapperList[index];

            lyricsWrapper.classList.add("modifedLyricsWrapper");
            const lyrics = lyricsWrapper.firstChild;
            const newLyrics = lyrics.cloneNode(true);

            lyrics.setAttribute("original",lyrics.innerText);
            lyrics.classList.add("originalLyrics");

            newLyrics.innerText = translatedLine;
            lyricsWrapper.appendChild(newLyrics);
            newLyrics.classList.add("newLyrics");
        
    }

    let focusedLyrics = document.querySelector(".EhKgYshvOwpSrTv399Mw");
    if (focusedLyrics) {
        focusedLyrics.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center"
        });
        console.log(focusedLyrics);
    }
}


async function translateLineByLineWithAnthropic(sourceLanguage,destinationLanguage) {
    const apiKey = await getAnthropicApiKey();
    if (!apiKey) {
        console.error("Translatify: Unable to translate lyrics without an Anthropic API key.");
        return;
    }

    // Tag to let know that the lyrics are translated
    const lyricsWrapperList = document.querySelectorAll("div[data-testid='fullscreen-lyric']");

    if (lyricsWrapperList[0] == null) {
        console.log("Lyrics not found: waiting..");
        return setTimeout(translate, 100);
    }

    const tag= document.createElement("div");
    tag.id="translated";
    lyricsWrapperList[0].appendChild(tag);

    const lyricsList = getLyrics();
    if (lyricsList) {
        // Track indices of non-empty lines for proper mapping
        const nonEmptyIndices = [];
        const nonEmptyLyrics = [];

        // Collect non-empty lines and their indices
        lyricsList.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine && trimmedLine !== "") {
                nonEmptyIndices.push(index);
                nonEmptyLyrics.push(line);
            }
        });

        // Join non-empty lyrics for API call
        const fullLyrics = nonEmptyLyrics.join("\n");

        // Debug: Log what we're sending to the API
        console.log("Translatify: Sending lyrics to API:", {
            sourceLanguage: sourceLanguage,
            destinationLanguage: destinationLanguage,
            originalLineCount: lyricsList.length,
            nonEmptyLineCount: nonEmptyLyrics.length,
            skippedEmptyLines: lyricsList.length - nonEmptyLyrics.length,
            fullLyrics: fullLyrics
        });

        // Make single API call with all lyrics
        const translatedText = await translateText(fullLyrics, sourceLanguage, destinationLanguage, apiKey);

        if (translatedText) {
            // Split the translated text back into lines
            const translatedLines = translatedText.split("\n");

            // Debug: Log the translation response
            console.log("Translatify: Received translation:", {
                originalLineCount: lyricsList.length,
                translatedLineCount: translatedLines.length,
                translatedLines: translatedLines
            });

            // Create a mapping for all lines (including empty ones)
            const finalTranslations = [];
            let translationIndex = 0;

            for (let i = 0; i < lyricsList.length; i++) {
                if (nonEmptyIndices.includes(i)) {
                    // This was a non-empty line that was translated
                    finalTranslations[i] = translatedLines[translationIndex] || lyricsList[i];
                    translationIndex++;
                } else {
                    // This was an empty line, keep it as is
                    finalTranslations[i] = lyricsList[i];
                }
            }

            // Replace each line in the UI
            for (let index = 0; index < lyricsList.length; index++) {
                await replaceLyricAsync(finalTranslations[index], index);
            }
        } else {
            console.error("Translatify: Translation failed, keeping original lyrics");
        }

        // Focus active lyrics
        let focusedLyrics = document.querySelector(".EhKgYshvOwpSrTv399Mw");
        if (focusedLyrics) {
            focusedLyrics.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "center"
            });
        }
    }
}


// MAIN TRANSLATE FUNCTION
async function translate() {
    const sourceLanguage = "auto";
    let destinationLanguage = "eng";

    destinationLanguage = await chrome.storage.local.get(["language"]);
    destinationLanguage = destinationLanguage.language;


    const translateButton = document.querySelector("button[data-testid='translate-button']");
    const lyricsButton = document.querySelector("button[data-testid='lyrics-button']");


    if (translateButton.getAttribute("aria-pressed") == "true" && document.getElementById("translated") == null && lyricsButton.getAttribute("aria-pressed") == "true") {
        translateLineByLineWithAnthropic(sourceLanguage,destinationLanguage);
    } else if (translateButton.getAttribute("aria-pressed") == "false" && document.getElementById("translated") != null) {
        restoreLyrics();

        // Focus active lyrics
        let focusedLyrics = document.querySelector(".EhKgYshvOwpSrTv399Mw");
        if (focusedLyrics) {
            focusedLyrics.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "center"
            });
        }
    }
    
}

function refreshTranslation() {
    const tag = document.getElementById("translated");
    if (tag) {
        tag.remove();
        restoreLyrics();
    }
    translate();
}
