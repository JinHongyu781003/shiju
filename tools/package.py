"""Build a portable single HTML and a source archive, without dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import base64

root = Path(__file__).resolve().parents[1]
release = root.parent / 'deliverables'
release.mkdir(exist_ok=True)
html = (root / 'index.html').read_text()
css = (root / 'styles.css').read_text()
engine = (root / 'engine.js').read_text().replace('</script', '<\\/script')
app = (root / 'app.js').read_text().replace('</script', '<\\/script')
icon = base64.b64encode((root / 'favicon.svg').read_bytes()).decode()
html = html.replace('./favicon.svg', f'data:image/svg+xml;base64,{icon}')
html = html.replace('  <link rel="stylesheet" href="./styles.css">', '<style>\n' + css + '\n</style>')
html = html.replace('  <script defer src="./engine.js"></script>\n', '')
html = html.replace('  <script defer src="./app.js"></script>\n', '')
html = html.replace('</body>', '<script>\n' + engine + '\n</script>\n<script>\n' + app + '\n</script>\n</body>')
standalone = release / 'shiju.html'
standalone.write_text(html)
files = ['index.html', 'styles.css', 'engine.js', 'app.js', 'favicon.svg', '.nojekyll', 'README.md', 'tests/engine.test.cjs', 'tools/package.py']
archive = release / 'shiju-source.zip'
with ZipFile(archive, 'w', ZIP_DEFLATED) as output:
    for name in files:
        output.write(root / name, 'shiju/' + name)
    output.write(standalone, 'shiju/shiju.html')
for path in [standalone, archive]:
    print(str(path), path.stat().st_size, 'bytes')
