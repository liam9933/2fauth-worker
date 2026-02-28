import { Hono } from 'hono';
import { EnvBindings } from '@/app/config';
import { authMiddleware } from '@/shared/middleware/auth';
import { BackupService } from '@/features/backup/backupService';

const backups = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();

backups.use('*', authMiddleware);

backups.get('/providers', async (c) => {
    const service = new BackupService(c.env);
    const providers = await service.getProvidersList();
    return c.json({ success: true, providers });
});

backups.post('/providers', async (c) => {
    const service = new BackupService(c.env);
    const data = await c.req.json();
    const id = await service.addProvider(data);
    return c.json({ success: true, id });
});

backups.put('/providers/:id', async (c) => {
    const service = new BackupService(c.env);
    const id = Number(c.req.param('id'));
    const data = await c.req.json();
    await service.updateProvider(id, data);
    return c.json({ success: true });
});

backups.delete('/providers/:id', async (c) => {
    const service = new BackupService(c.env);
    const id = Number(c.req.param('id'));
    await service.deleteProvider(id);
    return c.json({ success: true });
});

backups.post('/providers/test', async (c) => {
    const service = new BackupService(c.env);
    const { type, config } = await c.req.json();
    await service.testConnection(type, config);
    return c.json({ success: true, message: 'Connection successful' });
});

backups.post('/providers/:id/backup', async (c) => {
    const service = new BackupService(c.env);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();
    await service.executeManualBackup(id, body);
    return c.json({ success: true, message: 'Backup successful' });
});

backups.get('/providers/:id/files', async (c) => {
    const service = new BackupService(c.env);
    const id = Number(c.req.param('id'));
    const files = await service.getFiles(id);
    return c.json({ success: true, files });
});

backups.post('/providers/:id/download', async (c) => {
    const service = new BackupService(c.env);
    const id = Number(c.req.param('id'));
    const { filename } = await c.req.json();
    const content = await service.downloadFile(id, filename);
    return c.json({ success: true, content });
});

export async function handleScheduledBackup(env: EnvBindings) {
    const service = new BackupService(env);
    await service.handleScheduledBackup();
}

export default backups;
