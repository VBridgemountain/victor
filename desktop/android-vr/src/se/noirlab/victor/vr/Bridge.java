package se.noirlab.victor.vr;

import android.app.Service;
import android.content.Intent;
import android.net.Uri;
import android.os.IBinder;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;

// Headsetets webbläsare får inte starta andra appar via länkar. Den här tjänsten lyssnar därför bara på headsetet självt
// (127.0.0.1:8771), och V.I.C.T.O.R. ber den starta ett spel: GET /open?pkg=<paketnamn>. Bara V.I.C.T.O.R:s egen adress får fråga.
public class Bridge extends Service {
    static final int PORT = 8771;
    static final String[] ORIGINS = { "https://vbridgemountain.github.io", "http://localhost:8765" };
    ServerSocket server;

    @Override public int onStartCommand(Intent i, int flags, int id) {
        if (server == null) new Thread(this::serve, "victor-bridge").start();
        return START_STICKY;
    }

    void serve() {
        try {
            server = new ServerSocket(PORT, 8, InetAddress.getByName("127.0.0.1"));
            while (true) { final Socket s = server.accept(); new Thread(() -> handle(s)).start(); }
        } catch (Exception e) { server = null; }
    }

    void handle(Socket s) {
        try (Socket c = s) {
            c.setSoTimeout(5000);
            BufferedReader in = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
            String first = in.readLine(), line, origin = null;
            while ((line = in.readLine()) != null && !line.isEmpty())
                if (line.toLowerCase().startsWith("origin:")) origin = line.substring(7).trim();
            String allow = null;
            for (String o : ORIGINS) if (o.equals(origin)) allow = o;
            int code = 200; String body;
            String path = first != null && first.split(" ").length > 1 ? first.split(" ")[1] : "/";
            Uri u = Uri.parse("http://x" + path);
            if (first != null && first.startsWith("OPTIONS")) body = "";
            else if (allow == null) { code = 403; body = "{\"error\":\"not allowed\"}"; }
            else if ("/ping".equals(u.getPath())) body = "{\"ok\":true}";
            else if ("/open".equals(u.getPath())) {
                String pkg = u.getQueryParameter("pkg");
                Intent li = pkg != null && pkg.matches("[A-Za-z0-9_.]+") ? getPackageManager().getLaunchIntentForPackage(pkg) : null;
                if (li == null) { code = 404; body = "{\"error\":\"Appen finns inte i headsetet.\"}"; }
                else { li.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(li); body = "{\"ok\":true}"; }
            } else { code = 404; body = "{\"error\":\"okänd\"}"; }
            byte[] b = body.getBytes("UTF-8");
            String head = "HTTP/1.1 " + code + (code == 200 ? " OK" : " Error") + "\r\nContent-Type: application/json\r\nContent-Length: " + b.length
                + "\r\nConnection: close\r\nAccess-Control-Allow-Methods: GET\r\nAccess-Control-Allow-Private-Network: true\r\n"
                + (allow != null ? "Access-Control-Allow-Origin: " + allow + "\r\nVary: Origin\r\n" : "") + "\r\n";
            OutputStream out = c.getOutputStream(); out.write(head.getBytes("UTF-8")); out.write(b); out.flush();
        } catch (Exception ignored) { }
    }

    @Override public IBinder onBind(Intent i) { return null; }
}
