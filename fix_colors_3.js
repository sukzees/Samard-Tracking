const fs = require('fs');

function getFiles(dir, files = []) {
  const fileList = fs.readdirSync(dir);
  for (const file of fileList) {
    const name = `${dir}/${file}`;
    if (fs.statSync(name).isDirectory()) {
      if (name.includes('node_modules') || name.includes('.next')) continue;
      getFiles(name, files);
    } else {
      if (name.endsWith('.tsx') || name.endsWith('.ts')) {
        files.push(name);
      }
    }
  }
  return files;
}

const targetFiles = getFiles('./app').concat(getFiles('./components'));

const replacements = [
  { regex: /dark:bg-white dark:bg-\[#0C0C0E\]\/80/g, replacement: 'dark:bg-[#0C0C0E]/80' },
  { regex: /dark:bg-white dark:bg-\[#141417\]/g, replacement: 'dark:bg-[#141417]' },
  { regex: /dark:bg-white dark:bg-\[#1C1C21\]/g, replacement: 'dark:bg-[#1C1C21]' },
  { regex: /dark:bg-white dark:bg-\[#0C0C0E\]/g, replacement: 'dark:bg-[#0C0C0E]' }
];

for (const file of targetFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  for (const { regex, replacement } of replacements) {
    content = content.replace(regex, replacement);
  }
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Fixed ${file}`);
  }
}
