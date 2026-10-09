#!/bin/bash
# Mantém o Nex acessível depois de cada deploy do EasyPanel.
#
# O painel regrava o Traefik para a rede interna (nex_crm / nex_site / nex_pv_corban)
# e remove a publicação no host. Neste VPS essa rede não responde, então o domínio
# cai em 502. Este script republica 30320 (app), 30321 (site) e 30322 (página CORBAN)
# no modo host e mantém um arquivo do Traefik apontando para http://172.17.0.1:<porta>/.
#
# Portas de host proibidas: 3000, 30180, 30181, 30300, 30310.
#
# Uso (root, no VPS):
#   nex-traefik-persist.sh --once
#   nex-traefik-persist.sh --watch
#   nex-traefik-persist.sh --install
set -uo pipefail

APP_SVC="${NEX_APP_SERVICE:-nex_crm}"
SITE_SVC="${NEX_SITE_SERVICE:-nex_site}"
CORBAN_SVC="${NEX_CORBAN_SERVICE:-nex_pv_corban}"
APP_HOST_PORT="${NEX_APP_HOST_PORT:-30320}"
SITE_HOST_PORT="${NEX_SITE_HOST_PORT:-30321}"
CORBAN_HOST_PORT="${NEX_CORBAN_HOST_PORT:-30322}"
GATEWAY="${NEX_GATEWAY:-172.17.0.1}"
CONFIG_DIR="${TRAEFIK_CONFIG_DIR:-/etc/easypanel/traefik/config}"
MAIN="${TRAEFIK_MAIN_YAML:-$CONFIG_DIR/main.yaml}"
PERSIST_FILE="${NEX_PERSIST_FILE:-$CONFIG_DIR/nex-hostgw.yaml}"
LOCK_FILE="${NEX_PERSIST_LOCK:-/run/nex-traefik-persist.lock}"
RESERVED_PORTS="3000 30180 30181 30300 30310"

log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*"; }

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Execute como root no VPS."
    exit 1
  fi
}

refuse_reserved() {
  local port="$1"
  local reserved
  for reserved in $RESERVED_PORTS; do
    if [[ "$port" == "$reserved" ]]; then
      log "ERRO: porta ${port} pertence a outro sistema. Nada foi publicado."
      return 1
    fi
  done
}

