
import catchAllService from './emailservice.js'
const guessEmail = async (body: any) => {
    const { firstName, lastName, domain, fromEmail, simulationMode, simulationResult } = body

    if (!firstName || !lastName || !domain) {
        throw new Error('First name, last name, and domain are required')
    }

    // Validate domain format unless in simulation mode
    if (!simulationMode) {
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i
        if (!domainRegex.test(domain)) {
            throw new Error('Invalid domain format')
        }
    }

    // Generate possible emails
    const possibleEmails = catchAllService.generatePossibleEmails(firstName, lastName, domain)
    
    // If in simulation mode, return simulated results
    if (simulationMode) {
        console.log(`[SIMULATION MODE] Guessing emails for ${firstName} ${lastName} at ${domain}`)
        
        return {
            success: true,
            data: {
                firstName,
                lastName,
                domain,
                guessedEmails: possibleEmails.map((email: any) => ({
                    email,
                    exists: simulationResult !== undefined ? simulationResult : Math.random() > 0.7, // Randomly mark some as existing
                    format: 'first.last' // Hardcoded format to avoid TypeScript errors
                })),
                hasCatchAll: false,
                simulationMode: true
            }
        }
    }

    // TypeScript doesn't know about the additional options, so we need to cast
    const options: any = {}
    if (simulationMode !== undefined) options.simulationMode = simulationMode
    if (simulationResult !== undefined) options.simulationResult = simulationResult
    
    const result = await catchAllService.guessEmail(firstName, lastName, domain, fromEmail, options)

    return {
        success: true,
        data: {
            firstName,
            lastName,
            domain,
            ...result
        }
    }
}
const verifyEmail = async (email: string, fromEmail: string) => {

    if (!email) {
        throw new Error('Email is required')
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
        throw new Error('Invalid email format')
    }

    const result = await catchAllService.verifyEmail(email, fromEmail)

    return {
        success: true,
        data: {
            email,
            ...result
        }
    }
}

export default {
    guessEmail,
    verifyEmail
}
