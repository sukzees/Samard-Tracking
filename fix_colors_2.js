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
  // Fix primary/danger buttons with wrong text color
  { regex: /bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-900 dark:text-white/g, replacement: 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white' },
  { regex: /bg-indigo-600 hover:bg-indigo-500 text-zinc-900 dark:text-white/g, replacement: 'bg-indigo-600 hover:bg-indigo-500 text-white' },
  { regex: /bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-zinc-900 dark:text-white/g, replacement: 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white' },
  { regex: /bg-rose-500 hover:bg-rose-600 text-zinc-900 dark:text-white/g, replacement: 'bg-rose-500 hover:bg-rose-600 text-white' },
  { regex: /hover:bg-rose-500 hover:text-zinc-900 dark:text-white/g, replacement: 'hover:bg-rose-500 hover:text-white' },
  { regex: /bg-indigo-600 text-zinc-900 dark:text-white/g, replacement: 'bg-indigo-600 text-white' },
  { regex: /bg-white\/80 dark:bg-black\/50 px-3 py-1\.5 rounded-lg border border-zinc-300 dark:border-white\/10/g, replacement: 'bg-zinc-800 dark:bg-black/50 px-3 py-1.5 rounded-lg border border-zinc-700 dark:border-white/10' }, 
  { regex: /text-sm font-semibold text-zinc-900 dark:text-white bg-zinc-800/g, replacement: 'text-sm font-semibold text-white bg-zinc-800' }, // BottomNav labels
  
  // Fix layout.tsx bug
  { regex: /dark:bg-slate-50 /g, replacement: '' },
  { regex: /dark:text-zinc-700 /g, replacement: '' },
  { regex: /dark:text-zinc-600 /g, replacement: '' },
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