service_port() {
  local svc="$1"
  local fallback="$2"
  local port
  port="$(docker service inspect "$svc" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null | awk -F= '$1=="PORT"{print $2; exit}')"
  if [[ "$port" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$port"
  else
    printf '%s\n' "$fallback"
  fi
}

has_host_publish() {
  local svc="$1"
  local host_port="$2"
  local target_port="$3"
  docker service inspect "$svc" --format '{{json .Spec.EndpointSpec.Ports}}' 2>/dev/null | python3 -c '
import json, sys
host = int(sys.argv[1]); target = int(sys.argv[2])
try:
    ports = json.load(sys.stdin) or []
except Exception:
    sys.exit(1)
for port in ports:
    if port.get("Protocol") not in (None, "tcp"):
        continue
    if int(port.get("PublishedPort", 0)) == host and int(port.get("TargetPort", 0)) == target and port.get("PublishMode") == "host":
        sys.exit(0)
sys.exit(1)
' "$host_port" "$target_port"
}

drop_other_publishes() {
  local svc="$1"
  local host_port="$2"
  local target_port="$3"
  local spec
  while IFS= read -r spec; do
    [[ -z "$spec" ]] && continue
    log "removendo publicação antiga ${spec} de ${svc}"
    docker service update --publish-rm "$spec" "$svc" >/dev/null 2>&1 || true
  done < <(docker service inspect "$svc" --format '{{json .Spec.EndpointSpec.Ports}}' | python3 -c '
import json, sys
host = int(sys.argv[1]); target = int(sys.argv[2])
try:
    ports = json.load(sys.stdin) or []
except Exception:
    ports = []
for port in ports:
    if port.get("Protocol") not in (None, "tcp"):
        continue
    if int(port.get("PublishedPort", 0)) != host:
        continue
    mode = port.get("PublishMode") or "ingress"
    tgt = int(port.get("TargetPort", 0))
    if mode == "host" and tgt == target:
        continue
    print(f"published={host},target={tgt},protocol=tcp,mode={mode}")
' "$host_port" "$target_port")
}

ensure_host_publish() {
  local svc="$1"
  local host_port="$2"
  local target_port="$3"
  if ! docker service inspect "$svc" >/dev/null 2>&1; then
    log "serviço ${svc} ausente, porta ${host_port} não alterada"
    return 0
  fi
  refuse_reserved "$host_port" || return 1
  if has_host_publish "$svc" "$host_port" "$target_port"; then
    return 0
  fi
  drop_other_publishes "$svc" "$host_port" "$target_port"
  if has_host_publish "$svc" "$host_port" "$target_port"; then
    return 0
  fi
  log "publicando ${host_port} -> ${target_port} em ${svc} no modo host"
  if ! docker service update --publish-add "published=${host_port},target=${target_port},protocol=tcp,mode=host" "$svc" >/dev/null; then
    log "falha ao publicar ${host_port} em ${svc}"
    return 1
  fi
  log "porta ${host_port} publicada em ${svc}"
}

write_traefik() {
  python3 - "$MAIN" "$PERSIST_FILE" "$GATEWAY" "$APP_HOST_PORT" "$SITE_HOST_PORT" "$CORBAN_HOST_PORT" "$CONFIG_DIR/nex-pv-corban.yaml" << 'PY'
import json, sys
from pathlib import Path

main_path, persist_path, gateway, app_port, site_port, corban_port, corban_extra = sys.argv[1:]
main_file = Path(main_path)
text = main_file.read_text(encoding="utf-8") if main_file.exists() else ""
data = None
kind = None
if text.strip():
    try:
        data = json.loads(text)
        kind = "json"
    except Exception:
        try:
            import yaml
            data = yaml.safe_load(text)
            kind = "yaml"
        except Exception:
            data = None

http_ep = "http"
https_ep = "https"
cert_resolver = "letsencrypt"
if isinstance(data, dict):
    routers = ((data.get("http") or {}).get("routers") or {})
    for router in routers.values():
        if not isinstance(router, dict):
            continue
        eps = router.get("entryPoints") or []
        tls = router.get("tls") or {}
        if isinstance(tls, dict) and tls.get("certResolver"):
            cert_resolver = tls["certResolver"]
        for ep in eps:
            ep = str(ep)
            if "https" in ep or "secure" in ep:
                https_ep = ep
            elif ep:
                http_ep = ep

app_rule = "Host(`app.nexmeta.com.br`) || Host(`nex-crm.achpyp.easypanel.host`)"
site_rule = "Host(`nexmeta.com.br`) || Host(`nex-site.achpyp.easypanel.host`)"
corban_rule = "Host(`corban.nexmeta.com.br`) || Host(`nex-pv-corban.achpyp.easypanel.host`)"
persist = f"""http:
  routers:
    nex-persist-app-http:
      rule: "{app_rule}"
      entryPoints:
        - {http_ep}
      priority: 100000
      service: nex-persist-app
    nex-persist-app-https:
      rule: "{app_rule}"
      entryPoints:
        - {https_ep}
      priority: 100000
      service: nex-persist-app
      tls:
        certResolver: {cert_resolver}
    nex-persist-site-http:
      rule: "{site_rule}"
      entryPoints:
        - {http_ep}
      priority: 100000
      service: nex-persist-site
    nex-persist-site-https:
      rule: "{site_rule}"
      entryPoints:
        - {https_ep}
      priority: 100000
      service: nex-persist-site
      tls:
        certResolver: {cert_resolver}
    nex-persist-corban-http:
      rule: "{corban_rule}"
      entryPoints:
        - {http_ep}
      priority: 100000
      service: nex-persist-corban
    nex-persist-corban-https:
      rule: "{corban_rule}"
      entryPoints:
        - {https_ep}
      priority: 100000
      service: nex-persist-corban
      tls:
        certResolver: {cert_resolver}
  services:
    nex-persist-app:
      loadBalancer:
        servers:
          - url: "http://{gateway}:{app_port}/"
    nex-persist-site:
      loadBalancer:
        servers:
          - url: "http://{gateway}:{site_port}/"
    nex-persist-corban:
      loadBalancer:
        servers:
          - url: "http://{gateway}:{corban_port}/"
"""
extra = Path(corban_extra)
if extra.exists():
    extra.unlink()
    print(f"removido {extra.name}")
dest = Path(persist_path)
dest.parent.mkdir(parents=True, exist_ok=True)
if not dest.exists() or dest.read_text(encoding="utf-8") != persist:
    dest.write_text(persist, encoding="utf-8")
    print(f"traefik {dest.name} atualizado")

if not text:
    sys.exit(0)
new = text
import re
new, app_n = re.subn(r"http://nex_crm:\d+/?", f"http://{gateway}:{app_port}/", new)
new, site_n = re.subn(r"http://nex_site:\d+/?", f"http://{gateway}:{site_port}/", new)
new, corban_n = re.subn(r"http://nex_pv_corban:\d+/?", f"http://{gateway}:{corban_port}/", new)
if new != text:
    backup = Path(str(main_file) + ".bak-nex-persist")
    if not backup.exists():
        backup.write_text(text, encoding="utf-8")
    main_file.write_text(new, encoding="utf-8")
    print(f"main.yaml app={app_n} site={site_n} corban={corban_n}")
PY
}

probe() {
  local name="$1"
  local url="$2"
  local i code
  code="000"
  for i in 1 2 3 4 5 6 7 8; do
    code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 "$url" || echo 000)"
    case "$code" in
      000|502|503|504) sleep 5 ;;
      *) log "${name}:${code} ${url}"; return 0 ;;
    esac
  done
  log "${name}:${code} ${url}"
}

