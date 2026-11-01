import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Marked, Renderer } from 'marked';

const sourcePath = fileURLToPath(new URL('../docs/api/suitable-fly-zone.md', import.meta.url));

// Render the checked-in backend document at build time, so the public reader
// needs neither a login nor a running API/JavaScript service.
export function apiDocumentPlugin() {
  return {
    name: 'api-document',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        if (!context.filename.replaceAll('\\', '/').endsWith('/docs/api/index.html')) return;
        const toc = [];
        const renderer = new Renderer();
        renderer.heading = function ({ tokens, depth }) {
          const text = this.parser.parseInline(tokens);
          if (depth !== 2) return `<h${depth}>${text}</h${depth}>\n`;
          const id = `section-${toc.length + 1}`;
          toc.push(`<a href="#${id}">${text}</a>`);
          return `<h2 id="${id}">${text}</h2>\n`;
        };
        const table = renderer.table;
        renderer.table = function (token) {
          return `<div class="table-scroll" tabindex="0" role="region" aria-label="接口说明表格">${table.call(this, token)}</div>`;
        };
        const content = new Marked({ renderer }).parse(fs.readFileSync(sourcePath, 'utf8'));
        return html.replace('<!-- api-document -->', content).replace('<!-- api-toc -->', toc.join('\n'));
      },
    },
    buildStart() {
      this.addWatchFile(sourcePath);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'docs/api/suitable-fly-zone.md', source: fs.readFileSync(sourcePath) });
    },
    configureServer(server) {
      server.watcher.add(sourcePath);
      server.watcher.on('change', filename => {
        if (filename === sourcePath) server.ws.send({ type: 'full-reload', path: '/docs/api/' });
      });
    },
  };
}
