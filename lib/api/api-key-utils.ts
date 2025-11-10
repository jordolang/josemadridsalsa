import crypto from 'crypto'

export const hashApiKey = (token: string) => crypto.createHash('sha256').update(token).digest('hex')
