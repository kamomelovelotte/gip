// Accept the supervised preview's Vite-style flags while running real Next.js.
const input = process.argv.slice(2);
const args = [];
for (let i=0;i<input.length;i++) {
 if(input[i]==='--strictPort') continue;
 args.push(input[i]==='--host'?'--hostname':input[i]);
}
process.argv = [process.execPath, 'next', 'dev', '--webpack', ...args];
await import('next/dist/bin/next');
