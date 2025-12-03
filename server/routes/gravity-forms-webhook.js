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
    // Handle both exact label matches and common variations
    const getName = () => {
      return formData['Name'] ||
             formData['name'] ||
             formData['Full Name'] ||
             (formData['First Name'] && formData['Last Name']
               ? `${formData['First Name']} ${formData['Last Name']}`
               : '');
    };

    const getEmail = () => {
      return formData['Email'] || formData['email'] || null;
    };

    const getPhone = () => {
      return formData['Telephone Number'] ||
             formData['Phone'] ||
             formData['phone'] ||
             formData['telephone_number'] ||
             null;
    };

    const getAge = () => {
      const ageValue = formData['Age'] || formData['age'];
      return ageValue ? parseInt(ageValue) : null;
    };

    const getPostcode = () => {
      return formData['Post Code'] ||
             formData['Postcode'] ||
             formData['postcode'] ||
             formData['post_code'] ||
             null;
    };

    const getParentPhone = () => {
      return formData["Parent's Number"] ||
             formData['Parent Number'] ||
             formData['parent_phone'] ||
             formData['parents_number'] ||
             null;
    };

    const getPhotoUrl = () => {
      return formData['Upload Photo'] ||
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
      'Name', 'name', 'Full Name', 'First Name', 'Last Name',
      'Email', 'email',
      'Telephone Number', 'Phone', 'phone', 'telephone_number',
      'Age', 'age',
      'Post Code', 'Postcode', 'postcode', 'post_code',
      "Parent's Number", 'Parent Number', 'parent_phone', 'parents_number',
      'Upload Photo', 'Photo', 'photo', 'image_url'
    ];

    const customFields = {};
    Object.keys(formData).forEach(key => {
      if (!processedKeys.includes(key)) {
        customFields[key] = formData[key];
      }
    });

    // Prepare lead data for database
    const leadData = {
      id: uuidv4(),
      name: fullName,
      email: getEmail(),
      phone: getPhone(),
      age: getAge(),
      postcode: getPostcode(),
      parent_phone: getParentPhone(),
      image_url: getPhotoUrl(),
      notes: `Lead imported from Gravity Forms on ${new Date().toISOString()}`,
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
      'Name (Required)'
    ],
    optionalFields: [
      'Age',
      "Parent's Number",
      'Email',
      'Telephone Number',
      'Post Code',
      'Upload Photo (URL)'
    ],
    formFieldMapping: {
      'Name': 'Lead full name',
      'Age': 'Lead age',
      "Parent's Number": 'Parent/guardian phone number',
      'Email': 'Lead email address',
      'Telephone Number': 'Lead phone number',
      'Post Code': 'Lead postal code',
      'Upload Photo': 'Photo URL or file upload'
    },
    example: {
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
