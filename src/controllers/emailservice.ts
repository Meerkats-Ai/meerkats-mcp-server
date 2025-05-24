import * as dns from 'dns'
import * as net from 'net'
import { promisify } from 'util'

// Promisify DNS resolution
const resolveMx = promisify(dns.resolveMx)

/**
 * Generate a random string for email address
 */
function generateRandomString(length: number = 20): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

/**
 * Generate a random email that likely doesn't exist
 */
function generateRandomEmail(domain: string): string {
    return `${generateRandomString()}@${domain}`
}

/**
 * Get MX records for a domain
 */
async function getMxRecords(domain: string): Promise<string[]> {
    try {
        const records = await resolveMx(domain)
        // Sort by priority (lower is higher priority)
        records.sort((a, b) => a.priority - b.priority)
        return records.map((record) => record.exchange)
    } catch (error) {
        console.error(`Error getting MX records for ${domain}:`, error)
        return []
    }
}

/**
 * SMTP client to check if an email address is accepted
 */
class SmtpClient {
    private socket: net.Socket
    private buffer: string = ''
    private domain: string
    private fromEmail: string
    private toEmail: string
    private mailServer: string
    private timeout: number
    private port: number
    private useTls: boolean
    private simulationMode: boolean
    private simulationResult: boolean
    private resolvePromise: ((value: boolean) => void) | null = null
    private rejectPromise: ((reason: any) => void) | null = null
    private isGoogleMail: boolean = false

    constructor(
        domain: string,
        mailServer: string,
        fromEmail: string,
        toEmail: string,
        options: {
            timeout?: number
            port?: number
            useTls?: boolean
            simulationMode?: boolean
            simulationResult?: boolean
        } = {}
    ) {
        this.domain = domain
        this.mailServer = mailServer
        this.fromEmail = fromEmail
        this.toEmail = toEmail
        this.timeout = options.timeout || 15000 // Increased default timeout to 15 seconds
        this.port = options.port || 25 // Default SMTP port
        this.useTls = options.useTls || false // Whether to use TLS/SSL
        this.simulationMode = options.simulationMode || false // For testing without actual SMTP connections
        this.simulationResult = options.simulationResult !== undefined ? options.simulationResult : false
        this.socket = new net.Socket()

        // Check if this is a Google mail server
        this.isGoogleMail = mailServer.includes('google') || mailServer.includes('gmail')
    }

    private setupSocketListeners(): void {
        let emailAccepted = false
        let commandSequence = 0

        this.socket.on('data', async (data) => {
            const response = data.toString()
            this.buffer += response
            console.log(`Received: ${response.trim()}`)

            // Process SMTP responses based on command sequence
            if (commandSequence === 0 && response.includes('220')) {
                // Initial connection response, send EHLO
                this.sendCommand(`EHLO checkeremail.com`)
                commandSequence = 1
            } else if (commandSequence === 1 && response.includes('250')) {
                // EHLO response, send MAIL FROM
                this.sendCommand(`MAIL FROM:<${this.fromEmail}>`)
                commandSequence = 2
            } else if (commandSequence === 2 && response.includes('250')) {
                // MAIL FROM response, send RCPT TO
                this.sendCommand(`RCPT TO:<${this.toEmail}>`)
                commandSequence = 3
            } else if (commandSequence === 3) {
                // RCPT TO response
                if (response.includes('250')) {
                    // Email accepted
                    emailAccepted = true

                    // For Google mail servers, acceptance doesn't necessarily mean the email exists
                    // Google often accepts any recipient during SMTP conversation
                    if (this.isGoogleMail) {
                        console.log('Google mail server detected - acceptance may not indicate a valid email')
                    }
                }

                // Send QUIT command
                this.sendCommand('QUIT')
                commandSequence = 4
            } else if (commandSequence === 4 && response.includes('221')) {
                // QUIT response, close connection
                this.socket.end()

                // Resolve promise with result
                if (this.resolvePromise) {
                    this.resolvePromise(emailAccepted)
                }
            }
        })

        this.socket.on('error', (error) => {
            console.error(`Socket error for ${this.mailServer}:${this.port}:`, error)
            if (this.rejectPromise) {
                this.rejectPromise(error)
            }
        })

        this.socket.on('timeout', () => {
            console.error(`Connection to ${this.mailServer}:${this.port} timed out after ${this.timeout}ms`)
            this.socket.destroy()
            if (this.rejectPromise) {
                this.rejectPromise(
                    new Error(
                        `Connection to ${this.mailServer}:${this.port} timed out after ${this.timeout}ms. Note: Many ISPs and mail servers block SMTP probing.`
                    )
                )
            }
        })

        this.socket.on('close', () => {
            console.log(`Connection to ${this.mailServer}:${this.port} closed`)
            // If we haven't resolved yet, resolve with the current result
            if (this.resolvePromise) {
                this.resolvePromise(emailAccepted)
            }
        })

        // Set socket timeout
        this.socket.setTimeout(this.timeout)
    }

