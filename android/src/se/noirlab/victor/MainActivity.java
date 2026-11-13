package se.noirlab.victor;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * V.I.C.T.O.R. som startskärm (launcher).
 *
 * Hela gränssnittet är samma webbsida som på datorn, paketerad i appen under assets.
 * Den här klassen visar sidan i en WebView och ger den en brygga (window.VictorNative)
 * till det en webbsida inte får göra själv: lista telefonens appar, hämta deras ikoner och starta dem.
 */
public class MainActivity extends Activity {

    /** Låtsasadress som sidan laddas från. ".invalid" är en reserverad toppdomän, så inget kan nå ut på nätet. */
    private static final String HOST = "victor.invalid";
    private static final int ICON_PX = 144;

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setBackgroundColor(0xFF02060B);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage: där appar, widgets och idéer sparas
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.addJavascriptInterface(new Bridge(), "VictorNative");
        web.setWebChromeClient(new WebChromeClient());   // behövs för confirm()/alert() i sidan
        web.setWebViewClient(new WebViewClient() {

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!HOST.equals(u.getHost())) return null;            // riktiga nätanrop (väder) går som vanligt
                String path = u.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                if (path.startsWith("/icon/")) return appIcon(path.substring("/icon/".length()));
                try {
                    return new WebResourceResponse(mime(path), isText(path) ? "utf-8" : null, getAssets().open(path.substring(1)));
                } catch (IOException e) {
                    return notFound();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                // länkar och protokoll (https:, spotify:, tel: …) öppnas i rätt app, inte inne i startskärmen
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception ignored) { /* ingen app kan öppna adressen */ }
                return true;
            }
        });

        web.loadUrl("https://" + HOST + "/index.html");
    }

    /** Hemknappen när startskärmen redan visas: gå tillbaka till glob-vyn. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (web != null) web.evaluateJavascript("window.nativeHome && window.nativeHome()", null);
    }

    /** En startskärm ska aldrig stängas med bakåt; sidan får backa en nivå i stället. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.nativeBack && window.nativeBack()", null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();      // pausar animationen så att den inte drar batteri i bakgrunden
        super.onPause();
    }

    // ------------------------------------------------------------------ hjälpare

    private static boolean isText(String path) {
        return !(path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".ico"));
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        return "application/octet-stream";
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    /** En installerad apps ikon som PNG, för <img src="/icon/paketnamn">. */
    private WebResourceResponse appIcon(String pkg) {
        try {
            Drawable d = getPackageManager().getApplicationIcon(pkg);
            Bitmap bmp = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888);
            d.setBounds(0, 0, ICON_PX, ICON_PX);
            d.draw(new Canvas(bmp));
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
            bmp.recycle();
            return new WebResourceResponse("image/png", null, new ByteArrayInputStream(out.toByteArray()));
        } catch (Exception e) {
            return notFound();
        }
    }

    // ------------------------------------------------------------------ bryggan till sidan

    private class Bridge {

        /** Alla appar som går att starta: [{pkg, label, cat}], där cat är Androids appkategori (-1 = okänd). */
        @JavascriptInterface
        public String getApps() {
            JSONArray arr = new JSONArray();
            try {
                PackageManager pm = getPackageManager();
                Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
                List<ResolveInfo> list = pm.queryIntentActivities(main, 0);
                Set<String> seen = new HashSet<String>();
                for (ResolveInfo ri : list) {
                    String pkg = ri.activityInfo.packageName;
                    if (pkg.equals(getPackageName()) || !seen.add(pkg)) continue;
                    JSONObject o = new JSONObject();
                    o.put("pkg", pkg);
                    o.put("label", String.valueOf(ri.loadLabel(pm)));
                    o.put("cat", ri.activityInfo.applicationInfo.category);
                    arr.put(o);
                }
            } catch (Exception ignored) { /* returnera det vi hann samla */ }
            return arr.toString();
        }

        /** Startar en app. Returnerar false om den inte finns eller inte går att starta. */
        @JavascriptInterface
        public boolean launch(String pkg) {
            final Intent i = getPackageManager().getLaunchIntentForPackage(pkg);
            if (i == null) return false;
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try { startActivity(i); } catch (Exception ignored) { }
                }
            });
            return true;
        }

        /** Öppnar Androids inställning för att välja standard-startskärm. */
        @JavascriptInterface
        public void homeSettings() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try { startActivity(new Intent(Settings.ACTION_HOME_SETTINGS)); }
                    catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
                }
            });
        }
    }
}
