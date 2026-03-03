import { execSync } from 'child_process';

export async function commitAndPushData(): Promise<void> {
    try {
        execSync('git config --global user.email "action@github.com"', { stdio: 'inherit' });
        execSync('git config --global user.name "GitHub Action"', { stdio: 'inherit' });
        execSync('git add data/', { stdio: 'inherit' });
        
        const status = execSync('git status --porcelain', { encoding: 'utf8' });
        
        if (status.trim()) {
            const now = new Date();
            const commitMessage = `chore: add contributors data for ${now.toISOString().split('T')[0]}`;
            execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
            execSync('git push', { stdio: 'inherit' });
            
            console.log('Contributors data committed and pushed to repository');
        } else {
            console.log('No changes to commit');
        }
        
    } catch (error) {
        console.error('Error with git operations:', error);
        throw error;
    }
}