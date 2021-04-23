const execSync = require("child_process").execSync;

const path = process.argv[1];
const type = process.argv[2];
const name = process.argv[3];

console.log(path);

if ("docs" === type) {
  execSync(
    [
      `cd ./docs/.vitepress/dist`,
      `echo 'kurimudb.nito.ink' > CNAME`,
      `git init`,
      `git add -A`,
      `git commit -m 'deploy'`,
      `git push -f git@github.com:akirarika/kurimudb.git master:gh-pages`,
    ].join(" && "),
    {
      shell: "bash.exe",
    }
  );
} else if ("driver" === type) {
  execSync(
    [
      // 编译 typescript
      `rm -rf ./drivers/kurimudb-driver-${name}/dist`,
      `tsc --build drivers/kurimudb-driver-${name}`,
      // 发布 npm 新版本
      `cd ./drivers/kurimudb-driver-${name}`,
      `npm version patch`,
      `npm publish`,
    ].join(" && "),
    {
      shell: "bash.exe",
    }
  );
} else if ("kurimudb" === type) {
  execSync(
    [
      // 编译 typescript
      `rm -rf ./kurimudb/dist`,
      `tsc --build kurimudb`,
      // 发布 npm 新版本
      `cd ./kurimudb`,
      `npm version patch`,
      `npm publish`,
    ].join(" && "),
    {
      shell: "bash.exe",
    }
  );
} else if ("zero-config" === type) {
  execSync(
    [
      `rm -rf ./zero-config/dist`,
      `cd ./zero-config`,
      `npm install`,
      `npm run build`,
      `npm version patch`,
      `npm publish`,
    ].join(" && "),
    {
      shell: "bash.exe",
    }
  );
} else {
  console.error("command not found.");
}
