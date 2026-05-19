const fs = require('fs');
const glob = require('glob'); // Note: 'glob' is not installed by default in standard Node.js without npm. Wait, no, I can just use a recursive function.

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
  { regex: /bg-\[#09090B\]/g, replacement: 'bg-slate-50 dark:bg-[#09090B]' },
  { regex: /bg-\[#141417\]/g, replacement: 'bg-white dark:bg-[#141417]' },
  { regex: /bg-\[#0C0C0E\]\/80/g, replacement: 'bg-white/80 dark:bg-[#0C0C0E]/80' },
  { regex: /bg-\[#0C0C0E\]/g, replacement: 'bg-white dark:bg-[#0C0C0E]' },
  { regex: /bg-\[#1C1C21\]/g, replacement: 'bg-white dark:bg-[#1C1C21]' },
  
  { regex: /text-white/g, replacement: 'text-zinc-900 dark:text-white' },
  { regex: /text-zinc-300/g, replacement: 'text-zinc-700 dark:text-zinc-300' },
  { regex: /text-zinc-400/g, replacement: 'text-zinc-600 dark:text-zinc-400' },
  
  { regex: /border-white\/5/g, replacement: 'border-zinc-200 dark:border-white/5' },
  { regex: /border-white\/10/g, replacement: 'border-zinc-300 dark:border-white/10' },
  { regex: /border-white\/20/g, replacement: 'border-zinc-300 dark:border-white/20' },
  
  { regex: /bg-white\/5/g, replacement: 'bg-zinc-100 dark:bg-white/5' },
  { regex: /bg-white\/10/g, replacement: 'bg-zinc-200 dark:bg-white/10' },
  { regex: /bg-white\/20/g, replacement: 'bg-zinc-300 dark:bg-white/20' },
  
  { regex: /bg-black\/50/g, replacement: 'bg-white/80 dark:bg-black/50' },
  { regex: /bg-black\/60/g, replacement: 'bg-white/60 dark:bg-black/60' },
  { regex: /bg-black\/20/g, replacement: 'bg-black/5 dark:bg-black/20' },
];

for (const file of targetFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  for (const { regex, replacement } of replacements) {
    content = content.replace(regex, replacement);
  }
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
