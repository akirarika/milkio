git add .
git commit -m "update"
git push
npm config delete registry
npm version minor
npm publish