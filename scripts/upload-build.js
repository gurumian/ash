#!/usr/bin/env node

/**
 * Upload Build Script for ash
 * 
 * This script uploads built installers to the Update Server.
 * The server automatically generates latest.yml from the uploaded files.
 * 
 * Usage:
 *   npm run upload
 * 
 * Server will:
 *   1. Receive the uploaded .exe files
 *   2. Extract version from filename (e.g., ash Setup 1.0.0.exe)
 *   3. Calculate SHA512 hash automatically
 *   4. Generate latest.yml dynamically when clients check for updates
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const https = require('https');

// Configuration
const SERVER_URL = 'https://cdn.toktoktalk.com';
const APP_NAME = 'ash';
const UPLOAD_TOKEN = 'GQsFZFcP7TehIe4p63S6qipq4WVfqRdPv8SjopTYiGBpCHG1XHdzxm5DMOwWoTl';
const packageJson = require('../package.json');
const VERSION = packageJson.version;

console.log('========================================');
console.log(`Uploading ${APP_NAME} v${VERSION}`);
console.log(`Platform: ${process.platform}`);
console.log('========================================\n');

/**
 * Upload a single file to the server
 */
function uploadFile(filePath, platform, arch) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    
    console.log(`📤 Uploading: ${fileName}`);
    console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Target: ${platform}/${arch}`);
    
    const form = new FormData();
    form.append('File', fs.createReadStream(filePath), fileName);
    
    const url = new URL(SERVER_URL);
    const options = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port || 443,
      path: `/upload/${APP_NAME}/${platform}/${arch}`,
      headers: {
        ...form.getHeaders(),
        'Authorization': UPLOAD_TOKEN
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(`   Response status: ${res.statusCode}`);
      console.log(`   Response headers:`, res.headers);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`   Response body:`, data);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✅ Successfully uploaded: ${fileName}\n`);
          try {
            const response = JSON.parse(data);
            if (response.file && response.file.url) {
              console.log(`   URL: ${SERVER_URL}${response.file.url}`);
              console.log(`   SHA512: ${response.file.sha512.substring(0, 32)}...`);
            }
          } catch (e) {
            console.log(`   (Non-JSON response)`);
          }
          resolve();
        } else {
          console.error(`❌ Upload failed: ${res.statusCode}`);
          console.error(`   Response: ${data}`);
          reject(new Error(`Upload failed: ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`❌ Upload error: ${err.message}`);
      reject(err);
    });
    
    form.pipe(req);
  });
}

/**
 * Upload Windows builds (x64 and arm64 - 32-bit/ia32 not supported)
 */
async function uploadWindows() {
  console.log('📦 Processing Windows builds...\n');
  
  const outDir = path.join(__dirname, '..', 'out', 'make');
  const nsisDir = path.join(outDir, 'nsis');
  
  if (!fs.existsSync(nsisDir)) {
    console.error('❌ NSIS output directory not found!');
    console.error('   Expected: ' + nsisDir);
    console.error('   Please run "npm run make" first');
    process.exit(1);
  }
  
  const uploaded = [];
  
  const uploaded = [];
  
  // Upload x64 build - only current version
  const x64Dir = path.join(nsisDir, 'x64');
  if (fs.existsSync(x64Dir)) {
    const expectedX64Name = `ash-x64-Setup-${VERSION}.exe`;
    const x64Files = fs.readdirSync(x64Dir).filter(f => f === expectedX64Name);
    for (const file of x64Files) {
      await uploadFile(path.join(x64Dir, file), 'win32', 'x64');
      uploaded.push({ file, arch: 'x64' });
    }
    if (x64Files.length === 0) {
      console.warn(`⚠️  Expected x64 installer not found: ${expectedX64Name}`);
    }
  }

  // Upload arm64 build - only current version
  const arm64Dir = path.join(nsisDir, 'arm64');
  if (fs.existsSync(arm64Dir)) {
    const expectedArm64Name = `ash-arm64-Setup-${VERSION}.exe`;
    const arm64Files = fs.readdirSync(arm64Dir).filter(f => f === expectedArm64Name);
    for (const file of arm64Files) {
      await uploadFile(path.join(arm64Dir, file), 'win32', 'arm64');
      uploaded.push({ file, arch: 'arm64' });
    }
    if (arm64Files.length === 0) {
      console.warn(`⚠️  Expected arm64 installer not found: ${expectedArm64Name}`);
    }
  }
  
  if (uploaded.length === 0) {
    console.error('❌ No .exe files found!');
    console.error('   Please run "npm run make" first');
    process.exit(1);
  }
  
  return uploaded;
}

/**
 * Upload macOS builds (ZIP for auto-updates, DMG for manual distribution)
 */
async function uploadMacOS() {
  console.log('📦 Processing macOS builds...\n');
  
  const outDir = path.join(__dirname, '..', 'out', 'make');
  const arch = process.arch; // arm64 or x64
  
  if (!fs.existsSync(outDir)) {
    console.error('❌ Output directory not found!');
    console.error('   Expected: ' + outDir);
    console.error('   Please run "npm run make" first');
    process.exit(1);
  }
  
  const uploaded = [];
  
  // Upload ZIP files (for auto-updates) - check in zip subdirectory
  const zipDir = path.join(outDir, 'zip', 'darwin', arch);
  if (fs.existsSync(zipDir)) {
    // Only upload the current version's ZIP file
    const expectedZipName = `ash-darwin-${arch}-${VERSION}.zip`;
    const zipFiles = fs.readdirSync(zipDir).filter(f => f === expectedZipName);
    if (zipFiles.length > 0) {
      console.log('📤 Uploading ZIP file for auto-updates...\n');
      for (const file of zipFiles) {
        await uploadFile(path.join(zipDir, file), 'darwin', arch);
        uploaded.push({ file, arch, type: 'ZIP (auto-update)' });
      }
    } else {
      console.warn(`⚠️  Expected ZIP file not found: ${expectedZipName}`);
      console.warn('   Auto-updates will not work!');
    }
  } else {
    console.warn('⚠️  ZIP directory not found - auto-updates will not work!');
    console.warn('   Expected: ' + zipDir);
  }
  
  // Upload DMG files (for manual distribution)
  // DMG filename includes version for consistency with ZIP files
  const expectedDmgName = `ash-${VERSION}.dmg`;
  const dmgFiles = fs.readdirSync(outDir).filter(f => f === expectedDmgName);
  if (dmgFiles.length > 0) {
    console.log('\n📤 Uploading DMG file for manual distribution...\n');
    for (const file of dmgFiles) {
      await uploadFile(path.join(outDir, file), 'darwin', arch);
      uploaded.push({ file, arch, type: 'DMG (manual)' });
    }
  } else {
    console.warn(`⚠️  Expected DMG file not found: ${expectedDmgName}`);
  }
  
  if (uploaded.length === 0) {
    console.error('❌ No .zip or .dmg files found!');
    console.error('   Please run "npm run make" first');
    process.exit(1);
  }
  
  return uploaded;
}

/**
 * Upload Linux builds (AppImage and DEB)
 */
async function uploadLinux() {
  console.log('📦 Processing Linux builds...\n');
  
  const outDir = path.join(__dirname, '..', 'out', 'make');
  const arch = process.arch; // x64, arm64
  
  if (!fs.existsSync(outDir)) {
    console.error('❌ Output directory not found!');
    console.error('   Expected: ' + outDir);
    console.error('   Please run "npm run make" first');
    process.exit(1);
  }
  
  const uploaded = [];
  
  // Upload AppImage files (Universal Linux - for auto-updates)
  const appImageDir = path.join(outDir, 'AppImage', arch);
  if (fs.existsSync(appImageDir)) {
    const appImageFiles = fs.readdirSync(appImageDir).filter(f => f.endsWith('.AppImage'));
    if (appImageFiles.length > 0) {
      console.log('📤 Uploading AppImage for auto-updates...\n');
      for (const file of appImageFiles) {
        await uploadFile(path.join(appImageDir, file), 'linux', arch);
        uploaded.push({ file, arch, type: 'AppImage (auto-update)' });
      }
    }
  } else {
    console.warn('⚠️  AppImage directory not found - auto-updates will not work!');
    console.warn('   Expected: ' + appImageDir);
  }
  
  // Upload DEB files (Debian/Ubuntu)
  const debDir = path.join(outDir, 'deb', arch);
  if (fs.existsSync(debDir)) {
    const debFiles = fs.readdirSync(debDir).filter(f => f.endsWith('.deb'));
    if (debFiles.length > 0) {
      console.log('\n📤 Uploading DEB package for Debian/Ubuntu...\n');
      for (const file of debFiles) {
        await uploadFile(path.join(debDir, file), 'linux', arch);
        uploaded.push({ file, arch, type: 'DEB (Debian/Ubuntu)' });
      }
    }
  }
  
  if (uploaded.length === 0) {
    console.error('❌ No .AppImage or .deb files found!');
    console.error('   Please run "npm run make" first');
    process.exit(1);
  }
  
  return uploaded;
}

/**
 * Main upload process
 */
async function main() {
  try {
    let uploaded = [];
    
    if (process.platform === 'win32') {
      uploaded = await uploadWindows();
    } else if (process.platform === 'darwin') {
      uploaded = await uploadMacOS();
    } else if (process.platform === 'linux') {
      uploaded = await uploadLinux();
    } else {
      console.error(`❌ Unsupported platform: ${process.platform}`);
      process.exit(1);
    }
    
    console.log('\n========================================');
    console.log('✅ Upload completed successfully!');
    console.log('========================================');
    console.log(`\n📋 Summary:`);
    console.log(`   Files uploaded: ${uploaded.length}`);
    uploaded.forEach(({ file, arch, type }) => {
      const typeLabel = type ? ` [${type}]` : '';
      console.log(`   - ${file} (${arch})${typeLabel}`);
    });
    
    console.log(`\n🔗 Update server will automatically:`);
    console.log(`   1. Calculate SHA512 hashes`);
    console.log(`   2. Extract version from filename`);
    console.log(`   3. Generate latest.yml dynamically`);
    
    console.log(`\n📍 Update endpoints:`);
    if (process.platform === 'win32') {
      console.log(`   - ${SERVER_URL}/update/${APP_NAME}/latest.yml`);
    } else if (process.platform === 'darwin') {
      console.log(`   - ${SERVER_URL}/update/${APP_NAME}/latest-mac.yml`);
    } else if (process.platform === 'linux') {
      console.log(`   - ${SERVER_URL}/update/${APP_NAME}/latest-linux.yml`);
    }
    
    console.log(`\n💡 Test update check:`);
    if (process.platform === 'win32') {
      console.log(`   curl ${SERVER_URL}/update/${APP_NAME}/latest.yml`);
    } else if (process.platform === 'darwin') {
      console.log(`   curl ${SERVER_URL}/update/${APP_NAME}/latest-mac.yml`);
    } else if (process.platform === 'linux') {
      console.log(`   curl ${SERVER_URL}/update/${APP_NAME}/latest-linux.yml`);
    }
    
    console.log(`\n🎉 Ready for auto-updates!\n`);
    
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    process.exit(1);
  }
}

// Run the upload process
main();

