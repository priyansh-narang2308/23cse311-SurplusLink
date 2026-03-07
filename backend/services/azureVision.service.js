import ImageAnalysisClient from '@azure-rest/ai-vision-image-analysis';
import { AzureKeyCredential } from '@azure/core-auth';

/**
 * Service to interact with Azure AI Vision for image analysis
 */
export const analyzeDonationImage = async (imageUrl) => {
    try {
        const endpoint = process.env.AZURE_COMPUTER_VISION_ENDPOINT;
        const key = process.env.AZURE_COMPUTER_VISION_KEY;

        if (!endpoint || !key) {
            console.warn('Azure AI Vision credentials not configured. Skipping analysis.');
            return null;
        }

        const createClient = ImageAnalysisClient.default || ImageAnalysisClient;
        console.log('Analyzing image with Azure AI:', imageUrl);
        const client = createClient(endpoint, new AzureKeyCredential(key));

        const features = ['Caption', 'Tags'];

        const result = await client.path('/imageanalysis:analyze').post({
            body: { url: imageUrl },
            queryParameters: { features },
            contentType: 'application/json'
        });

        const iaResult = result.body;

        if (result.status !== '200') {
            const error = iaResult.error;
            console.error(`Azure AI Vision Error: ${error.code} - ${error.message}`);
            return null;
        }

        const detection = {
            foodName: (iaResult.captionResult || iaResult.caption)?.text || 'Food Item',
            tags: (iaResult.tagsResult || iaResult.tags)?.values?.map(v => v.name) || [],
            confidence: (iaResult.captionResult || iaResult.caption)?.confidence || 0
        };

        console.log('Azure AI Detection Success:', detection);
        return detection;

    } catch (error) {
        console.error('Azure AI Vision Service Error:', error);
        return null;
    }
};
