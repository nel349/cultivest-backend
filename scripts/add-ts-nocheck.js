const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.join(__dirname, '../contracts/cultivest_contract/projects/cultivest_contract-contracts/smart_contracts/artifacts');
const TS_NOCHECK = '// @ts-nocheck';

function addTsNocheckToFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.startsWith(TS_NOCHECK)) {
    return; // Already present
  }
  const newContent = `${TS_NOCHECK}\n${content}`;
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`Added @ts-nocheck to: ${filePath}`);
}

function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      addTsNocheckToFile(fullPath);
    }
  }
}

processDir(ARTIFACTS_DIR); 