//const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const isLocal = process.env.APP_ENV === 'local';

async function getSecrets() {
    if (!isLocal) {
        /* AWS Secrets Manager implementation
        const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
        try {
            const response = await client.send(
                new GetSecretValueCommand({
                    SecretId: process.env.AWS_SECRET_NAME,
                })
            );
            return JSON.parse(response.SecretString);
        } catch (error) {
            console.error('error fetching secrets from AWS:', error);
            throw error;
        }
        */
    } else {
        // for local development, return environment variables
        return {
            apiClientId: process.env.API_CLIENT_ID,
            apiSecret: process.env.API_SECRET,
            cacheHost: process.env.CACHE_HOST,
            cachePort: process.env.CACHE_PORT,
            cacheUser: process.env.CACHE_USER,
            cachePassword: process.env.CACHE_PASSWORD
        };
    }
}

module.exports = { getSecrets };