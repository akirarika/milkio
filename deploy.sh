#!/usr/bin/bash

# 生成静态文件
npm run build

# 进入生成的文件夹
cd docs/.vuepress/dist \
&& git add -A \
&& git commit -m 'deploy' \
&& git push -f git@github.com:akirarika/kurimudb.git master:gh-pages

cd -