    private sendCommand(command: string): void {
        console.log(`Sending: ${command}`)
        this.socket.write(command + '\r\n')
    }

    public async checkEmail(): Promise<boolean> {
        // If in simulation mode, return the predefined result without making actual connections
        if (this.simulationMode) {
            console.log(`[SIMULATION MODE] Simulating email check for ${this.toEmail}`)
            console.log(`[SIMULATION MODE] Result: ${this.simulationResult ? 'Email accepted' : 'Email rejected'}`)
            return Promise.resolve(this.simulationResult)
        }

        return new Promise((resolve, reject) => {
            this.resolvePromise = resolve
            this.rejectPromise = reject

            this.setupSocketListeners()

            console.log(`Connecting to ${this.mailServer}:${this.port}...`)
            this.socket.connect(this.port, this.mailServer, () => {
                console.log(`Connected to mail server ${this.mailServer}:${this.port}`)
            })
        })
    }
}

/**
 * Common email patterns used by companies
 */
export const EMAIL_PATTERNS = {
    FIRST_DOT_LAST: 'first.last',
    FIRST_LAST: 'firstlast',
    FIRST_DOT_LAST_INITIAL: 'first.l',
    FIRST_INITIAL_LAST: 'f.last',
    FIRST_INITIAL_DOT_LAST: 'f.last',
    FIRST: 'first',
    LAST: 'last',
    FIRST_INITIAL_LAST_INITIAL: 'fl',
    LAST_DOT_FIRST: 'last.first',
    LAST_FIRST: 'lastfirst'
}

/**
 * Generate possible email addresses based on name and domain
 */
export function generatePossibleEmails(firstName: string, lastName: string, domain: string): string[] {
    // Normalize names (lowercase, remove special characters)
    const first = firstName.toLowerCase().replace(/[^a-z0-9]/g, '')
    const last = lastName.toLowerCase().replace(/[^a-z0-9]/g, '')
    const firstInitial = first.charAt(0)
    const lastInitial = last.charAt(0)

    // Generate possible email formats
    const possibleEmails = [
        `${first}.${last}@${domain}`, // john.doe@example.com
        `${first}${last}@${domain}`, // johndoe@example.com
        `${first}@${domain}`, // john@example.com
        `${last}@${domain}`, // doe@example.com
        `${firstInitial}${last}@${domain}`, // jdoe@example.com
        `${first}${lastInitial}@${domain}`, // johnd@example.com
        `${firstInitial}.${last}@${domain}`, // j.doe@example.com
        `${first}.${lastInitial}@${domain}`, // john.d@example.com
        `${last}.${first}@${domain}`, // doe.john@example.com
        `${last}${first}@${domain}`, // doejohn@example.com
        `${firstInitial}${lastInitial}@${domain}` // jd@example.com
    ]

    return possibleEmails
}

/**
 * Check if an email address exists (not caught by catch-all)
 */
