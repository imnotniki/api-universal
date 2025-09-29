import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TokenManager {
    constructor() {
        this.tokens = new Map(); // api -> Set of valid tokens
        this.loadTokens();
    }

    loadTokens() {
        try {
            const tokensFile = path.join(__dirname, '../tokens/authtokens');
            
            if (!fs.existsSync(tokensFile)) {
                console.warn('Auth tokens file not found. Please run setup-tokens.js first.');
                return;
            }

            const content = fs.readFileSync(tokensFile, 'utf8');
            const lines = content.split('\n').map(line => line.trim()).filter(line => line);
            
            let currentApi = null;
            
            for (const line of lines) {
                // Check if line is an API section header [apiname]
                const apiMatch = line.match(/^\[(.+)\]$/);
                if (apiMatch) {
                    currentApi = apiMatch[1];
                    this.tokens.set(currentApi, new Set());
                    continue;
                }
                
                // If we have a current API and the line looks like a token
                if (currentApi && line.length === 24 && /^[a-f0-9]+$/.test(line)) {
                    this.tokens.get(currentApi).add(line);
                }
            }
            
            console.log('Loaded authentication tokens:');
            for (const [api, tokenSet] of this.tokens.entries()) {
                console.log(`  ${api}: ${tokenSet.size} tokens`);
            }
            
        } catch (error) {
            console.error('Error loading auth tokens:', error.message);
        }
    }

    // Check if a token is valid for a specific API
    isValidToken(api, token) {
        if (!this.tokens.has(api)) {
            return false;
        }
        return this.tokens.get(api).has(token);
    }

    // Get all valid tokens for an API
    getTokensForApi(api) {
        return this.tokens.get(api) || new Set();
    }

    // Check if an API exists
    hasApi(api) {
        return this.tokens.has(api);
    }

    // Get all available APIs
    getAvailableApis() {
        return Array.from(this.tokens.keys());
    }

    // Reload tokens from file (useful for updating without restart)
    reloadTokens() {
        this.tokens.clear();
        this.loadTokens();
    }
}

export default new TokenManager();