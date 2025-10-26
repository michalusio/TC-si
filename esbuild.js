const esbuild = require('esbuild');

const {copy} = require('esbuild-plugin-copy');
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    loader: { ".si": "text" },
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
      copy({
        resolveFrom: 'cwd',
        assets: {
          from: ['./src/si.tmLanguage.json'],
          to: ['./dist/si.tmLanguage.json'],
        },
        watch,
      }),
      copy({
        resolveFrom: 'cwd',
        assets: {
          from: ['./src/symphony.tmLanguage.json'],
          to: ['./dist/symphony.tmLanguage.json'],
        },
        watch,
      }),
    ]
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
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