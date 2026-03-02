import { parseOtpUri } from '@/shared/utils/totp'

/**
 * CSV 格式迁移解析策略
 */
export const csvStrategy = {
    /**
     * @typedef {Object} VaultItem
     * @property {string} service
     * @property {string} account
     * @property {string} secret
     * @property {string} algorithm
     * @property {number} digits
     * @property {number} period
     * @property {string} category
     */

    /**
     * 解析一行 CSV，正确处理 RFC 4180 引号字段（含引号的字段、内部双引号转义）
     * @param {string} line
     * @returns {string[]}
     */
    _splitCsvLine(line) {
        const fields = []
        let i = 0
        while (i <= line.length) {
            if (i === line.length) { fields.push(''); break }
            if (line[i] === '"') {
                // 引号字段：读取到匹配的结束引号
                let val = ''
                i++ // skip opening quote
                while (i < line.length) {
                    if (line[i] === '"') {
                        if (line[i + 1] === '"') { val += '"'; i += 2 } // 转义的 "" → "
                        else { i++; break } // 结束引号
                    } else {
                        val += line[i++]
                    }
                }
                fields.push(val.trim())
                if (line[i] === ',') i++ // skip comma
            } else {
                // 无引号字段：读取到下一个逗号
                const end = line.indexOf(',', i)
                if (end === -1) { fields.push(line.slice(i).trim()); break }
                fields.push(line.slice(i, end).trim())
                i = end + 1
            }
        }
        return fields
    },

    /**
     * Decode a generic or bwauth CSV string.
     * @param {string} csvText 
     * @returns {VaultItem[]}
     */
    parseCsv(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim())
        if (lines.length < 2) return []

        // 表头同样做去引号处理并小写
        const headers = this._splitCsvLine(lines[0]).map(h => h.toLowerCase())
        const rawVault = []

        const isBwAuth = headers.includes('login_totp')
        const isGeneric = headers.includes('issuer') || headers.includes('secret') || headers.includes('name')

        if (!isBwAuth && !isGeneric) return []

        for (let i = 1; i < lines.length; i++) {
            const row = this._splitCsvLine(lines[i])
            const rowData = {}
            headers.forEach((h, index) => { rowData[h] = row[index] || '' })

            if (isBwAuth) {
                const totpStr = rowData['login_totp'] || ''
                if (totpStr.startsWith('otpauth://')) {
                    const accData = parseOtpUri(totpStr)
                    if (accData) {
                        accData.service = rowData['name'] || accData.service
                        accData.account = rowData['login_username'] || accData.account
                        rawVault.push(accData)
                    }
                }
            } else {
                const secret = rowData['secret'] || ''
                if (secret) {
                    // 本系统导出的 generic csv: name=account, issuer=service
                    // 兼容其他工具: 若有独立的 account 列则优先
                    const service = rowData['issuer'] || rowData['name'] || 'Unknown'
                    const account = rowData['account'] || rowData['name'] || ''
                    rawVault.push({
                        service,
                        account,
                        secret: secret.replace(/\s/g, '').toUpperCase(),
                        algorithm: (rowData['algorithm'] || 'SHA1').toUpperCase().replace(/^SHA-?1$/, 'SHA-1').replace(/^SHA-?256$/, 'SHA-256').replace(/^SHA-?512$/, 'SHA-512'),
                        digits: parseInt(rowData['digits'] || '6', 10),
                        period: parseInt(rowData['period'] || '30', 10),
                        category: ''
                    })
                }
            }
        }
        return rawVault
    }
}
