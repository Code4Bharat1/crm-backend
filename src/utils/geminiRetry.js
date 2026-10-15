/**
 * Wraps a Gemini generateContent call with exponential backoff retry logic.
 * Handles Windows wsarecv / ECONNRESET / stream reading errors gracefully.
 *
 * @param {object} model - Gemini model instance
 * @param {string} prompt - The prompt to send
 * @param {number} maxRetries - Max retry attempts (default: 3)
 * @param {number} timeoutMs - Per-attempt timeout in ms (default: 30000)
 * @returns {Promise} Gemini result
 */
export async function generateWithRetry(model, prompt, maxRetries = 4, timeoutMs = 30000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Race between the API call and a timeout
            const result = await Promise.race([
                model.generateContent(prompt),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs)
                )
            ]);
            return result;
        } catch (err) {
            const isRetryable =
                // Gemini overload / rate limit ("model is currently experiencing high demand") is
                // transient -- it was surfacing to users as "Extraction failed: internal server error".
                [429, 500, 503].includes(err.status) ||
                err.message?.includes('high demand') ||
                err.message?.includes('stream reading error') ||
                err.message?.includes('wsarecv') ||
                err.message?.includes('ECONNRESET') ||
                err.message?.includes('ECONNABORTED') ||
                err.message?.includes('ETIMEDOUT') ||
                err.message?.includes('Failed to fetch') ||
                err.message?.includes('timed out');

            if (isRetryable && attempt < maxRetries) {
                const delay = 1500 * 2 ** (attempt - 1); // 1.5s, 3s, 6s
                console.warn(`[Gemini] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
                console.warn(`[Gemini] Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }

            // Non-retryable or out of retries
            console.error(`[Gemini] All ${maxRetries} attempts failed. Last error: ${err.message}`);
            throw err;
        }
    }
}
