package com.ranjeet.videodownloader;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.RelativeLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    // ============================================================
    // 🔧 CONFIGURATION — Change your URL here
    // ============================================================
    // Option A: Use your Vercel deployed URL (recommended for WebView)
    private static final String WEB_APP_URL = "https://video-downloader-ai-app.vercel.app";
    // Option B: Local development (when running npm run dev on same network)
    // private static final String WEB_APP_URL = "http://192.168.x.x:3000";
    // ============================================================

    private static final int PERMISSION_REQUEST_CODE = 1001;

    private WebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefreshLayout;
    private RelativeLayout noInternetLayout;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Initialize views
        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);
        noInternetLayout = findViewById(R.id.noInternetLayout);
        TextView retryButton = findViewById(R.id.retryButton);

        // Request permissions
        requestStoragePermissions();

        // Configure WebView
        setupWebView();

        // Pull-to-refresh
        swipeRefreshLayout.setColorSchemeColors(
            getResources().getColor(R.color.colorPrimary, getTheme()),
            getResources().getColor(R.color.colorSecondary, getTheme())
        );
        swipeRefreshLayout.setOnRefreshListener(() -> {
            webView.reload();
        });

        // Retry button when no internet
        retryButton.setOnClickListener(v -> {
            if (isNetworkAvailable()) {
                noInternetLayout.setVisibility(View.GONE);
                swipeRefreshLayout.setVisibility(View.VISIBLE);
                loadWebApp();
            } else {
                Toast.makeText(this, "Still no internet connection", Toast.LENGTH_SHORT).show();
            }
        });

        // Load the web app
        if (isNetworkAvailable()) {
            loadWebApp();
        } else {
            showNoInternet();
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();

        // Enable JavaScript (required for our React/HTML app)
        settings.setJavaScriptEnabled(true);

        // Enable DOM Storage (localStorage, sessionStorage)
        settings.setDomStorageEnabled(true);

        // Enable databases
        settings.setDatabaseEnabled(true);

        // Allow file access
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Enable media playback without user gesture
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Enable zoom controls
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);

        // Responsive viewport
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        // Cache settings
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Mixed content (for loading http resources on https pages)
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // Enable cookies
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // Custom user agent to identify Android app
        String defaultUserAgent = settings.getUserAgentString();
        settings.setUserAgentString(defaultUserAgent + " AIVideoDownloaderApp/1.0 Android");

        // Hardware acceleration
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // WebViewClient — handle page navigation
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                // Open external URLs in browser (YouTube, Instagram, etc.)
                if (!url.contains("vercel.app") && !url.contains("localhost") &&
                    !url.contains("192.168") && (url.startsWith("http") || url.startsWith("https"))) {
                    
                    // For video/download links, use DownloadManager
                    if (url.endsWith(".mp4") || url.endsWith(".mp3") || 
                        url.endsWith(".webm") || url.contains("download")) {
                        startDownload(url, URLUtil.guessFileName(url, null, null));
                        return true;
                    }
                    
                    // Open in external browser
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Stop SwipeRefresh spinner
                swipeRefreshLayout.setRefreshing(false);
                // Inject JS bridge for download handling
                injectJavascriptBridge();
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                if (!isNetworkAvailable()) {
                    showNoInternet();
                }
            }
        });

        // WebChromeClient — handle JS dialogs, progress, file chooser
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                super.onProgressChanged(view, newProgress);
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public void onReceivedTitle(WebView view, String title) {
                super.onReceivedTitle(view, title);
                // You can update a toolbar title here if needed
            }
        });

        // Download listener — intercept download links
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                
                // Show download confirmation dialog
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Download")
                    .setMessage("Download " + fileName + "?")
                    .setPositiveButton("Download", (dialog, which) -> {
                        startDownload(url, fileName);
                    })
                    .setNegativeButton("Cancel", null)
                    .show();
            }
        });
    }

    private void loadWebApp() {
        webView.loadUrl(WEB_APP_URL);
    }

    /**
     * Inject JavaScript bridge to communicate between WebView and Android
     */
    private void injectJavascriptBridge() {
        String script = "javascript:(function() {" +
            // Detect if running in Android WebView
            "window.isAndroidApp = true;" +
            
            // Override download button behavior
            "document.querySelectorAll('a[download], .download-btn, #downloadBtn').forEach(function(el) {" +
            "  el.addEventListener('click', function(e) {" +
            "    var href = el.href || el.dataset.url;" +
            "    if (href && href.startsWith('http')) {" +
            "      Android.downloadFile(href, el.download || 'video.mp4');" +
            "      e.preventDefault();" +
            "    }" +
            "  });" +
            "});" +
            
            // Hide desktop-only elements on mobile
            "var style = document.createElement('style');" +
            "style.textContent = '.desktop-only { display: none !important; }';" +
            "document.head.appendChild(style);" +
            
        "})()";
        
        webView.evaluateJavascript(script, null);
    }

    /**
     * Start a download using Android DownloadManager
     */
    private void startDownload(String url, String fileName) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("AI Video Downloader");
            request.setDescription("Downloading: " + fileName);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            request.addRequestHeader("User-Agent", webView.getSettings().getUserAgentString());
            request.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));

            DownloadManager downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (downloadManager != null) {
                downloadManager.enqueue(request);
                Toast.makeText(this, "⬇️ Downloading: " + fileName, Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            // Fallback: open in browser
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
        }
    }

    /**
     * Check internet connection
     */
    private boolean isNetworkAvailable() {
        ConnectivityManager connectivityManager = 
            (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager != null) {
            NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
            return activeNetworkInfo != null && activeNetworkInfo.isConnected();
        }
        return false;
    }

    private void showNoInternet() {
        swipeRefreshLayout.setVisibility(View.GONE);
        noInternetLayout.setVisibility(View.VISIBLE);
    }

    /**
     * Request storage permissions for downloading
     */
    private void requestStoragePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ — use new media permissions
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                    new String[]{
                        Manifest.permission.READ_MEDIA_VIDEO,
                        Manifest.permission.READ_MEDIA_IMAGES
                    }, PERMISSION_REQUEST_CODE);
            }
        } else if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            // Android 9 and below
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                    new String[]{
                        Manifest.permission.WRITE_EXTERNAL_STORAGE,
                        Manifest.permission.READ_EXTERNAL_STORAGE
                    }, PERMISSION_REQUEST_CODE);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "✅ Storage permission granted", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "⚠️ Storage permission needed for downloads", Toast.LENGTH_LONG).show();
            }
        }
    }

    // Handle Android back button
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) {
                webView.goBack();
                return true;
            } else {
                // Show exit confirmation
                new AlertDialog.Builder(this)
                    .setTitle("Exit App")
                    .setMessage("Are you sure you want to exit?")
                    .setPositiveButton("Exit", (dialog, which) -> finish())
                    .setNegativeButton("Cancel", null)
                    .show();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (webView != null) {
            webView.destroy();
        }
    }
}
