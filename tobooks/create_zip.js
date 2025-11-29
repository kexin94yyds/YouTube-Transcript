const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create ZIP archives of key packages
function createZipArchives() {
  console.log('Creating ZIP archives of key packages...');
  
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('Error: dist directory not found. Run package_keys.js first.');
    process.exit(1);
  }
  
  // Create archives directory if it doesn't exist
  const archivesDir = path.join(__dirname, 'archives');
  if (!fs.existsSync(archivesDir)) {
    fs.mkdirSync(archivesDir);
  }
  
  // Create individual ZIP archives for each key package
  for (let i = 1; i <= 10; i++) {
    const keyDir = path.join(distDir, `key_package_${i}`);
    if (fs.existsSync(keyDir)) {
      try {
        // Create ZIP archive using zip command (macOS/Linux)
        const zipPath = path.join(archivesDir, `private_key_${i}.zip`);
        execSync(`zip -r "${zipPath}" "${keyDir}"`);
        console.log(`✅ Created ZIP archive for key ${i}`);
      } catch (error) {
        console.error(`❌ Error creating ZIP archive for key ${i}:`, error.message);
      }
    }
  }
  
  // Create a single ZIP containing all key packages
  try {
    const allKeysZip = path.join(archivesDir, 'all_private_keys.zip');
    execSync(`zip -r "${allKeysZip}" "${distDir}"`);
    console.log('✅ Created ZIP archive containing all key packages');
  } catch (error) {
    console.error('❌ Error creating combined ZIP archive:', error.message);
  }
  
  console.log('\nAll ZIP archives created in the "archives" directory');
}

// Run the function
createZipArchives();