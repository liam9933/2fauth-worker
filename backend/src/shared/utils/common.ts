import { SECURITY_CONFIG } from '@/app/config';

export function sanitizeInput(input: any, maxLength = SECURITY_CONFIG.MAX_INPUT_LENGTH): string {
    if (typeof input !== 'string') return '';
    return input.replace(/[<>"'&\x00-\x1F\x7F]/g, '').trim().substring(0, maxLength);
}

export function validateServiceName(service: any): boolean {
    const cleaned = sanitizeInput(service, 50);
    return cleaned.length >= 1 && cleaned.length <= 50;
}

export function validateAccountName(account: any): boolean {
    const cleaned = sanitizeInput(account, 100);
    return cleaned.length >= 1 && cleaned.length <= 100;
}
