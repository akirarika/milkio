#!/usr/bin/bash

set -e

# 生成静态文件
npm run ts:build
npm run doc:build
npm publish

# 进入生成的文件夹
cd docs/.vuepress/dist
git init
git add -A
git commit -m 'deploy'
git push -f git@github.com:akirarika/kurimudb.git master:gh-pages

cd -