#!/usr/bin/bash

set -e

read -p "You need to publish the NPM package? [y/N]" yn

# 生成静态文件
npm run ts:build
npm run doc:build

if [ "$yn" = "y" ]
then
  npm publish
fi

# 进入生成的文件夹
cd docs/.vuepress/dist
echo 'kurimudb.nito.ink' > CNAME
git init
git add -A
git commit -m 'deploy'
git push -f git@github.com:akirarika/kurimudb.git master:gh-pages

cd -