git add .
git commit -m "update"
git push
cp .\examples\src\modexie\* .\dist
npm config set registry=http://registry.npmjs.org
npm version minor
npm publish