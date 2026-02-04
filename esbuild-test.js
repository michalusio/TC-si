const esbuild = require('esbuild');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/test.ts'],
    bundle: true,
    format: 'cjs',
    minify: false,
    sourcemap: true,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist-test/test.js',
    external: ['vscode'],
    logLevel: 'silent',
    loader: { ".si": "text" },
    plugins: [
      esbuildProblemMatcherPlugin
    ]
  });
  await ctx.rebuild();
  await ctx.dispose();
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd(result => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  }
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});