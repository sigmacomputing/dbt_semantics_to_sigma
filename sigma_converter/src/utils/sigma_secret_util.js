const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { getCacheClient } = require('./cache_client');

const { getSecrets } = require('./get_env_secrets');

async function getSigmaSecrets(domain) {

    const secretsManagerSecrets = await getSecrets();

    let apiUrl;
    let apiClientId;
    let apiSecret;

    apiUrl = process.env.API_URL;
    apiClientId = secretsManagerSecrets.apiClientId;
    apiSecret = secretsManagerSecrets.apiSecret;

    if (apiSecret) {
        const secrets = {
            apiUrl: apiUrl,
            apiClientId: apiClientId,
            apiSecret: apiSecret
        }
        return secrets;
    }

    return null;
}

module.exports = {
    getSigmaSecrets
};