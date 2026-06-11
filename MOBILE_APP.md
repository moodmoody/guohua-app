# 墨舞丹青手机 App 打包说明

当前手机 App 采用 Capacitor Android 壳，直接加载云端 Web 应用：

- App ID: `com.guohua.app`
- App 名称: `墨舞丹青`
- 云端地址: `http://124.220.36.240`
- Android 工程目录: `android/`

## 常用命令

同步 Web/PWA 文件和 Capacitor 配置到 Android 工程：

```powershell
npm run mobile:sync
```

打开 Android Studio：

```powershell
npm run mobile:open
```

构建调试 APK：

```powershell
npm run mobile:build:android
```

成功后 APK 路径：

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

## 本机构建环境

要在这台电脑直接打 APK，需要先安装并配置：

- JDK 17 或更高版本，并设置 `JAVA_HOME`
- Android Studio 或 Android SDK，并设置 Android SDK 路径

当前如果运行 `npm run mobile:build:android` 时提示找不到 `java`，说明 `JAVA_HOME` 还没有配置好。

## 注意事项

- 这个版本是 Android 优先，iOS 需要苹果开发者账号和签名流程后再接。
- 当前 App 壳访问云端 Web，因此云服务器必须在线。
- 如果修改了前端静态文件、`manifest.webmanifest`、`sw.js` 或 Capacitor 配置，先运行 `npm run mobile:sync`。
- 正式上架前应配置正式签名证书，并考虑把云端改为 HTTPS。
