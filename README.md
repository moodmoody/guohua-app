# 国画管理 Web App

一个简单的本地 Web 应用，用于管理国画作品，支持：

- 上传作品图片（JPG/PNG/WEBP，最大 10MB）
- 填写标题、分类、简介
- 按分类筛选、按关键词搜索
- 给每幅作品添加评论

## 启动方式

```bash
npm install
npm start
```

启动后访问：`http://localhost:3000`

## 数据存储

- 作品数据：`data/paintings.json`
- 上传图片：`uploads/`

这是本地文件存储方案，适合个人使用和快速部署。
