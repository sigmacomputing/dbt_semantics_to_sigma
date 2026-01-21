const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const axios = require('axios');

const { getCacheClient } = require('./cache_client');

const { getSigmaSecrets } = require('./sigma_secret_util');

async function getBearerToken(secrets) {

    try {

        const requestData = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: secrets.apiClientId,
            client_secret: secrets.apiSecret
        });

        const response = await axios.post(secrets.apiUrl + '/v2/auth/token', requestData, {
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        });

        return response.data;
    } catch (error) {
        console.error('error obtaining bearer token:', error.response ? error.response.data : error.message);
        return null;
    }
    
}

async function refreshAccessToken(refreshToken, secrets) {

    try {

        const requestData = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: secrets.apiClientId,
            client_secret: secrets.apiSecret,
            refresh_token: refreshToken,
        });

        const response = await axios.post(secrets.apiUrl + '/v2/auth/token', requestData, {
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        });

        return response.data;

    } catch (error) {
        console.error('error refreshing access token:', error.response ? error.response.data : error.message);
        throw error;
    }

}

async function storeToken(domain, tokens, tokenCache) {
    const expiryTime = Date.now() + tokens.expires_in * 1000;
    await tokenCache.set(domain + '_accessToken', tokens.access_token, 'EX', tokens.expires_in);
    await tokenCache.set(domain + '_refreshToken', tokens.refresh_token);
    await tokenCache.set(domain + '_expiryTime', expiryTime);
}

async function getAccessToken(domain) {

    const tokenCache = await getCacheClient();

    const secrets = await getSigmaSecrets(domain);

    const accessToken = await tokenCache.get(domain + '_accessToken');
    const expiryTime = await tokenCache.get(domain + '_expiryTime');

    if (accessToken && expiryTime && Date.now() < expiryTime) {
        return accessToken;
    }

    const refreshToken = await tokenCache.get(domain + '_refreshToken');
    if (refreshToken) {
        try {
            const tokens = await refreshAccessToken(refreshToken, secrets);
            await storeToken(domain, tokens, tokenCache);
            return tokens.access_token;
        } catch (error) {
            if (error.response?.data?.message === 'Refresh token expired') {
                //fall through to getBearerToken
            } else {
                throw error;
            }
        }
    }

    const tokens = await getBearerToken(secrets);
    await storeToken(domain, tokens, tokenCache);

    return tokens.access_token;

}

module.exports = {
    getAccessToken
};