import { WEBHOOK_URL } from './config.js';

export const sendWebhook = async (payload: any) => {
    if (!WEBHOOK_URL) {
        console.error('Error: WEBHOOK_URL is not defined in environment variables.');
        return;
    }
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            console.error(`Error sending webhook: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error sending webhook:', error);
    }
};
