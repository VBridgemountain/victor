package se.noirlab.victor.vr;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

// Öppnar V.I.C.T.O.R. i headsetets webbläsare (?headset visar en stor knapp för att gå in i VR) och stänger sig själv.
public class Launch extends Activity {
    static final String URL = "https://vbridgemountain.github.io/victor/desktop/?headset";

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(URL));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            Toast.makeText(this, "Hittar ingen webbläsare i headsetet.", Toast.LENGTH_LONG).show();
        }
        finish();
    }
}
