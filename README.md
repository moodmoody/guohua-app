# 国画管理 Web App

一个本地可运行的国画作品管理系统，支持：

- 上传作品图片（JPG/PNG/WEBP，最大 10MB）
- 填写标题、分类、简介
- 按分类筛选、按关键词搜索
- 给每幅作品添加评论

## 本地启动

```bash
npm install
npm start
```

启动后访问：`http://localhost:3000`

## 数据存储

- 作品数据：`data/paintings.json`
- 上传图片：`uploads/`

## 部署到网上

请看部署文档：[DEPLOY.md](./DEPLOY.md)
