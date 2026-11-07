# 创建并推送 GitHub 仓库

当前文件夹已经是一个本地 Git 仓库，包含正式版代码和第一次提交。

## 方法一：网页上传

1. 登录 GitHub
2. 打开 https://github.com/new
3. Repository name 填 `bieji-ddl`
4. 选择 Public
5. 不勾选 README、.gitignore 或 License
6. 创建仓库
7. 点击 Add file → Upload files
8. 上传当前文件夹中的全部文件，但不要上传 `.git` 文件夹
9. Commit changes

## 方法二：用脚本推送

1. 先在 https://github.com/new 创建空仓库 `bieji-ddl`
2. 在 PowerShell 中进入当前文件夹
3. 运行：

```powershell
.\PUSH_TO_GITHUB.ps1
```

脚本会连接：

```text
https://github.com/freshman-all/bieji-ddl.git
```

第一次推送时 Git Credential Manager 会打开 GitHub 登录窗口。登录后会自动完成推送。

## 开启 GitHub Pages

推送成功后：

1. 打开仓库 Settings
2. 点击 Pages
3. Deploy from a branch
4. Branch 选 `main`
5. 文件夹选 `/ (root)`
6. Save

网页地址通常是：

```text
https://freshman-all.github.io/bieji-ddl/
```

## 后续更新

```powershell
git add .
git commit -m "update"
git push
```

GitHub Pages 会自动更新，网址不变。
