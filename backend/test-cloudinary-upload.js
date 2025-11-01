// Test script for Cloudinary upload
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  try {
    console.log('🧪 Testing Cloudinary Upload...\n');

    // Read test image
    const imagePath = path.join(__dirname, '../frontend/public/logo.png');
    if (!fs.existsSync(imagePath)) {
      console.error('❌ Test image not found:', imagePath);
      process.exit(1);
    }

    console.log('📁 Test image:', imagePath);
    console.log('📊 File size:', fs.statSync(imagePath).size, 'bytes\n');

    // Create FormData
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath));

    // Upload to backend
    console.log('📤 Uploading to http://localhost:5000/api/bulletin/upload...\n');
    
    const response = await fetch('http://localhost:5000/api/bulletin/upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ Upload Successful!\n');
      console.log('📋 Response:');
      console.log(JSON.stringify(data, null, 2));
      console.log('\n🎉 Cloudinary integration is working!');
    } else {
      console.error('❌ Upload Failed!');
      console.error('Status:', response.status);
      console.error('Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testUpload();

