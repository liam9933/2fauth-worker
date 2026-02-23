import { createClient, WebDAVClient } from 'webdav';
import { BackupProvider, BackupFile } from './BackupProvider';

export class WebDavProvider implements BackupProvider {
    private client: WebDAVClient;
    private saveDir: string;

    constructor(config: any) {
        if (!config.url || !config.username || !config.password) {
            throw new Error('WebDAV configuration incomplete');
        }
        this.client = createClient(config.url, {
            username: config.username,
            password: config.password
        });
        
        // 标准化 saveDir: 确保以 / 开头，且不以 / 结尾 (除非是根目录)
        let dir = (config.saveDir || '/').trim();
        if (!dir.startsWith('/')) dir = '/' + dir;
        if (dir.length > 1 && dir.endsWith('/')) dir = dir.slice(0, -1);
        
        this.saveDir = dir;
    }

    async testConnection(): Promise<boolean> {
        await this.client.getDirectoryContents('/');
        return true;
    }

    async listBackups(): Promise<BackupFile[]> {
        const items = await this.client.getDirectoryContents(this.saveDir);
        return (items as any[])
            .filter(item => item.type === 'file' && item.basename.startsWith('2fa-backup-') && item.basename.endsWith('.json'))
            .map(item => {
                // Try to parse date from filename if lastmod is missing or generic
                let displayTime = item.lastmod;
                return {
                    filename: item.basename,
                    path: item.filename, // 返回 WebDAV 服务器提供的绝对路径
                    size: item.size,
                    lastModified: displayTime
                };
            })
            .sort((a, b) => b.filename.localeCompare(a.filename));
    }

    async uploadBackup(filename: string, data: string): Promise<void> {
        if (this.saveDir !== '/' && await this.client.exists(this.saveDir) === false) {
            await this.client.createDirectory(this.saveDir);
        }
        const fullPath = this.saveDir === '/' ? `/${filename}` : `${this.saveDir}/${filename}`;
        await this.client.putFileContents(fullPath, data);
    }

    async downloadBackup(filename: string): Promise<string> {
        const cleanFilename = filename.trim().replace(/^\/+/, '');
        const fullPath = this.saveDir === '/' ? `/${cleanFilename}` : `${this.saveDir}/${cleanFilename}`;
        
        const content = await this.client.getFileContents(fullPath, { format: 'text' });
        return content as string;
    }
}