export async function verifyEmail(
    email: string,
    fromEmail: string = 'test@example.com',
    options: {
        timeout?: number
        port?: number
        retryCount?: number
        simulationMode?: boolean
        simulationResult?: boolean
    } = {}
): Promise<{
    exists: boolean
    error?: string
    isGoogleMail?: boolean
}> {
    const retryCount = options.retryCount || 2

    try {
        const domain = email.split('@')[1]
        const mxRecords = await getMxRecords(domain)

        if (mxRecords.length === 0) {
            return {
                exists: false,
                error: `No MX records found for ${domain}`
            }
        }

        // Try with the first (highest priority) mail server
        const mailServer = mxRecords[0]
        const isGoogleMail = mailServer.includes('google') || mailServer.includes('gmail')

        // If simulation mode is enabled, return the simulated result
        if (options.simulationMode) {
            console.log(`[SIMULATION MODE] Verifying email ${email}`)
            const simulatedResult = options.simulationResult !== undefined ? options.simulationResult : false
            console.log(`[SIMULATION MODE] Result: ${simulatedResult ? 'Email exists' : 'Email does not exist'}`)

            return {
                exists: simulatedResult,
                isGoogleMail
            }
        }

        // Try with default port first
        try {
            const client = new SmtpClient(domain, mailServer, fromEmail, email, {
                timeout: options.timeout,
                port: options.port
            })

            const isAccepted = await client.checkEmail()

            return {
                exists: isAccepted,
                isGoogleMail
            }
        } catch (error) {
            // If we have retries left and it's a timeout or connection error, try alternative ports
            if (
                retryCount > 0 &&
                error instanceof Error &&
                (error.message.includes('timed out') || error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT'))
            ) {
                console.log(`Connection failed on default port, trying alternative ports...`)

                // Try port 587 (submission)
                try {
                    const client587 = new SmtpClient(domain, mailServer, fromEmail, email, {
                        timeout: options.timeout,
                        port: 587
                    })

                    const isAccepted587 = await client587.checkEmail()

                    return {
                        exists: isAccepted587,
                        isGoogleMail
                    }
                } catch (error587) {
                    console.log(`Connection failed on port 587, trying port 465...`)

                    // Try port 465 (SMTPS)
                    try {
                        const client465 = new SmtpClient(domain, mailServer, fromEmail, email, {
                            timeout: options.timeout,
                            port: 465
                        })

                        const isAccepted465 = await client465.checkEmail()

                        return {
                            exists: isAccepted465,
                            isGoogleMail
                        }
                    } catch (error465) {
                        // If all ports fail, try the next MX record if available
                        if (mxRecords.length > 1 && retryCount > 1) {
                            console.log(`All ports failed, trying next MX record...`)
                            return verifyEmail(email, fromEmail, {
                                ...options,
                                retryCount: retryCount - 1
                            })
                        }

                        // If we've tried all options, return a helpful error
                        return {
                            exists: false,
                            isGoogleMail,
                            error: `Unable to connect to mail servers for ${domain}. This is common as many mail servers block SMTP probing.`
                        }
                    }
                }
            }

            // If no retries or not a connection error, return a helpful error
            return {
                exists: false,
                isGoogleMail,
                error:
                    error instanceof Error
                        ? `${error.message} (Note: Many mail servers block SMTP probing to prevent spam and abuse)`
                        : String(error)
            }
        }
    } catch (error) {
        console.error('Error verifying email:', error)
        return {
            exists: false,
            error:
                error instanceof Error
                    ? `${error.message} (Note: Many mail servers block SMTP probing to prevent spam and abuse)`
                    : String(error)
        }
    }
}

/**
 * Find the most likely email pattern for a domain
 * This tries to verify a few common patterns to determine which one is used
 */
export async function findEmailPattern(
    domain: string,
    fromEmail: string = 'test@example.com',
    options: {
        timeout?: number
        port?: number
        simulationMode?: boolean
        simulationResult?: boolean
    } = {}
): Promise<{
    pattern: string | null
    hasCatchAll: boolean
    error?: string
    isGoogleMail?: boolean
}> {
    try {
        // First check if the domain has a catch-all policy
        const catchAllResult = await checkCatchAll(domain, fromEmail, options)

        // Check if it's a Google mail server
        const mxRecords = catchAllResult.mxRecords || []
        const isGoogleMail = mxRecords.length > 0 && (mxRecords[0].includes('google') || mxRecords[0].includes('gmail'))

        if (catchAllResult.error) {
            return {
                pattern: null,
                hasCatchAll: false,
                error: catchAllResult.error,
                isGoogleMail
            }
        }

        if (catchAllResult.hasCatchAll) {
            return {
                pattern: null,
                hasCatchAll: true,
                error: 'Domain has a catch-all policy, cannot determine email pattern',
                isGoogleMail
            }
        }

        // If simulation mode is enabled, return a simulated pattern
        if (options.simulationMode) {
            console.log(`[SIMULATION MODE] Finding email pattern for ${domain}`)
            const simulatedPattern = 'first.last' // Most common pattern
            console.log(`[SIMULATION MODE] Result: Pattern is ${simulatedPattern}`)

            return {
                pattern: simulatedPattern,
                hasCatchAll: false,
                isGoogleMail
            }
        }

        // Test emails for a fictional person to determine pattern
        // Using a name unlikely to exist
        const testFirst = 'xyztest'
        const testLast = 'abcverify'

        // Test common patterns
        const patterns = [
            { format: EMAIL_PATTERNS.FIRST_DOT_LAST, email: `${testFirst}.${testLast}@${domain}` },
            { format: EMAIL_PATTERNS.FIRST_LAST, email: `${testFirst}${testLast}@${domain}` },
            { format: EMAIL_PATTERNS.FIRST_INITIAL_LAST, email: `${testFirst.charAt(0)}${testLast}@${domain}` },
            { format: EMAIL_PATTERNS.FIRST_DOT_LAST_INITIAL, email: `${testFirst}.${testLast.charAt(0)}@${domain}` },
            { format: EMAIL_PATTERNS.FIRST, email: `${testFirst}@${domain}` }
        ]

        // Since we're testing non-existent emails, we expect all to fail
        // If any succeed, it might indicate a catch-all policy we missed
        for (const pattern of patterns) {
            const result = await verifyEmail(pattern.email, fromEmail, options)
            if (result.exists) {
                return {
                    pattern: null,
                    hasCatchAll: true,
                    error: 'Domain appears to have a catch-all policy (detected during pattern testing)',
                    isGoogleMail
                }
            }
        }

        // If we can't determine the pattern automatically, return null
        return {
            pattern: null,
            hasCatchAll: false,
            isGoogleMail
        }
    } catch (error) {
        console.error('Error finding email pattern:', error)
        return {
            pattern: null,
            hasCatchAll: false,
            error: error instanceof Error ? error.message : String(error)
        }
    }
}

/**
 * Guess the most likely email address for a person at a domain
 */
export async function guessEmail(
    firstName: string,
    lastName: string,
    domain: string,
    fromEmail: string = 'test@example.com',
    options: {
        timeout?: number
        port?: number
        simulationMode?: boolean
        simulationResult?: boolean
    } = {}
): Promise<{
    guessedEmails: Array<{ email: string; exists: boolean; format: string }>
    hasCatchAll: boolean
    error?: string
    isGoogleMail?: boolean
}> {
    try {
        // First check if the domain has a catch-all policy
        const catchAllResult = await checkCatchAll(domain, fromEmail, options)

        // Check if it's a Google mail server
        const mxRecords = catchAllResult.mxRecords || []
        const isGoogleMail = mxRecords.length > 0 && (mxRecords[0].includes('google') || mxRecords[0].includes('gmail'))

        if (catchAllResult.error) {
            return {
                guessedEmails: [],
                hasCatchAll: false,
                error: catchAllResult.error,
                isGoogleMail
            }
        }

        if (catchAllResult.hasCatchAll) {
            // If domain has catch-all, we can't reliably verify emails
            // Return possible formats but mark them as unverified
            const possibleEmails = generatePossibleEmails(firstName, lastName, domain)
            return {
                guessedEmails: possibleEmails.map((email) => ({
                    email,
                    exists: true, // We can't know for sure with catch-all domains
                    format: 'unknown (catch-all domain)'
                })),
                hasCatchAll: true,
                isGoogleMail
            }
        }

        // If simulation mode is enabled, return simulated results
        if (options.simulationMode) {
            console.log(`[SIMULATION MODE] Guessing emails for ${firstName} ${lastName} at ${domain}`)
            const possibleEmails = generatePossibleEmails(firstName, lastName, domain)

            return {
                guessedEmails: possibleEmails.map((email, index) => ({
                    email,
                    // Make the first email "exist" for demonstration purposes
                    exists: index === 0 ? true : options.simulationResult !== undefined ? options.simulationResult : false,
                    format: getEmailFormat(firstName, lastName, email)
                })),
                hasCatchAll: false,
                isGoogleMail
            }
        }

        // Generate possible emails
        const possibleEmails = generatePossibleEmails(firstName, lastName, domain)

        // Verify each email (with a concurrency limit)
        const concurrencyLimit = 3
        const results = []

        for (let i = 0; i < possibleEmails.length; i += concurrencyLimit) {
            const batch = possibleEmails.slice(i, i + concurrencyLimit)
            const batchPromises = batch.map((email) => verifyEmail(email, fromEmail, options))
            const batchResults = await Promise.all(batchPromises)

            for (let j = 0; j < batch.length; j++) {
                const format = getEmailFormat(firstName, lastName, batch[j])
                results.push({
                    email: batch[j],
                    exists: batchResults[j].exists,
                    format
                })
            }
        }

        // Sort results with existing emails first
        results.sort((a, b) => (b.exists ? 1 : 0) - (a.exists ? 1 : 0))

        // Add a note for Google mail servers
        if (isGoogleMail) {
            console.log('Note: Google mail servers often accept any recipient during SMTP conversation, which may lead to false positives')
        }

        return {
            guessedEmails: results,
            hasCatchAll: false,
            isGoogleMail
        }
    } catch (error) {
        console.error('Error guessing email:', error)
        return {
            guessedEmails: [],
            hasCatchAll: false,
            error: error instanceof Error ? error.message : String(error)
        }
    }
}

/**
 * Determine the format of an email address based on the name components
 */
function getEmailFormat(firstName: string, lastName: string, email: string): string {
    const first = firstName.toLowerCase().replace(/[^a-z0-9]/g, '')
    const last = lastName.toLowerCase().replace(/[^a-z0-9]/g, '')
    const firstInitial = first.charAt(0)
    const lastInitial = last.charAt(0)

    const localPart = email.split('@')[0]

    if (localPart === `${first}.${last}`) return EMAIL_PATTERNS.FIRST_DOT_LAST
    if (localPart === `${first}${last}`) return EMAIL_PATTERNS.FIRST_LAST
    if (localPart === `${firstInitial}${last}`) return EMAIL_PATTERNS.FIRST_INITIAL_LAST
    if (localPart === `${first}.${lastInitial}`) return EMAIL_PATTERNS.FIRST_DOT_LAST_INITIAL
    if (localPart === `${firstInitial}.${last}`) return EMAIL_PATTERNS.FIRST_INITIAL_DOT_LAST
    if (localPart === first) return EMAIL_PATTERNS.FIRST
    if (localPart === last) return EMAIL_PATTERNS.LAST
    if (localPart === `${firstInitial}${lastInitial}`) return EMAIL_PATTERNS.FIRST_INITIAL_LAST_INITIAL
    if (localPart === `${last}.${first}`) return EMAIL_PATTERNS.LAST_DOT_FIRST
    if (localPart === `${last}${first}`) return EMAIL_PATTERNS.LAST_FIRST

    return 'custom'
}

/**
 * Check if a domain has a catch-all email policy
 */
export async function checkCatchAll(
    domain: string,
    fromEmail: string = 'test@example.com',
    options: {
        timeout?: number
        port?: number
        retryCount?: number
        simulationMode?: boolean
        simulationResult?: boolean
    } = {}
): Promise<{
    hasCatchAll: boolean
    mxRecords: string[]
    randomEmail?: string
    error?: string
    simulationMode?: boolean
    isGoogleMail?: boolean
}> {
    // If simulation mode is enabled, return the simulated result
    if (options.simulationMode) {
        console.log(`[SIMULATION MODE] Checking if ${domain} has a catch-all policy`)
        const simulatedResult = options.simulationResult !== undefined ? options.simulationResult : false
        console.log(
            `[SIMULATION MODE] Result: ${simulatedResult ? 'Domain has catch-all policy' : 'Domain does not have catch-all policy'}`
        )

        return {
            hasCatchAll: simulatedResult,
            mxRecords: [`simulated-mx.${domain}`],
            randomEmail: `${generateRandomString()}@${domain}`,
            simulationMode: true
        }
    }

    const retryCount = options.retryCount || 2

    try {
        // Get MX records
        console.log(`Looking up MX records for ${domain}...`)
        const mxRecords = await getMxRecords(domain)
        console.log(`Found ${mxRecords.length} MX records:`, mxRecords)

        if (mxRecords.length === 0) {
            return {
                hasCatchAll: false,
                mxRecords: [],
                error: `No MX records found for ${domain}`
            }
        }

        // Check if it's a Google mail server
        const isGoogleMail = mxRecords.length > 0 && (mxRecords[0].includes('google') || mxRecords[0].includes('gmail'))

        // Generate a random email that likely doesn't exist
        const randomEmail = generateRandomEmail(domain)

        // Try with the first (highest priority) mail server
        const mailServer = mxRecords[0]

        // Try with default port first
        try {
            const client = new SmtpClient(domain, mailServer, fromEmail, randomEmail, {
                timeout: options.timeout,
                port: options.port
            })

            const isAccepted = await client.checkEmail()

            // For Google mail servers, add a note about potential false positives
            if (isGoogleMail && isAccepted) {
                console.log(
                    'Note: Google mail servers often accept any recipient during SMTP conversation, which may lead to false positives'
                )
            }

            return {
                hasCatchAll: isAccepted,
                mxRecords,
                randomEmail,
                isGoogleMail
            }
        } catch (error) {
            // If we have retries left and it's a timeout or connection error, try alternative ports
            if (
                retryCount > 0 &&
                error instanceof Error &&
                (error.message.includes('timed out') || error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT'))
            ) {
                console.log(`Connection failed on default port, trying alternative ports...`)

                // Try port 587 (submission)
                try {
                    const client587 = new SmtpClient(domain, mailServer, fromEmail, randomEmail, {
                        timeout: options.timeout,
                        port: 587
                    })

                    const isAccepted587 = await client587.checkEmail()

                    return {
                        hasCatchAll: isAccepted587,
                        mxRecords,
                        randomEmail,
                        isGoogleMail
                    }
                } catch (error587) {
                    console.log(`Connection failed on port 587, trying port 465...`)

                    // Try port 465 (SMTPS)
                    try {
                        const client465 = new SmtpClient(domain, mailServer, fromEmail, randomEmail, {
                            timeout: options.timeout,
                            port: 465,
                            useTls: true
                        })

                        const isAccepted465 = await client465.checkEmail()

                        return {
                            hasCatchAll: isAccepted465,
                            mxRecords,
                            randomEmail,
                            isGoogleMail
                        }
                    } catch (error465) {
                        // If all ports fail, try the next MX record if available
                        if (mxRecords.length > 1 && retryCount > 1) {
                            console.log(`All ports failed, trying next MX record...`)
                            return checkCatchAll(domain, fromEmail, {
                                ...options,
                                retryCount: retryCount - 1
                            })
                        }

                        // If we've tried all options, return a more helpful error
                        return {
                            hasCatchAll: false,
                            mxRecords,
                            randomEmail,
                            error: `Unable to connect to mail servers for ${domain}. This is common as many mail servers block SMTP probing. Consider using simulation mode for testing.`,
                            isGoogleMail
                        }
                    }
                }
            }

            // If no retries or not a connection error, return a helpful error
            return {
                hasCatchAll: false,
                mxRecords,
                randomEmail,
                error:
                    error instanceof Error
                        ? `${error.message} (Note: Many mail servers block SMTP probing to prevent spam and abuse)`
                        : String(error),
                isGoogleMail
            }
        }
    } catch (error) {
        console.error('Error checking catch-all policy:', error)
        return {
            hasCatchAll: false,
            mxRecords: [],
            error:
                error instanceof Error
                    ? `${error.message} (Note: Many mail servers block SMTP probing to prevent spam and abuse)`
                    : String(error)
        }
    }
}

const catchAllService = {
    checkCatchAll,
    verifyEmail,
    guessEmail,
    findEmailPattern,
    generatePossibleEmails
}

export default catchAllService
