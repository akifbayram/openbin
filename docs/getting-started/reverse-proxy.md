# Reverse Proxy

OpenBin works behind any reverse proxy. This page provides copy-paste configs for the most popular options.

## Prerequisites

1. OpenBin running via Docker (see [Docker Quick Start](./docker))
2. A domain name pointing to your server (e.g. `openbin.example.com`)
3. Set `TRUST_PROXY=true` in your `.env` file:

```bash
TRUST_PROXY=true
```

This tells Express to trust the `X-Forwarded-*` headers from your proxy, which is required for:
- **Rate limiting** — uses the real client IP instead of the proxy's IP
- **Protocol detection** — Express sees HTTPS via `X-Forwarded-Proto` instead of plain HTTP
- **HSTS header** — automatically sent when `TRUST_PROXY` is enabled

Restart the container after changing `.env`:

```bash
docker compose up -d
```

## Nginx

```nginx
server {
    listen 80;
    server_name openbin.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name openbin.example.com;

    ssl_certificate     /etc/ssl/certs/openbin.crt;
    ssl_certificate_key /etc/ssl/private/openbin.key;

    # Allow photo uploads (default MAX_PHOTO_SIZE_MB=5)
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:1453;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support (AI streaming features)
        proxy_buffering off;
        proxy_cache     off;
        proxy_read_timeout 300s;
    }
}
```

### Nginx Proxy Manager

If you use [Nginx Proxy Manager](https://nginxproxymanager.com/) instead of raw Nginx config:

1. Add a new **Proxy Host**
2. Set **Domain** to `openbin.example.com`
3. Set **Forward Hostname** to your server IP or `openbin` (if on the same Docker network)
4. Set **Forward Port** to `1453`
5. Enable **Block Common Exploits** and **Websockets Support**
6. Under the **SSL** tab, request a new Let's Encrypt certificate
7. Under **Advanced**, paste this custom Nginx configuration:

```nginx
client_max_body_size 10m;
proxy_buffering off;
proxy_read_timeout 300s;
```

::: tip Docker networking
If OpenBin and Nginx Proxy Manager share a Docker network, use the container name (`openbin`) as the forward hostname instead of an IP address. Add both containers to the same network in your `docker-compose.yml`.
:::

## Caddy

[Caddy](https://caddyserver.com/) handles TLS certificates automatically.

```
openbin.example.com {
    reverse_proxy localhost:1453 {
        flush_interval -1
    }
}
```

`flush_interval -1` disables response buffering, which is required for SSE (AI streaming features) to work in real time.

That's it — Caddy automatically provisions a Let's Encrypt certificate and redirects HTTP to HTTPS.

### Caddyfile with Docker Compose

To run Caddy alongside OpenBin using Docker Compose:

```yaml
services:
  openbin:
    container_name: openbin
    image: openbin:latest
    build: .
    restart: unless-stopped
    expose:
      - "1453"
    env_file: .env
    environment:
      DATABASE_PATH: /data/openbin.db
      PHOTO_STORAGE_PATH: /data/photos
      BACKUP_PATH: /data/backups
      TRUST_PROXY: "true"
    volumes:
      - api_data:/data

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config

volumes:
  api_data:
  caddy_data:
  caddy_config:
```

With a `Caddyfile` in the project root:

```
openbin.example.com {
    reverse_proxy openbin:1453 {
        flush_interval -1
    }
}
```

## Traefik

[Traefik](https://traefik.io/) integrates with Docker via labels — no config files needed per service. Traefik streams responses by default, so SSE (AI streaming) works without extra configuration.

### Docker Compose with Traefik labels

```yaml
services:
  openbin:
    container_name: openbin
    image: openbin:latest
    build: .
    restart: unless-stopped
    expose:
      - "1453"
    env_file: .env
    environment:
      DATABASE_PATH: /data/openbin.db
      PHOTO_STORAGE_PATH: /data/photos
      BACKUP_PATH: /data/backups
      TRUST_PROXY: "true"
    volumes:
      - api_data:/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.openbin.rule=Host(`openbin.example.com`)"
      - "traefik.http.routers.openbin.entrypoints=websecure"
      - "traefik.http.routers.openbin.tls.certresolver=letsencrypt"
      - "traefik.http.services.openbin.loadbalancer.server.port=1453"

  traefik:
    image: traefik:v3
    restart: unless-stopped
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--certificatesresolvers.letsencrypt.acme.email=you@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt

volumes:
  api_data:
  letsencrypt:
```

## Verifying Your Setup

After configuring your reverse proxy, verify everything works:

```bash
# Health check
curl -s https://openbin.example.com/api/health

# Confirm X-Forwarded headers are reaching the app (check logs)
docker compose logs -f openbin
```

You should see `{"status":"ok"}` from the health check. Open `https://openbin.example.com` in your browser and confirm you can register and log in.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Login works but you're immediately logged out | Cookies missing `Secure` flag over HTTPS | Set `TRUST_PROXY=true` and `COOKIE_SECURE=true` in `.env` and restart |
| Rate limiter blocks everyone after one user | Proxy IP used instead of client IP | Set `TRUST_PROXY=true` and ensure `X-Forwarded-For` is passed |
| AI streaming shows all text at once | Proxy is buffering the SSE response | Disable buffering (see configs above) |
| Photo uploads fail with 413 error | Proxy body size limit too low | Increase `client_max_body_size` (Nginx) or remove limit |
| `Mixed Content` browser warning | Proxy terminates TLS but app thinks it's HTTP | Ensure `X-Forwarded-Proto: https` is set |
