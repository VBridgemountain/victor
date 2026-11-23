package se.noirlab.victor.vr;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

// Startar ett spel eller en app i headsetet när V.I.C.T.O.R. öppnar victorvr://open?pkg=<paketnamn>
public class Open extends Activity {
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        Uri u = getIntent() != null ? getIntent().getData() : null;
        String pkg = u != null ? u.getQueryParameter("pkg") : null;
        Intent i = pkg != null && pkg.matches("[A-Za-z0-9_.]+") ? getPackageManager().getLaunchIntentForPackage(pkg) : null;
        if (i == null) Toast.makeText(this, "Appen finns inte i headsetet.", Toast.LENGTH_LONG).show();
        else { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); }
        finish();
    }
}
