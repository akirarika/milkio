cp ./examples/src/modexie/* ./dist
git add .
git commit -m "update"
git push
sleep 3
npm config delete registry
npm version minor
npm publish