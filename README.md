# 墨舞丹青 · 画事案卷

一个面向国画作品与资料整理的 Web 应用，支持用户登录、作品管理、素材归档与评论记录。

## 当前功能

- 用户注册、登录、资料管理（头像、简介）
- 作品管理：上传、编辑、分类、检索、评论
- 素材管理：图片/视频资料归档与检索
- 附件上传后可移除（文件选择列表支持删除）
- 花鸟水墨主题 UI：登录页与主界面统一为背景融合风格

## 本地启动

```bash
npm install
npm start
```

启动后访问：`http://localhost:3000`

## 使用说明

日常使用方法见 [USER_MANUAL.md](./USER_MANUAL.md)。

## 目录说明

- `server.js`：后端入口
- `public/`：前端页面与样式
- `public/assets/logo-huaniao-user.jpeg`：当前水墨花鸟主题图
- `data/`：业务数据（用户、作品、素材等）
- `uploads/`：上传文件目录

## 部署

已在线部署目录：`/var/www/guohua-app`  
进程管理：`pm2`（进程名：`guohua-app`）

完整部署步骤见 [DEPLOY.md](./DEPLOY.md)。
