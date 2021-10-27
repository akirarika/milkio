#!/usr/bin/env sh

# abort on errors
set -e

# navigate into the build output directory
cd docs/.vitepress/dist

# if you are deploying to a custom domain
echo 'kurimudb.nito.ink' > CNAME

git init
git add -A
git commit -m 'deploy'

# if you are deploying to https://<USERNAME>.github.io
# git push -f git@github.com:<USERNAME>/<USERNAME>.github.io.git master

# if you are deploying to https://<USERNAME>.github.io/<REPO>
git push -f git@github.com:akirarika/kurimudb.git master:gh-pages

cd -