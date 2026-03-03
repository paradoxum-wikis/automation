import * as fs from 'fs';
import * as path from 'path';
import { Contributor } from './types.js';

export async function saveContributorsData(contributors: Contributor[]): Promise<void> {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const timestamp = `${year}-${month}-${day}`;
        const dataDir = path.join(process.cwd(), 'data', year.toString());
        
        if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
            fs.mkdirSync(path.join(process.cwd(), 'data'));
        }
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const filename = `recap-${timestamp}.json`;
        const filepath = path.join(dataDir, filename);
        const dataToSave = {
            timestamp: now.toISOString(),
            totalContributors: contributors.length,
            contributors: contributors
        };
        
        fs.writeFileSync(filepath, JSON.stringify(dataToSave, null, 2));
        
        console.log(`Contributors data saved to: ${filepath}`);
        
    } catch (error) {
        console.error('Error saving contributors data:', error);
        throw error;
    }
}