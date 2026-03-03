import { FeedResponse } from './types.js';
import { FANDOM_SUBDOMAIN } from './config.js';

const API_PATH = '/wikia.php?controller=CommunityPageController&method=getTopContributorsData&format=json&uselang=en';
const DATA_URL = `https://${FANDOM_SUBDOMAIN}.fandom.com${API_PATH}`;

export const fetchData = async (): Promise<FeedResponse> => {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json() as FeedResponse;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw new Error('Failed to fetch data');
    }
};