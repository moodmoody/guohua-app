# 国画管理 Web App 部署文档

本文档说明如何把项目部署到公网可访问环境。

## 1. 部署方案选择

当前项目使用本地文件存储（`uploads/` + `data/paintings.json`），推荐方案：

- 方案 A（推荐）：Linux 云服务器 + Node.js + PM2 + Nginx + HTTPS
- 方案 B：Docker + Nginx（适合你熟悉容器的情况）

不推荐直接部署到无持久磁盘的平台（如部分 Serverless/静态托管），否则图片和数据可能丢失。

## 2. 前置准备

1. 一台 Linux 云服务器（Ubuntu 22.04/24.04 均可）
2. 一个域名，并已解析到服务器公网 IP
3. 服务器安全组放行端口：`22`、`80`、`443`
4. 项目代码已在 GitHub 仓库（你当前仓库：`https://github.com/moodmoody/guohua-app`）

## 3. 方案 A：Node + PM2 + Nginx（推荐）

### 3.1 安装基础环境

```bash
sudo apt update
sudo apt install -y git nginx nodejs npm
sudo npm install -g pm2
```

验证：

```bash
node -v
npm -v
pm2 -v
nginx -v
```

### 3.2 拉代码并安装依赖

```bash
cd /var/www
sudo git clone https://github.com/moodmoody/guohua-app.git
sudo chown -R $USER:$USER /var/www/guohua-app
cd /var/www/guohua-app
npm install
```

### 3.3 启动 Node 服务

```bash
pm2 start server.js --name guohua-app
pm2 save
pm2 startup
```

查看状态：

```bash
pm2 status
pm2 logs guohua-app
```

### 3.4 配置 Nginx 反向代理

创建配置文件：

```bash
sudo nano /etc/nginx/sites-available/guohua-app
```

写入（把 `your-domain.com` 换成你的域名）：

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

说明：`client_max_body_size` 需大于等于后端素材上传限制（当前后端为 `100MB`），否则会出现 Nginx `413 Request Entity Too Large`。

启用并重载：

```bash
sudo ln -s /etc/nginx/sites-available/guohua-app /etc/nginx/sites-enabled/guohua-app
sudo nginx -t
sudo systemctl reload nginx
```

### 3.5 配置 HTTPS（Let’s Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

证书自动续期测试：

```bash
sudo certbot renew --dry-run
```

## 4. 方案 B：Docker（可选）

你可以后续再补 `Dockerfile` 和 `docker-compose.yml`，然后使用：

```bash
docker compose up -d
```

如果你需要，我可以下一步直接给你补齐容器文件。

## 5. 发布更新流程

每次更新代码后，在服务器执行：

```bash
cd /var/www/guohua-app
git pull
npm install
pm2 restart guohua-app
pm2 status
```

## 6. 备份建议（重要）

请定期备份这两个路径：

- `/var/www/guohua-app/uploads/`
- `/var/www/guohua-app/data/paintings.json`

示例（按日期打包）：

```bash
cd /var/www/guohua-app
tar -czf backup-$(date +%F).tar.gz uploads data/paintings.json
```

## 7. 常见问题排查

1. 页面打不开  
检查：`pm2 status`、`pm2 logs guohua-app`、`sudo nginx -t`、`sudo systemctl status nginx`

2. 上传后图片 404  
检查 `uploads/` 是否存在、Nginx 是否正确反代到 `3000`、应用是否仍在运行

3. 重启后服务没起来  
执行 `pm2 save` 和 `pm2 startup`，并按提示完成开机自启设置
