package se.noirlab.victor.vr;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;

// Öppnar V.I.C.T.O.R. i headsetets webbläsare (?headset visar en stor knapp för att gå in i VR) och stänger sig själv.
// Listan med spel och appar som finns installerade i headsetet skickas med i adressen (#ha=...), så att V.I.C.T.O.R.
// kan visa dem i globen "Headset". De startas sedan via tjänsten Bridge (127.0.0.1:8771).
public class Launch extends Activity {
    static final String URL = "https://vbridgemountain.github.io/victor/desktop/?headset";

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        try { startService(new Intent(this, Bridge.class)); } catch (Exception ignored) { }
        String url = URL;
        try { url += "#ha=" + Base64.encodeToString(apps().toString().getBytes("UTF-8"), Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING); }
        catch (Exception ignored) { }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            Toast.makeText(this, "Hittar ingen webbläsare i headsetet.", Toast.LENGTH_LONG).show();
        }
        finish();
    }

    // Installerade (inte inbyggda) appar som går att starta, utom den här
    JSONArray apps() throws Exception {
        PackageManager pm = getPackageManager();
        JSONArray out = new JSONArray();
        for (ApplicationInfo a : pm.getInstalledApplications(0)) {
            if ((a.flags & ApplicationInfo.FLAG_SYSTEM) != 0 || a.packageName.equals(getPackageName())) continue;
            if (pm.getLaunchIntentForPackage(a.packageName) == null) continue;   // VR-appar har kategorin INFO, som också räknas
            JSONObject o = new JSONObject();
            o.put("p", a.packageName);
            o.put("n", String.valueOf(pm.getApplicationLabel(a)));
            out.put(o);
        }
        return out;
    }
}
