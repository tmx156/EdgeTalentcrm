/**
 * Gravity Forms Webhook Integration
 *
 * This endpoint receives lead submissions from Gravity Forms
 * and imports them directly into the CRM.
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

// Initialize Supabase
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey
);

/**
 * Webhook endpoint to receive leads from Gravity Forms
 * POST /api/gravity-forms-webhook/submit
 *
 * Expected JSON payload from Gravity Forms (field names will vary based on your form):
 * {
 *   "name": "John Doe",              // or separate first_name/last_name fields
 *   "email": "john@example.com",
 *   "phone": "1234567890",
 *   "age": 25,
 *   "postcode": "12345",
 *   "notes": "Additional information",
 *   "parent_phone": "0987654321"     // optional
 * }
 */
router.post('/submit', async (req, res) => {
  try {
    console.log('📥 Received Gravity Forms submission:', JSON.stringify(req.body, null, 2));

    // Extract data from Gravity Forms webhook
    // Gravity Forms sends field data with labels as keys
    // Handle exact field names from your form
    const formData = req.body;

    // Map Gravity Forms field names to CRM database fields
    // Handle both field IDs (numbers) and field labels
    const getName = () => {
      return formData['1'] ||           // Field ID 1 = Name
             formData['Name'] ||
             formData['name'] ||
             formData['Full Name'] ||
             (formData['First Name'] && formData['Last Name']
               ? `${formData['First Name']} ${formData['Last Name']}`
               : '');
    };

    const getEmail = () => {
      return formData['7'] ||           // Field ID 7 = Email
             formData['Email'] ||
             formData['email'] ||
             null;
    };

    const getPhone = () => {
      return formData['15'] ||          // Field ID 15 = Phone
             formData['Telephone Number'] ||
             formData['Phone'] ||
             formData['phone'] ||
             formData['telephone_number'] ||
             null;
    };

    const getAge = () => {
      const ageValue = formData['11'] || // Field ID 11 = Age
                       formData['Age'] ||
                       formData['age'];
      return ageValue ? parseInt(ageValue) : null;
    };

    const getPostcode = () => {
      return formData['5'] ||           // Field ID 5 = Postcode
             formData['Post Code'] ||
             formData['Postcode'] ||
             formData['postcode'] ||
             formData['post_code'] ||
             null;
    };

    const getParentPhone = () => {
      return formData['14'] ||          // Field ID 14 = Parent's Number
             formData["Parent's Number"] ||
             formData['Parent Number'] ||
             formData['parent_phone'] ||
             formData['parents_number'] ||
             null;
    };

    const getPhotoUrl = () => {
      return formData['6'] ||           // Field ID 6 = Photo
             formData['Upload Photo'] ||
             formData['Photo'] ||
             formData['photo'] ||
             formData['image_url'] ||
             null;
    };

    const fullName = getName().trim();

    // Validate required fields
    if (!fullName || fullName === '') {
      console.error('❌ Validation failed: Name is required');
      return res.status(400).json({
        success: false,
        error: 'Name is required',
        message: 'Please provide a Name field in the form submission'
      });
    }

    // Store any unprocessed fields in custom_fields
    const processedKeys = [
      '1', '5', '6', '7', '11', '14', '15',  // Field IDs
      'Name', 'name', 'Full Name', 'First Name', 'Last Name',
      'Email', 'email',
      'Telephone Number', 'Phone', 'phone', 'telephone_number',
      'Age', 'age',
      'Post Code', 'Postcode', 'postcode', 'post_code',
      "Parent's Number", 'Parent Number', 'parent_phone', 'parents_number',
      'Upload Photo', 'Photo', 'photo', 'image_url',
      // Gravity Forms metadata fields
      'id', 'form_id', 'post_id', 'date_created', 'date_updated',
      'is_starred', 'is_read', 'ip', 'source_url', 'user_agent',
      'currency', 'payment_status', 'payment_date', 'payment_amount',
      'payment_method', 'transaction_id', 'is_fulfilled', 'created_by',
      'transaction_type', 'status', 'source_id', 'submission_speeds'
    ];

    const customFields = {};
    Object.keys(formData).forEach(key => {
      if (!processedKeys.includes(key)) {
        customFields[key] = formData[key];
      }
    });

    // Prepare lead data for database
    const submissionId = formData.id || '';
    const sourceUrl = formData.source_url || '';
    const notes = `Lead imported from Gravity Forms${submissionId ? ` (ID: ${submissionId})` : ''}${sourceUrl ? ` from ${sourceUrl}` : ''} on ${new Date().toLocaleString('en-GB')}`;

    const leadData = {
      id: uuidv4(),
      name: fullName,
      email: getEmail(),
      phone: getPhone(),
      age: getAge(),
      postcode: getPostcode(),
      parent_phone: getParentPhone(),
      image_url: getPhotoUrl(),
      notes: notes,
      status: 'New', // Default status for new leads
      is_confirmed: false,
      has_sale: 0,
      ever_booked: false,
      custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('📝 Prepared lead data:', {
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      status: leadData.status
    });

    // Insert lead into database
    const { data: lead, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting lead:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create lead',
        message: error.message,
        details: error.details
      });
    }

    console.log('✅ Lead created successfully:', {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone
    });

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Lead imported successfully',
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status
      }
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Test endpoint to verify webhook is working
 * GET /api/gravity-forms-webhook/test
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Gravity Forms webhook endpoint is ready',
    endpoint: '/api/gravity-forms-webhook/submit',
    method: 'POST',
    format: 'JSON',
    requiredFields: [
      'Name (Required) - Field ID: 1'
    ],
    optionalFields: [
      'Age - Field ID: 11',
      "Parent's Number - Field ID: 14",
      'Email - Field ID: 7',
      'Telephone Number - Field ID: 15',
      'Post Code - Field ID: 5',
      'Upload Photo - Field ID: 6'
    ],
    formFieldMapping: {
      '1 or Name': 'Lead full name (REQUIRED)',
      '7 or Email': 'Lead email address',
      '15 or Telephone Number': 'Lead phone number',
      '11 or Age': 'Lead age',
      '5 or Post Code': 'Lead postal code',
      '14 or Parent\'s Number': 'Parent/guardian phone number',
      '6 or Upload Photo': 'Photo URL or file upload'
    },
    exampleWithFieldIDs: {
      '1': 'John Doe',
      '7': 'john@example.com',
      '15': '07700900000',
      '11': '25',
      '5': 'SW1A 1AA',
      '14': '07700900001',
      '6': 'https://example.com/photo.jpg',
      'id': '12345',
      'source_url': 'https://edgetalent.co.uk/contact/'
    },
    exampleWithFieldLabels: {
      'Name': 'John Doe',
      'Age': 25,
      "Parent's Number": '07700900001',
      'Email': 'john@example.com',
      'Telephone Number': '07700900000',
      'Post Code': 'SW1A 1AA',
      'Upload Photo': 'https://example.com/photo.jpg'
    }
  });
});

/**
 * Health check endpoint
 * GET /api/gravity-forms-webhook/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Gravity Forms Webhook',
    timestamp: new Date().toISOString(),
    endpoints: {
      submit: '/api/gravity-forms-webhook/submit',
      test: '/api/gravity-forms-webhook/test',
      health: '/api/gravity-forms-webhook/health'
    }
  });
});

module.exports = router;
