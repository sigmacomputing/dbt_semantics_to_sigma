const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

//const { Redis } = require('ioredis');
const NodeCache = require('node-cache');

const { getSecrets } = require('./get_env_secrets');

let cacheClient = null;

// wrapper to make node-cache async-compatible and handle redis-style set() calls
function createNodeCacheWrapper(nodeCacheInstance) {
    return {
        get: async (key) => {
            return Promise.resolve(nodeCacheInstance.get(key));
        },
        set: async (key, value, ...args) => {
            // handle redis-style set(key, value, 'EX', seconds) syntax
            if (args.length === 2 && args[0] === 'EX') {
                const ttlSeconds = args[1];
                nodeCacheInstance.set(key, value, ttlSeconds);
            } else if (args.length === 1) {
                // handle set(key, value, ttl) syntax
                nodeCacheInstance.set(key, value, args[0]);
            } else {
                // handle set(key, value) syntax (no expiration)
                nodeCacheInstance.set(key, value);
            }
            return Promise.resolve('OK');
        },
        on: () => {} // no-op for node-cache (no event emitters)
    };
}

async function getCacheClient() {

    if (cacheClient) {
        return cacheClient;
    }

    const cacheProvider = process.env.CACHE_PROVIDER || 'node-cache';

    if (cacheProvider === 'node-cache') {
        // create node-cache instance
        cacheClient = createNodeCacheWrapper(new NodeCache());
        return cacheClient;
    }

    /* redis implementation if we deploy to AWS 
    if (cacheProvider === 'redis') {

        // default to Redis
        const secretsManagerSecrets = await getSecrets();

        const redisConfig = {
            local: {
            host: 'localhost',
            port: 6379
            },
            production: {
            host: secretsManagerSecrets.cacheHost,
            port: secretsManagerSecrets.cachePort,
            username: secretsManagerSecrets.cacheUser,
            password: secretsManagerSecrets.cachePassword,
            tls: true
            }
        };

        cacheClient = new Redis(redisConfig[process.env.APP_ENV]);

        cacheClient.on('error', (err) => {
            console.error('Redis connection error:', {
                message: err.message,
                code: err.code,
                stack: err.stack
            });
        });

        return cacheClient;
    }
    */

    return null;
}

module.exports = {
    getCacheClient
};