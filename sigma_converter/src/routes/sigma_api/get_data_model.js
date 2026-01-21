const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const axios = require('axios');

const { getAccessToken } = require('../../utils/sigma_token_util');
const { getSigmaSecrets } = require('../../utils/sigma_secret_util');

async function getDataModelFromSigma(dataModelId) {

    const domain = process.env.SIGMA_DOMAIN;

    const accessToken = await getAccessToken(domain);
    const secrets = await getSigmaSecrets(domain);

    if (!accessToken) {
        console.error('failed to obtain bearer token.');
        return;
    }

    const requestURL = `${secrets.apiUrl}/v3alpha/dataModels/${dataModelId}/spec`;
    //console.log(`URL sent to Sigma: ${requestURL}`);

    try {
        const response = await axios.get(requestURL, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        //console.log('data model retrieved successfully:', JSON.stringify(response.data, null, 2));
        return response.data;

    } catch (error) {
        console.error('error retrieving data model from Sigma:', error.response ? error.response.data : error.message);
        throw error;
    }

}

module.exports = {
    getDataModelFromSigma
};