# Migration: GitHub Pages → Hostinger VPS (Nginx)

**Domain**: bartwagener.com  
**DNS**: TransIP.nl  
**VPS IP**: 72.62.58.207  
**Repo**: https://github.com/bwag84/bwag84  

---

## Step 1 — Install Hugo on VPS

Hugo must match the pinned version in `.github/workflows/hugo.yml` (0.128.0).

```bash
ssh root@72.62.58.207
wget https://github.com/gohugoio/hugo/releases/download/v0.128.0/hugo_extended_0.128.0_linux-amd64.deb
sudo dpkg -i hugo_extended_0.128.0_linux-amd64.deb
hugo version
# Expected: hugo v0.128.0+extended
```

---

## Step 2 — Install Node.js

Required for Tailwind/PostCSS build step.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v
```

---

## Step 3 — Clone repo and build site

```bash
cd /var/www
git clone --recurse-submodules https://github.com/bwag84/bwag84.git bartwagener.com
cd bartwagener.com
npm ci
npm run build:css && hugo --gc --minify
# Built site is now in /var/www/bartwagener.com/public/
```

---

## Step 4 — Configure Nginx

Create the site config:

```bash
nano /etc/nginx/sites-available/bartwagener.com
```

Paste this content:

```nginx
server {
    listen 80;
    server_name bartwagener.com www.bartwagener.com;
    root /var/www/bartwagener.com/public;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    error_page 404 /404.html;
}
```

Enable and test:

```bash
ln -s /etc/nginx/sites-available/bartwagener.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## Step 5 — SSL with Let's Encrypt

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d bartwagener.com -d www.bartwagener.com
# Follow prompts: enter email, agree to ToS, choose redirect (option 2)
```

Certbot updates the Nginx config automatically and sets up auto-renewal.

---

## Step 6 — Create deploy script

```bash
nano /var/www/bartwagener.com/deploy.sh
```

Paste:

```bash
#!/bin/bash
set -e
cd /var/www/bartwagener.com
git pull --recurse-submodules
npm ci --prefer-offline
npm run build:css
hugo --gc --minify
echo "Deploy complete."
```

Make executable:

```bash
chmod +x /var/www/bartwagener.com/deploy.sh
```

Run `./deploy.sh` from `/var/www/bartwagener.com/` whenever you push new content.

---

## Step 7 — Update DNS at TransIP.nl

**Do this after the VPS is serving the site correctly on HTTP.**

1. Log in at transip.nl → Mijn Domeinen → bartwagener.com → DNS
2. Lower TTL to `300` on all records first, wait 5 minutes
3. Replace the GitHub Pages `A` records with your VPS IP:

| Type | Name | Old value | New value |
|------|------|-----------|-----------|
| `A` | `@` | `185.199.108.153` | `72.62.58.207` |
| `A` | `@` | `185.199.109.153` | delete |
| `A` | `@` | `185.199.110.153` | delete |
| `A` | `@` | `185.199.111.153` | delete |
| `CNAME` | `www` | `bwag84.github.io` | `bartwagener.com` |

4. Wait for propagation: `watch -n5 dig +short bartwagener.com`  
   Done when it returns `72.62.58.207`.

---

## Step 8 — Cleanup after DNS propagates

- Remove `static/CNAME` from the repo (GitHub Pages artifact, no longer needed)
- Disable GitHub Pages: repo Settings → Pages → Source → set to **None**
- Raise TTL back to `3600` in TransIP

---

## Troubleshooting

**Site not loading after DNS change**: run `nginx -t && systemctl status nginx`  
**CSS missing**: run `npm run build:css` then `hugo --gc --minify` again  
**SSL cert fails**: make sure DNS points to VPS *before* running certbot  
**Submodule empty**: run `git submodule update --init --recursive`
