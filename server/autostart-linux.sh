#!/bin/sh
# Startar V.I.C.T.O.R. Server automatiskt med datorn (systemd) och låter panelen starta om och stänga av datorn.
#   Slå på:   sudo sh autostart-linux.sh
#   Stäng av: sudo sh autostart-linux.sh --remove
set -e
[ "$(id -u)" = 0 ] || { echo 'Kör med sudo: sudo sh autostart-linux.sh'; exit 1; }
DIR=$(cd "$(dirname "$0")" && pwd)
USR=${SUDO_USER:-$(stat -c %U "$DIR/server.js")}
UNIT=/etc/systemd/system/victor-server.service
RULE=/etc/polkit-1/rules.d/49-victor-server.rules
if [ "$1" = "--remove" ]; then
  systemctl disable --now victor-server 2>/dev/null || true
  rm -f "$UNIT" "$RULE"; systemctl daemon-reload
  echo 'Autostarten är borttagen.'; exit 0
fi
NODE=$(command -v node) || { echo 'Hittar inte Node.js. Installera det först.'; exit 1; }
cat > "$UNIT" <<UNITEOF
[Unit]
Description=V.I.C.T.O.R. Server
After=network-online.target
Wants=network-online.target

[Service]
User=$USR
WorkingDirectory=$DIR
ExecStart=$NODE $DIR/server.js --service
Restart=always
RestartSec=10
KillMode=process

[Install]
WantedBy=multi-user.target
UNITEOF
# låt tjänsten starta om och stänga av datorn från panelen
mkdir -p "$(dirname "$RULE")"
cat > "$RULE" <<RULEEOF
polkit.addRule(function(action, subject) {
  if (subject.user == "$USR" && /^org\.freedesktop\.login1\.(reboot|power-off)(-multiple-sessions|-ignore-inhibit)?$/.test(action.id)) return polkit.Result.YES;
});
RULEEOF
systemctl daemon-reload
systemctl enable --now victor-server
echo "Klart. V.I.C.T.O.R. Server startar nu med datorn som användaren $USR."
echo "Status: systemctl status victor-server    Logg: journalctl -u victor-server -f"
