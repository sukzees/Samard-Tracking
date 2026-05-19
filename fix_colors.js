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
  // Fix hover states that got wrongly prefixed
  { regex: /hover:bg-zinc-100 dark:bg-white\/5/g, replacement: 'hover:bg-zinc-200 dark:hover:bg-white/5' },
  { regex: /hover:bg-zinc-200 dark:bg-white\/10/g, replacement: 'hover:bg-zinc-300 dark:hover:bg-white/10' },
  { regex: /hover:text-zinc-700 dark:text-zinc-300/g, replacement: 'hover:text-zinc-900 dark:hover:text-white' },
  { regex: /group-hover:bg-zinc-200 dark:bg-white\/10/g, replacement: 'group-hover:bg-zinc-200 dark:group-hover:bg-white/10' },
  { regex: /group-hover:text-zinc-700 dark:text-zinc-300/g, replacement: 'group-hover:text-zinc-900 dark:group-hover:text-white' },
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
