// Génère "livre-de-recettes.html" : un seul fichier autonome (CSS + JS inclus),
// pratique à ranger dans un dossier et à ouvrir en double-clic.
// Utilisation : node build.js
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');

const single = html
  .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<link rel="manifest" href="manifest.json" />', '')
  // le fichier unique n'embarque aucune image : on retire tous les liens d'icône
  .replace(/\s*<link rel="(icon|apple-touch-icon)"[^>]*>/g, '')
  .replace('<script src="app.js"></script>', `<script>\n${js}\n</script>`)
  // pas de service worker ni de manifeste dans la version fichier unique
  .replace(/\n?\s*if \('serviceWorker' in navigator\) \{[\s\S]*?\n\}/, '');

fs.writeFileSync('livre-de-recettes.html', single);
console.log('livre-de-recettes.html généré (' + Math.round(single.length / 1024) + ' Ko)');
