# 📱 Android Studio Integration Guide
## AI Video Downloader — Mobile App

---

## 📋 Two Approaches Included

| Feature | WebView Wrapper (`android-webview/`) | Capacitor |
|---|---|---|
| Folder | `android-webview/` | Run Capacitor commands |
| Backend | Vercel (hosted) | Vercel (hosted) |
| Setup | Open in Android Studio | npm commands |
| Native Feel | Good | Better |
| Offline | No | Partial |

---

## 🚀 Approach A — WebView Wrapper (android-webview/)

### Step 1: Set Your App URL
Open `android-webview/app/src/main/java/com/ranjeet/videodownloader/MainActivity.java`

Find line:
```java
private static final String WEB_APP_URL = "https://your-app.vercel.app";
```
Replace with your actual Vercel URL (e.g., `https://video-downloader-ai.vercel.app`).

### Step 2: Open in Android Studio
1. Open **Android Studio**
2. Click **"Open"** (not New Project)
3. Navigate to: `C:\Users\Victus\OneDrive\Desktop\app\android-webview\`
4. Click **OK** → wait for Gradle sync to complete

### Step 3: Run the App
1. Connect Android phone (USB debugging ON) OR start an **AVD Emulator**
2. Click ▶️ **Run** button
3. App will install and launch!

### Step 4: Build APK
```
Build → Build Bundle(s) / APK(s) → Build APK(s)
```
APK will be at: `android-webview/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔋 Approach B — Capacitor Integration

### Step 1: Install Capacitor
```bash
cd C:\Users\Victus\OneDrive\Desktop\app

# Install Capacitor packages
npm install @capacitor/core @capacitor/cli @capacitor/android

# Initialize (config already created at capacitor.config.json)
npx cap init "AI Video Downloader" "com.ranjeet.videodownloader" --web-dir public

# Add Android platform
npx cap add android
```

### Step 2: Sync Web Files
```bash
# Every time you change public/ files, run:
npx cap sync android
```

### Step 3: Open in Android Studio
```bash
npx cap open android
```
This opens the Android project directly in Android Studio!

### Step 4: Update API URL in public/app.js
Since backend runs on Vercel, make sure API calls point to your Vercel URL:
```javascript
// In public/app.js, change base URL:
const API_BASE = window.isAndroidApp 
    ? 'https://your-app.vercel.app/api'  // ← Your Vercel URL
    : '/api';                              // Local dev
```

---

## 📁 File Structure

```
android-webview/
├── app/
│   ├── src/main/
│   │   ├── java/com/ranjeet/videodownloader/
│   │   │   ├── MainActivity.java      ← WebView logic
│   │   │   └── SplashActivity.java    ← Splash screen
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   ├── activity_main.xml  ← WebView layout
│   │   │   │   └── activity_splash.xml
│   │   │   ├── values/
│   │   │   │   ├── colors.xml         ← Brand colors
│   │   │   │   ├── strings.xml
│   │   │   │   └── themes.xml
│   │   │   └── xml/
│   │   │       ├── network_security_config.xml
│   │   │       └── file_paths.xml
│   │   └── AndroidManifest.xml
│   └── build.gradle
├── build.gradle
├── settings.gradle
└── gradle.properties
```

---

## ⚙️ Android Requirements

| Requirement | Version |
|---|---|
| Android Studio | Iguana 2024+ or newer |
| Min Android SDK | 21 (Android 5.0) |
| Target Android SDK | 34 (Android 14) |
| Java | JDK 8+ |
| Gradle | 8.4 |

---

## 🛠️ Troubleshooting

### Gradle sync fails
- File → Invalidate Caches → Restart
- Check internet connection
- Update Android Studio to latest

### WebView shows blank
- Check that `WEB_APP_URL` is correct in `MainActivity.java`
- Ensure Vercel app is deployed and running

### Download not working
- Allow storage permission when prompted
- Check if Vercel URL is accessible

### App crashes on start
- Check `AndroidManifest.xml` for correct package name
- Ensure all layout files are present

---

## 📦 Publishing to Play Store

1. Generate signed APK: Build → Generate Signed Bundle/APK
2. Create keystore file (keep it safe!)
3. Upload `.aab` file to Google Play Console
4. Fill in store listing details

---

*Made with ❤️ by Ranjeet | AI Video Downloader v1.0.0*
