const { createClient } = require('@supabase/supabase-js');
const config = require('./server/config/index.js');

// Supabase configuration
const SUPABASE_URL = config.supabase.url;
const SUPABASE_KEY = config.supabase.serviceRoleKey || config.supabase.anonKey;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Email content validation functions
function validateEmailContent(content) {
    const issues = [];
    
    if (!content || typeof content !== 'string') {
        issues.push('CONTENT_MISSING_OR_INVALID_TYPE');
        return { isValid: false, issues };
    }
    
    // Check for common encoding issues
    if (content.includes('=3D') || content.includes('=20') || content.includes('=0A')) {
        issues.push('QUOTED_PRINTABLE_NOT_DECODED');
    }
    
    // Check for base64 content
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    const lines = content.split('\n');
    for (const line of lines) {
        if (line.trim().length > 50 && base64Regex.test(line.trim())) {
            issues.push('BASE64_CONTENT_NOT_DECODED');
            break;
        }
    }
    
    // Check for HTML tags that shouldn't be visible
    if (content.includes('<html') || content.includes('<body') || content.includes('<div')) {
        issues.push('HTML_TAGS_NOT_STRIPPED');
    }
    
    // Check for MIME headers
    if (content.includes('Content-Type:') || content.includes('Content-Transfer-Encoding:') || content.includes('MIME-Version:')) {
        issues.push('MIME_HEADERS_NOT_REMOVED');
    }
    
    // Check for garbled characters (common encoding issues)
    if (content.includes('Đ') || content.includes('Ñ') || content.includes('Ð')) {
        issues.push('GARBLED_CHARACTERS_ENCODING_ISSUE');
    }
    
    // Check for truncation indicators
    if (content.endsWith('...') && content.length < 100) {
        issues.push('CONTENT_POSSIBLY_TRUNCATED');
    }
    
    // Check for "No content available"
    if (content.trim() === 'No content available' || content.trim() === '') {
        issues.push('NO_CONTENT_AVAILABLE');
    }
    
    return {
        isValid: issues.length === 0,
        issues,
        contentLength: content.length,
        preview: content.substring(0, 200)
    };
}

function validateEmailDisplay(emailData) {
    const validation = {
        messageId: emailData.id,
        subject: emailData.subject,
        from: emailData.recipient_email,
        timestamp: emailData.created_at,
        issues: [],
        isValid: true,
        contentValidation: null
    };
    
    // Validate content
    if (emailData.content) {
        validation.contentValidation = validateEmailContent(emailData.content);
        if (!validation.contentValidation.isValid) {
            validation.isValid = false;
            validation.issues.push(...validation.contentValidation.issues);
        }
    } else {
        validation.isValid = false;
        validation.issues.push('CONTENT_MISSING');
    }
    
    // Validate subject
    if (!emailData.subject || emailData.subject.trim() === '') {
        validation.isValid = false;
        validation.issues.push('SUBJECT_MISSING');
    }
    
    // Validate from address
    if (!emailData.recipient_email || !emailData.recipient_email.includes('@')) {
        validation.isValid = false;
        validation.issues.push('FROM_ADDRESS_INVALID');
    }
    
    // Validate timestamp
    if (!emailData.created_at || isNaN(new Date(emailData.created_at).getTime())) {
        validation.isValid = false;
        validation.issues.push('TIMESTAMP_INVALID');
    }
    
    return validation;
}

async function validateAllEmailDisplay() {
    console.log('🔍 EMAIL DISPLAY VALIDATION - CHECKING ALL EMAILS\n');
    
    try {
        // Get all email messages
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('id, content, subject, recipient_email, created_at, lead_id, type, sent_at, imap_uid')
            .eq('type', 'email')
            .order('created_at', { ascending: false });

        if (messagesError) {
            console.error('❌ Error fetching messages:', messagesError);
            return;
        }

        console.log(`📊 Found ${messages?.length || 0} email messages to validate\n`);

        const validationResults = {
            total: messages?.length || 0,
            valid: 0,
            invalid: 0,
            issues: {},
            details: []
        };

        for (const message of messages || []) {
            const validation = validateEmailDisplay(message);
            
            if (validation.isValid) {
                validationResults.valid++;
            } else {
                validationResults.invalid++;
                
                // Count issue types
                for (const issue of validation.issues) {
                    validationResults.issues[issue] = (validationResults.issues[issue] || 0) + 1;
                }
            }
            
            validationResults.details.push(validation);
            
            // Log problematic emails
            if (!validation.isValid) {
                console.log(`❌ INVALID EMAIL - ID: ${validation.messageId}`);
                console.log(`   Subject: ${validation.subject}`);
                console.log(`   From: ${validation.from}`);
                console.log(`   Issues: ${validation.issues.join(', ')}`);
                if (validation.contentValidation) {
                    console.log(`   Content Preview: ${validation.contentValidation.preview}...`);
                }
                console.log('');
            }
        }

        // Summary
        console.log('🎯 VALIDATION SUMMARY:');
        console.log(`📊 Total emails: ${validationResults.total}`);
        console.log(`✅ Valid emails: ${validationResults.valid}`);
        console.log(`❌ Invalid emails: ${validationResults.invalid}`);
        console.log(`📈 Success rate: ${validationResults.total > 0 ? ((validationResults.valid / validationResults.total) * 100).toFixed(1) : 0}%`);
        
        if (Object.keys(validationResults.issues).length > 0) {
            console.log('\n🚨 ISSUES FOUND:');
            for (const [issue, count] of Object.entries(validationResults.issues)) {
                console.log(`   ${issue}: ${count} occurrences`);
            }
        }

        // Return results for further processing
        return validationResults;

    } catch (error) {
        console.error('❌ Validation failed:', error);
        return null;
    }
}

// Run the validation
validateAllEmailDisplay().then((results) => {
    if (results) {
        console.log('\n🏁 Email display validation completed');
        
        if (results.invalid > 0) {
            console.log('\n🔧 NEXT STEPS:');
            console.log('1. Review the invalid emails listed above');
            console.log('2. Fix the content processing issues');
            console.log('3. Re-run validation to confirm fixes');
        } else {
            console.log('\n🎉 All emails are displaying properly!');
        }
    }
    process.exit(0);
}).catch(error => {
    console.error('💥 Validation failed:', error);
    process.exit(1);
});