reconcile() {
  local app_target site_target
  (
    flock -w 30 9 || exit 0
    app_target="$(service_port "$APP_SVC" "$APP_HOST_PORT")"
    site_target="$(service_port "$SITE_SVC" "$SITE_HOST_PORT")"
    corban_target="$(service_port "$CORBAN_SVC" "$CORBAN_HOST_PORT")"
    ensure_host_publish "$APP_SVC" "$APP_HOST_PORT" "$app_target" || true
    ensure_host_publish "$SITE_SVC" "$SITE_HOST_PORT" "$site_target" || true
    ensure_host_publish "$CORBAN_SVC" "$CORBAN_HOST_PORT" "$corban_target" || true
    write_traefik || log "falha ao gravar o Traefik"
  ) 9>"$LOCK_FILE"
}

install_service() {
  local src dest unit
  src="$(readlink -f "$0")"
  dest="/usr/local/sbin/nex-traefik-persist.sh"
  if [[ "$src" != "$dest" ]]; then
    install -m 755 "$src" "$dest"
  fi
  unit="/etc/systemd/system/nex-traefik-persist.service"
  cat > "$unit" << 'EOF'
[Unit]
Description=Republica as portas do Nex depois de cada deploy do EasyPanel
After=docker.service
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/local/sbin/nex-traefik-persist.sh --watch
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now nex-traefik-persist.service
  log "serviço nex-traefik-persist ativo"
}

watch() {
  log "observando deploys de ${APP_SVC}, ${SITE_SVC} e ${CORBAN_SVC}"
  reconcile
  while true; do
    sleep 15
    reconcile
  done &
  local loop_pid=$!
  trap 'kill "$loop_pid" 2>/dev/null || true' EXIT
  docker events --filter type=service --filter event=update --format '{{.Actor.Attributes.name}}' | while read -r name; do
    case "$name" in
      nex_crm|nex_site|nex_pv_corban)
        sleep 5
        reconcile
        ;;
    esac
  done
}

require_root
case "${1:-}" in
  --install)
    install_service
    reconcile
    probe app "https://app.nexmeta.com.br/auth"
    probe site "https://nexmeta.com.br/"
    probe corban "https://corban.nexmeta.com.br/"
    ;;
  --watch)
    watch
    ;;
  --once|"")
    reconcile
    probe app "https://app.nexmeta.com.br/auth"
    probe painel "https://nex-crm.achpyp.easypanel.host/auth"
    probe site "https://nexmeta.com.br/"
    probe corban "https://corban.nexmeta.com.br/"
    ;;
  *)
    echo "Uso: $0 [--once|--watch|--install]"
    exit 1
    ;;
esac
